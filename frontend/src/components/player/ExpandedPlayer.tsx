"use client";

import { usePlayerStore } from '@/store/playerStore';
import { useAuthStore } from '@/store/authStore';
import { 
  Play, 
  Pause, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  ChevronDown, 
  CheckCircle2,
  Heart,
  Info,
  ListMusic,
  Share2,
  Loader2,
  Mic2,
  ExternalLink,
  Music2,
  Maximize2
} from 'lucide-react';
import { SkipBackIcon, SkipForwardIcon } from '@/components/ui/PlayerIcons';
import { audioPlayer } from '@/lib/audioPlayer';
import MusicPoster from '@/components/ui/MusicPoster';
import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import { extractDominantColor, DominantColor, getCachedDominantColor, hashToColor } from '@/lib/colorExtractor';
import { fetchLyricsForTrack, getCachedLyrics, LyricLine } from '@/lib/lyricsService';
import { useSettingsStore } from '@/store/settingsStore';
import FullScreenLyrics from '@/components/player/FullScreenLyrics';
import SmoothBackground from '@/components/ui/SmoothBackground';
import { smoothScrollTo, cancelSmoothScroll } from '@/lib/smoothScroll';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Memoized individual lyric line for the card to eliminate lag on re-renders
// Uses constant font metrics + GPU scale transform to eliminate layout reflow / stutter
const CardLyricRow = memo(function CardLyricRow({
  line,
  index,
  isCurrent,
  onClick
}: {
  line: LyricLine;
  index: number;
  isCurrent: boolean;
  onClick: (time: number) => void;
}) {
  const handleClick = () => onClick(line.time);
  return (
    <p
      data-lyric-index={index}
      onClick={handleClick}
      style={{
        transform: isCurrent ? 'scale(1)' : 'scale(0.90)',
        transformOrigin: 'left center',
        willChange: 'transform, opacity'
      }}
      className={`cursor-pointer select-text leading-relaxed py-1.5 transition-all duration-300 ease-out ${
        isCurrent
          ? 'text-white font-bold text-base sm:text-lg opacity-100 drop-shadow-sm'
          : 'text-white font-medium text-base sm:text-lg opacity-45 hover:opacity-85'
      }`}
    >
      {line.text}
    </p>
  );
});

// Memoized CardLyricsList component: isolates lyrics rendering from 4x/sec progress updates
const CardLyricsList = memo(function CardLyricsList({
  lyricsLines,
  currentLineIndex,
  onSeek
}: {
  lyricsLines: LyricLine[];
  currentLineIndex: number;
  onSeek: (time: number) => void;
}) {
  return (
    <>
      {lyricsLines.map((line, i) => (
        <CardLyricRow
          key={`card-lyric-${i}`}
          line={line}
          index={i}
          isCurrent={i === currentLineIndex}
          onClick={onSeek}
        />
      ))}
    </>
  );
});

export default function ExpandedPlayer() {
  const { 
    currentTrack, 
    isPlaying, 
    isLoading,
    progress, 
    isShuffled, 
    repeatMode,
    isQueueOpen,
    isFullScreenLyricsOpen,
    toggleShuffle,
    toggleRepeat,
    setIsExpanded,
    setIsQueueOpen,
    setIsFullScreenLyricsOpen,
    openArtistModal,
    isFavorite,
    toggleFavorite
  } = usePlayerStore();
  const { autoScrollLyrics, preferEnglishLyrics } = useSettingsStore();

  // Dedicated states strictly tagged by videoId so previous song data NEVER leaks on skip
  const [lyricsState, setLyricsState] = useState<{
    videoId: string;
    lines: LyricLine[];
    source: string;
    loading: boolean;
  }>({
    videoId: '',
    lines: [],
    source: 'Synced',
    loading: false
  });

  const [themeState, setThemeState] = useState<{
    videoId: string;
    theme: DominantColor;
  }>({
    videoId: '',
    theme: hashToColor('default')
  });

  const [artistDetailsState, setArtistDetailsState] = useState<{
    videoId: string;
    photo: string;
    subscribers: string;
    browseId: string;
  }>({
    videoId: '',
    photo: '',
    subscribers: '',
    browseId: ''
  });

  const [showLyricsFull, setShowLyricsFull] = useState(true);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [trackDetailsState, setTrackDetailsState] = useState<{ videoId: string; data: any }>({
    videoId: '',
    data: null
  });
  const [userScrolledCard, setUserScrolledCard] = useState(false);

  const pageContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const lyricsSectionRef = useRef<HTMLDivElement>(null);
  const lyricsCardScrollRef = useRef<HTMLDivElement>(null);
  const activeFetchIdRef = useRef(0);
  const colorFetchIdRef = useRef(0);
  const cardScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevActiveLineRef = useRef(-1);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  const isLiked = currentTrack ? isFavorite(currentTrack.videoId) : false;
  const artistName = currentTrack?.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ') || 'Unknown Artist';
  const primaryArtist = currentTrack?.artists?.[0] 
    ? (typeof currentTrack.artists[0] === 'string' ? currentTrack.artists[0] : currentTrack.artists[0].name)
    : 'Unknown Artist';

  // 1. INSTANT SYNCHRONOUS DOMINANT THEME (Never renders previous song's color on skip)
  const dominantTheme = useMemo(() => {
    if (!currentTrack) return hashToColor('default');
    if (themeState.videoId === currentTrack.videoId) {
      return themeState.theme;
    }
    const poster = currentTrack.poster || currentTrack.thumbnails?.[0]?.url || currentTrack.fallbackPoster || '';
    return getCachedDominantColor(poster, `${currentTrack.title}_${artistName}`, currentTrack.videoId);
  }, [currentTrack?.videoId, currentTrack?.title, currentTrack?.poster, artistName, themeState]);

  // 2. STRICTLY ISOLATED LYRICS (Guarantees previous song's lyrics NEVER render for next song)
  const lyricsLines = useMemo(() => {
    if (!currentTrack || lyricsState.videoId !== currentTrack.videoId) {
      return [];
    }
    return lyricsState.lines;
  }, [currentTrack?.videoId, lyricsState]);

  const lyricsLoading = useMemo(() => {
    if (!currentTrack) return false;
    if (lyricsState.videoId !== currentTrack.videoId) {
      return true;
    }
    return lyricsState.loading;
  }, [currentTrack?.videoId, lyricsState]);

  const lyricsSource = useMemo(() => {
    if (!currentTrack || lyricsState.videoId !== currentTrack.videoId) {
      return 'Synced';
    }
    return lyricsState.source;
  }, [currentTrack?.videoId, lyricsState]);

  // Strictly isolated artist details & track details
  const artistPhoto = artistDetailsState.videoId === currentTrack?.videoId ? artistDetailsState.photo : '';
  const artistSubscribers = artistDetailsState.videoId === currentTrack?.videoId ? artistDetailsState.subscribers : '';
  const artistBrowseId = artistDetailsState.videoId === currentTrack?.videoId ? artistDetailsState.browseId : '';
  const trackDetails = trackDetailsState.videoId === currentTrack?.videoId ? trackDetailsState.data : null;

  // 3. EXTRACT DYNAMIC DOMINANT COLOR FROM ARTWORK WITH STRICT RACE-CONDITION PROTECTION
  useEffect(() => {
    if (!currentTrack?.videoId) return;
    const currentVideoId = currentTrack.videoId;
    const colorId = ++colorFetchIdRef.current;
    const poster = currentTrack.poster || currentTrack.thumbnails?.[0]?.url || currentTrack.fallbackPoster || '';
    
    extractDominantColor(poster, `${currentTrack.title}_${artistName}`, currentVideoId).then((color) => {
      // Discard stale result if user skipped to another track in the meantime
      if (colorFetchIdRef.current === colorId && currentTrack?.videoId === currentVideoId) {
        setThemeState({ videoId: currentVideoId, theme: color });
      }
    });

    // Pre-cache color of next track in queue so subsequent color transition happens instantly
    const storeState = usePlayerStore.getState();
    const nextTrack = storeState.queue[storeState.queueIndex + 1];
    if (nextTrack) {
      const nextPoster = nextTrack.poster || nextTrack.thumbnails?.[0]?.url || nextTrack.fallbackPoster || '';
      if (nextPoster) {
        const nextArtist = nextTrack.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ') || '';
        extractDominantColor(nextPoster, `${nextTrack.title}_${nextArtist}`, nextTrack.videoId).catch(() => {});
      }
    }
  }, [currentTrack?.videoId, currentTrack?.poster, currentTrack?.title, artistName]);

  // 4. ALWAYS OPEN EXPANDED PLAYER AT THE VERY TOP
  useEffect(() => {
    if (pageContainerRef.current) {
      pageContainerRef.current.scrollTop = 0;
    }
    setUserScrolledCard(false);
    prevActiveLineRef.current = -1;
  }, [currentTrack?.videoId]);

  // 5. FETCH SONG METADATA, ARTIST PHOTO, AND REAL SYNCHRONIZED LYRICS WITH VIDEOID ISOLATION
  useEffect(() => {
    if (!currentTrack?.videoId) return;

    const currentVideoId = currentTrack.videoId;
    const fetchId = ++activeFetchIdRef.current;
    const controller = new AbortController();

    // Reset / load lyrics immediately for currentVideoId
    const cached = getCachedLyrics(currentVideoId, preferEnglishLyrics);
    if (cached) {
      setLyricsState({
        videoId: currentVideoId,
        lines: cached.lines,
        source: cached.source,
        loading: false
      });
    } else {
      setLyricsState({
        videoId: currentVideoId,
        lines: [],
        source: 'Synced',
        loading: true
      });
    }

    // Fetch real artist photo & profile with browseId for maximum speed
    const primaryA = currentTrack?.artists?.[0];
    const primaryId = typeof primaryA === 'object' ? primaryA?.id : undefined;
    const artistFetchUrl = new URL(`${backendUrl}/api/artist/${encodeURIComponent(primaryArtist)}`);
    if (primaryId) {
      artistFetchUrl.searchParams.set('browseId', primaryId);
    }

    fetch(artistFetchUrl.toString(), { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (activeFetchIdRef.current === fetchId && data && !data.error && currentTrack?.videoId === currentVideoId) {
          setArtistDetailsState({
            videoId: currentVideoId,
            photo: data.avatar || '',
            subscribers: data.subscribers || '',
            browseId: data.browseId || ''
          });
        }
      })
      .catch(() => {});

    // Fetch full song metadata (views, description, published date, subscribers)
    fetch(`${backendUrl}/api/song/${currentVideoId}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (activeFetchIdRef.current === fetchId && data && !data.error && currentTrack?.videoId === currentVideoId) {
          setTrackDetailsState({ videoId: currentVideoId, data });
        }
      })
      .catch(() => {});

    // Fetch fresh lyrics if not already cached
    if (!cached) {
      fetchLyricsForTrack(
        currentVideoId,
        currentTrack.title,
        primaryArtist,
        currentTrack.duration,
        controller.signal,
        preferEnglishLyrics
      )
        .then((result) => {
          if (activeFetchIdRef.current === fetchId && currentTrack?.videoId === currentVideoId) {
            setLyricsState({
              videoId: currentVideoId,
              lines: result.lines,
              source: result.source,
              loading: false
            });
          }
        })
        .catch((err) => {
          if (err?.name !== 'AbortError' && activeFetchIdRef.current === fetchId && currentTrack?.videoId === currentVideoId) {
            setLyricsState({
              videoId: currentVideoId,
              lines: [],
              source: 'Synced',
              loading: false
            });
          }
        });
    }

    return () => {
      controller.abort();
    };
  }, [currentTrack?.videoId, currentTrack?.title, primaryArtist, currentTrack?.duration, backendUrl, preferEnglishLyrics]);

  // 4. DETERMINE ACTIVE LYRIC LINE
  const currentLineIndex = useMemo(() => {
    if (lyricsLines.length === 0) return -1;
    if (progress < (lyricsLines[0].time - 0.3)) return -1;
    for (let i = lyricsLines.length - 1; i >= 0; i--) {
      if (progress >= lyricsLines[i].time - 0.3) {
        return i;
      }
    }
    return -1;
  }, [progress, lyricsLines]);

  // 5. AUTO-SCROLL ACTIVE LYRIC LINE INSIDE THE LYRICS BOX ONLY (High-FPS hardware accelerated RAF scroll)
  useEffect(() => {
    if (userScrolledCard || !showLyricsFull || currentLineIndex < 0 || !autoScrollLyrics) return;
    if (prevActiveLineRef.current === currentLineIndex) return;
    prevActiveLineRef.current = currentLineIndex;

    const container = lyricsCardScrollRef.current;
    if (!container) return;

    const activeEl = container.querySelector<HTMLElement>(`[data-lyric-index="${currentLineIndex}"]`);
    if (!activeEl) return;

    const containerHeight = container.clientHeight;
    const targetScroll = activeEl.offsetTop - (containerHeight / 2) + (activeEl.clientHeight / 2);

    smoothScrollTo(container, Math.max(0, targetScroll), 400);
  }, [currentLineIndex, showLyricsFull, userScrolledCard, autoScrollLyrics]);

  // Detect user manual scroll inside lyrics card to pause auto-scroll
  const handleLyricsCardScroll = () => {
    cancelSmoothScroll(lyricsCardScrollRef.current);
    setUserScrolledCard(true);
    if (cardScrollTimerRef.current) clearTimeout(cardScrollTimerRef.current);
    cardScrollTimerRef.current = setTimeout(() => {
      setUserScrolledCard(false);
    }, 4500);
  };

  const togglePlay = useCallback(() => {
    if (usePlayerStore.getState().isPlaying) {
      audioPlayer.pause();
    } else {
      audioPlayer.play();
    }
  }, []);

  const handleSeekLyric = useCallback((time: number) => {
    audioPlayer.seek(time);
  }, []);

  const handleCloseFullScreenLyrics = useCallback(() => {
    setIsFullScreenLyricsOpen(false);
  }, []);

  const handleNextTrack = useCallback(() => {
    usePlayerStore.getState().nextTrack();
  }, []);

  const handlePrevTrack = useCallback(() => {
    usePlayerStore.getState().prevTrack();
  }, []);

  if (!currentTrack) return null;

  const trackDuration = currentTrack.duration && currentTrack.duration > 0 
    ? currentTrack.duration 
    : 180;

  const progressPercent = Math.min(100, Math.max(0, (progress / trackDuration) * 100));
  
  // Real live lyric snippet for the player header
  const activeLyric = currentLineIndex >= 0 && lyricsLines[currentLineIndex] 
    ? lyricsLines[currentLineIndex].text 
    : (lyricsLoading ? "Loading lyrics..." : (lyricsLines.length > 0 ? (progress < (lyricsLines[0]?.time - 0.3) ? "♪ Instrumental intro ♪" : lyricsLines[0].text) : ""));

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    audioPlayer.seek(ratio * trackDuration);
  };

  const scrollToLyrics = () => {
    lyricsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleOpenArtist = () => {
    const primaryA = currentTrack?.artists?.[0];
    const primaryId = typeof primaryA === 'object' ? primaryA?.id : undefined;
    setIsFullScreenLyricsOpen(false);
    setIsExpanded(false);
    openArtistModal({
      name: primaryArtist,
      id: artistBrowseId || primaryId,
      avatar: artistPhoto || currentTrack?.poster || currentTrack?.thumbnails?.[0]?.url,
      subscribers: artistSubscribers
    });
  };

  const currentGradient = dominantTheme
    ? `linear-gradient(180deg, ${dominantTheme.topGradient} 0%, ${dominantTheme.midGradient} 40%, #0a0a0c 100%)`
    : 'linear-gradient(180deg, #1e293b 0%, #0f172a 40%, #0a0a0c 100%)';

  return (
    <>
      <div 
        ref={pageContainerRef}
        className="fixed inset-0 z-[80] overflow-y-auto text-white select-none hide-scrollbar"
      >
        {/* Smooth Seamless Crossfading Dynamic Ambient Background */}
        <SmoothBackground 
          trackKey={currentTrack.videoId}
          gradient={currentGradient} 
          glowColor={dominantTheme?.topGradient || '#38bdf8'}
          durationMs={700} 
        />

        {/* SECTION 1: NOW PLAYING VIEW (Precisely fitted to 100dvh so all controls are 100% visible initially) */}
        <div className="relative z-10 h-[100dvh] max-h-[100dvh] flex flex-col justify-between max-w-md md:max-w-xl mx-auto p-4 sm:p-6 pb-4">
          {/* Top Header */}
          <header className="flex items-center justify-between py-1 flex-shrink-0">
            <button 
              onClick={() => {
                setIsFullScreenLyricsOpen(false);
                setIsExpanded(false);
              }}
              className="p-2 text-white/80 hover:text-white rounded-full transition-colors"
              title="Collapse"
            >
              <ChevronDown className="w-7 h-7 stroke-[2.5]" />
            </button>

            <div className="text-center px-4 flex-1 min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-300 block">
                NOW PLAYING
              </span>
              <h4 className="text-sm font-semibold text-white truncate mt-0.5">
                "{currentTrack.title}"
              </h4>
            </div>

            <button 
              onClick={handleOpenArtist}
              className="p-2 text-white/80 hover:text-white rounded-full transition-colors"
              title={`View ${primaryArtist}`}
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          </header>

          {/* Center Content: Artwork + Song info + Scrubber + Controls */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-evenly py-1 w-full">
            {/* Square Artwork: Locked dimensions and flex-shrink-0 so container never collapses on track change */}
            <div 
              className="relative aspect-square h-[35vh] sm:h-[38vh] max-h-[35vh] sm:max-h-[38vh] max-w-[85vw] w-auto rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/10 flex-shrink-0 transition-transform duration-300 hover:scale-[1.01]"
            >
              <MusicPoster 
                src={currentTrack.poster || currentTrack.thumbnails?.[0]?.url}
                fallbackSrc={currentTrack.fallbackPoster}
                videoId={currentTrack.videoId}
                alt={currentTrack.title}
                className="w-full h-full object-cover object-center"
              />
            </div>

            {/* Real Live Lyric Snippet + Title & Artist */}
            <div className="w-full space-y-1 flex-shrink-0">
              {activeLyric ? (
                <p 
                  onClick={() => setIsFullScreenLyricsOpen(true)}
                  className="text-xs sm:text-sm font-semibold text-white/90 truncate animate-in fade-in duration-200 drop-shadow-sm min-h-[18px] cursor-pointer hover:underline text-center sm:text-left"
                  title="Click to view full screen lyrics"
                >
                  {activeLyric}
                </p>
              ) : (
                <div className="min-h-[18px]" />
              )}

              {/* Title & Clickable Artist with Saved Checkmark + Favorite Heart */}
              <div className="flex items-center justify-between gap-3 pt-0.5">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight truncate leading-tight">
                    {currentTrack.title}
                  </h2>
                  
                  {/* Clickable Artist Name -> Opens Artist Profile & Songs */}
                  <button
                    onClick={handleOpenArtist}
                    className="text-xs sm:text-sm text-neutral-300 hover:text-white truncate mt-0.5 text-left inline-flex items-center gap-1 group transition-colors"
                    title={`View ${artistName} and their songs`}
                  >
                    <span className="group-hover:text-white transition-colors">{artistName}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>

                {/* Saved Checkmark & Favorite Heart */}
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <button 
                    title="Saved in Library" 
                    className="text-white hover:text-emerald-300 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2] fill-white text-black" />
                  </button>

                  <button 
                    onClick={() => toggleFavorite(currentTrack)}
                    className="transition-transform active:scale-125 p-1"
                    title={isLiked ? "Remove from Favorites" : "Add to Favorites"}
                  >
                    <Heart className={`w-5 h-5 sm:w-6 sm:h-6 ${isLiked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress Bar & Timestamps */}
            <div className="w-full space-y-1 flex-shrink-0">
              <div 
                ref={progressBarRef}
                onClick={handleSeek}
                className="group relative w-full h-3 cursor-pointer flex items-center"
              >
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-75"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div 
                  className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-lg -translate-x-1/2 pointer-events-none group-hover:scale-125 transition-transform"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>

              <div className="flex justify-between text-xs font-mono text-neutral-300">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(trackDuration)}</span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="w-full flex items-center justify-between pt-0.5 flex-shrink-0">
              <button 
                onClick={toggleShuffle}
                className={`p-2 transition-colors ${
                  isShuffled ? 'text-white' : 'text-neutral-400 hover:text-white'
                }`}
                title="Shuffle"
              >
                <Shuffle className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </button>

              <button 
                onClick={() => usePlayerStore.getState().prevTrack()}
                className="p-2 text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Previous Track"
              >
                <SkipBackIcon className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>

              {/* Play/Pause Button */}
              <button 
                onClick={togglePlay}
                disabled={isLoading}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl cursor-pointer"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isLoading ? (
                  <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin text-black" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current stroke-none" />
                ) : (
                  <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current stroke-none ml-1" />
                )}
              </button>

              <button 
                onClick={() => usePlayerStore.getState().nextTrack()}
                className="p-2 text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Next Track"
              >
                <SkipForwardIcon className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>

              <button 
                onClick={toggleRepeat}
                className={`p-2 transition-colors ${
                  repeatMode !== 'off' ? 'text-white' : 'text-neutral-400 hover:text-white'
                }`}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
                ) : (
                  <Repeat className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
                )}
              </button>
            </div>

            {/* Bottom Icons Row: Info, Queue, Lyrics */}
            <div className="w-full flex items-center justify-between pt-1 px-1 flex-shrink-0">
              <button 
                onClick={scrollToLyrics}
                className="p-2 text-white/80 hover:text-white transition-colors"
                title="View Song Info & Description"
              >
                <Info className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </button>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsQueueOpen(!isQueueOpen)}
                  className={`p-2 transition-colors ${
                    isQueueOpen ? 'text-white bg-white/20 rounded-full' : 'text-white/80 hover:text-white'
                  }`}
                  title="Queue"
                >
                  <ListMusic className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <button 
                  onClick={() => setIsFullScreenLyricsOpen(true)}
                  className="p-2 text-white/80 hover:text-white transition-colors"
                  title="Open Full Screen Lyrics"
                >
                  <Mic2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Visual cue: Scroll down for lyrics indicator */}
          <button
            onClick={scrollToLyrics}
            className="w-full flex items-center justify-center gap-1.5 py-1 text-white/60 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
            title="Scroll to view Lyrics and Artist Info"
          >
            <span className="text-[11px] font-semibold tracking-wider uppercase">
              Lyrics & Details
            </span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </button>
        </div>

        {/* SECTION 2 & BEYOND: SCROLLABLE CONTENT (Lyrics Card, Artist Card, Description) */}
        <div ref={lyricsSectionRef} className="max-w-md md:max-w-xl mx-auto px-4 sm:px-6 pt-4 pb-16 space-y-8 w-full">
          {/* SECTION 2: REAL DYNAMIC LYRICS CARD */}
          <div 
            className="rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 backdrop-blur-xl border transition-colors duration-300"
            style={{
              backgroundColor: dominantTheme?.cardBg || 'rgba(30, 41, 59, 0.4)',
              borderColor: dominantTheme?.cardBorder || 'rgba(255, 255, 255, 0.12)'
            }}
          >
            {/* Header: Lyrics + Full Screen Button + Share + Show/Hide */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  Lyrics
                </h3>
                {lyricsLines.length > 0 && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/15 text-white">
                    {lyricsSource}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 sm:gap-2.5">
                {/* Full Screen Lyrics Button */}
                <button 
                  onClick={() => setIsFullScreenLyricsOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-all cursor-pointer hover:scale-105 active:scale-95 border border-white/10"
                  title="View Lyrics in Full Screen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Full Screen</span>
                </button>

                <button 
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    useAuthStore.getState().setToast(`Copied link for "${currentTrack.title}"!`);
                  }}
                  className="p-1.5 text-white/80 hover:text-white transition-colors"
                  title="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                <button 
                  onClick={() => setShowLyricsFull(!showLyricsFull)}
                  className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {showLyricsFull ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Line Synced Real Lyrics (Smooth Internal Scroll, Fixed Compact Size, Lag-free) */}
            {showLyricsFull && (
              <div 
                ref={lyricsCardScrollRef}
                onWheel={handleLyricsCardScroll}
                onTouchMove={handleLyricsCardScroll}
                className="space-y-1 pt-1 max-h-72 sm:max-h-80 overflow-y-auto hide-scrollbar"
                style={{
                  overscrollBehavior: 'contain',
                  willChange: 'scroll-position',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {lyricsLoading ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-white/70">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Fetching lyrics...</span>
                  </div>
                ) : lyricsLines.length === 0 ? (
                  <div className="py-10 text-center space-y-2 text-white/70">
                    <Music2 className="w-8 h-8 mx-auto opacity-50" />
                    <p className="text-sm font-semibold">Lyrics not available for this song</p>
                    <p className="text-xs text-white/50">Enjoy the music or explore other tracks</p>
                  </div>
                ) : (
                  <CardLyricsList
                    lyricsLines={lyricsLines}
                    currentLineIndex={currentLineIndex}
                    onSeek={handleSeekLyric}
                  />
                )}
              </div>
            )}

            {/* Watermark: Source attribution */}
            <div className="pt-3 text-right border-t border-white/10">
              <p className="text-[11px] font-medium text-white/70 leading-tight">
                {lyricsLines.length > 0 ? "Line Synchronized" : "Instrumental or Unverified"}
              </p>
              <p className="text-[11px] font-medium text-white/50 leading-tight">
                {lyricsLines.length > 0 ? `Lyrics provided via ${lyricsSource}` : "VibeMusic"}
              </p>
            </div>
          </div>

          {/* SECTION 3: ARTISTS CARD (Real Artist Photo & Profile) */}
          <div 
            onClick={handleOpenArtist}
            className="rounded-3xl overflow-hidden shadow-2xl relative border border-white/10 cursor-pointer group transition-all duration-1000 hover:scale-[1.01]"
            style={{
              backgroundColor: dominantTheme?.cardBg || '#18181c'
            }}
          >
            <div className="relative aspect-[16/10] w-full bg-neutral-900">
              <img
                src={artistPhoto || '/default_artist.png'}
                alt={artistName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top sm:object-[center_15%] group-hover:scale-105 transition-transform duration-500 filter brightness-95"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith('/default_artist.png')) {
                    target.src = '/default_artist.png';
                  }
                }}
              />
              <span className="absolute top-4 left-4 text-xs uppercase font-extrabold tracking-wider bg-black/60 px-3 py-1 rounded-full text-white backdrop-blur-md">
                Artists
              </span>
              <span className="absolute bottom-4 right-4 text-xs font-bold tracking-wide bg-white text-black px-3 py-1 rounded-full shadow-md">
                View Profile & Songs →
              </span>
            </div>
            <div className="p-5 flex items-center justify-between bg-black/40 backdrop-blur-md">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-white/20 shadow-md flex-shrink-0 bg-neutral-800">
                  <img
                    src={artistPhoto || '/default_artist.png'}
                    alt={artistName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.endsWith('/default_artist.png')) {
                        target.src = '/default_artist.png';
                      }
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg font-bold text-white tracking-tight truncate">
                    {primaryArtist}
                  </h4>
                  <p className="text-xs text-neutral-300 font-medium">
                    {artistSubscribers || trackDetails?.subscribers || "Tap to view artist details and all songs"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: REAL STATS & DESCRIPTION CARD */}
          <div 
            className="rounded-3xl p-6 shadow-2xl space-y-3 text-white backdrop-blur-xl border transition-colors duration-300"
            style={{
              backgroundColor: dominantTheme?.cardBg || 'rgba(30, 41, 59, 0.4)',
              borderColor: dominantTheme?.cardBorder || 'rgba(255, 255, 255, 0.12)'
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white/95">
                {trackDetails?.published || currentTrack.published || "Provided to YouTube Music"}
              </p>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                {currentTrack.source || "YouTube Music"}
              </span>
            </div>

            <h4 className="text-2xl font-black text-white tracking-tight">
              {trackDetails?.viewCount ? `${trackDetails.viewCount} views` : (currentTrack.viewCount ? `${currentTrack.viewCount} views` : "Official Track")}
            </h4>
            <p className="text-xs text-white/70 font-medium">
              High Definition Stream (256kbps audio)
            </p>

            <div className="pt-3 border-t border-white/15 space-y-1">
              <p className="text-sm font-bold text-white">Description</p>
              <p className={`text-xs text-white/80 leading-relaxed ${showFullDescription ? '' : 'line-clamp-2'}`}>
                {trackDetails?.description || currentTrack.description || `${currentTrack.title} performed by ${artistName}. Streamed in real-time.`}
              </p>
            </div>

            <button 
              onClick={() => setShowFullDescription(!showFullDescription)}
              className="pt-2 text-xs font-bold text-white underline hover:text-white/80 transition-colors cursor-pointer"
            >
              {showFullDescription ? "Show Less" : "Show More"}
            </button>
          </div>
        </div>
      </div>

      {/* DEDICATED FULL SCREEN LYRICS MODAL */}
      {isFullScreenLyricsOpen && (
        <FullScreenLyrics
          key={currentTrack.videoId}
          track={currentTrack}
          lyricsLines={lyricsLines}
          lyricsLoading={lyricsLoading}
          lyricsSource={lyricsSource}
          currentLineIndex={currentLineIndex}
          progress={progress}
          duration={trackDuration}
          isPlaying={isPlaying}
          isLoading={isLoading}
          dominantTheme={dominantTheme}
          onClose={handleCloseFullScreenLyrics}
          onSeek={handleSeekLyric}
          onTogglePlay={togglePlay}
          onNext={handleNextTrack}
          onPrev={handlePrevTrack}
        />
      )}
    </>
  );
}
