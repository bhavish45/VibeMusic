"use client";

import { useRef, useEffect, useState, memo, useCallback } from 'react';
import { 
  Minimize2, 
  Play, 
  Pause, 
  Shuffle,
  Repeat,
  Repeat1,
  Loader2,
  Music2,
  Compass
} from 'lucide-react';
import { SkipBackIcon, SkipForwardIcon } from '@/components/ui/PlayerIcons';
import { LyricLine } from '@/lib/lyricsService';
import { DominantColor } from '@/lib/colorExtractor';
import { Track, usePlayerStore } from '@/store/playerStore';
import { useSettingsStore } from '@/store/settingsStore';
import MusicPoster from '@/components/ui/MusicPoster';
import SmoothBackground from '@/components/ui/SmoothBackground';
import { smoothScrollTo, cancelSmoothScroll } from '@/lib/smoothScroll';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

interface FullScreenLyricsProps {
  track: Track;
  lyricsLines: LyricLine[];
  lyricsLoading: boolean;
  lyricsSource: string;
  currentLineIndex: number;
  progress: number;
  duration: number;
  isPlaying: boolean;
  isLoading: boolean;
  dominantTheme: DominantColor | null;
  onClose: () => void;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
}

// Memoized individual lyric line for locked 60fps/120fps GPU rendering
// Uses constant font metrics + GPU scale transform to eliminate layout reflow / stutter
const FullScreenLyricRow = memo(function FullScreenLyricRow({
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
    <div
      data-lyric-index={index}
      onClick={handleClick}
      style={{
        transform: isCurrent ? 'scale(1)' : 'scale(0.90)',
        transformOrigin: 'left center',
        willChange: 'transform, opacity',
      }}
      className={`cursor-pointer py-3 sm:py-3.5 px-3 rounded-xl select-text transition-all duration-300 ease-out group ${
        isCurrent
          ? 'text-white font-extrabold text-2xl sm:text-3xl md:text-4xl opacity-100'
          : 'text-white font-bold text-2xl sm:text-3xl md:text-4xl opacity-35 hover:opacity-75'
      }`}
    >
      <p className="leading-tight sm:leading-snug transition-transform duration-200 group-hover:translate-x-1">
        {line.text}
      </p>
    </div>
  );
});

// Memoized lyrics list so audio progress updates (4x/sec) do not re-render all lines
const FullScreenLyricsList = memo(function FullScreenLyricsList({
  lyricsLines,
  currentLineIndex,
  onSeek
}: {
  lyricsLines: LyricLine[];
  currentLineIndex: number;
  onSeek: (time: number) => void;
}) {
  return (
    <div className="space-y-1 sm:space-y-2 py-[25vh]">
      {lyricsLines.map((line, i) => (
        <FullScreenLyricRow 
          key={`fs-lyric-${i}`}
          line={line}
          index={i}
          isCurrent={i === currentLineIndex}
          onClick={onSeek}
        />
      ))}
    </div>
  );
});

export default function FullScreenLyrics({
  track,
  lyricsLines,
  lyricsLoading,
  lyricsSource,
  currentLineIndex,
  progress,
  duration,
  isPlaying,
  isLoading,
  dominantTheme,
  onClose,
  onSeek,
  onTogglePlay,
  onNext,
  onPrev
}: FullScreenLyricsProps) {
  const { isShuffled, repeatMode, toggleShuffle, toggleRepeat } = usePlayerStore();
  const { autoScrollLyrics } = useSettingsStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const prevLineRef = useRef<number>(-1);

  const artistName = track.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ') || 'Unknown Artist';
  const progressPercent = Math.min(100, Math.max(0, (progress / (duration || 180)) * 100));

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Reset scroll and state when track changes on Next/Prev
  useEffect(() => {
    if (scrollContainerRef.current) {
      cancelSmoothScroll(scrollContainerRef.current);
      scrollContainerRef.current.scrollTop = 0;
    }
    setUserScrolled(false);
    prevLineRef.current = -1;
  }, [track?.videoId]);

  // Center active lyric line with hardware-accelerated RAF smooth scrolling (locked 60fps/120fps)
  useEffect(() => {
    if (userScrolled || currentLineIndex < 0 || !autoScrollLyrics) return;
    if (prevLineRef.current === currentLineIndex) return;
    prevLineRef.current = currentLineIndex;

    const container = scrollContainerRef.current;
    if (!container) return;

    const activeEl = container.querySelector<HTMLElement>(`[data-lyric-index="${currentLineIndex}"]`);
    if (!activeEl) return;

    const containerHeight = container.clientHeight;
    const targetScroll = activeEl.offsetTop - (containerHeight / 2) + (activeEl.clientHeight / 2);

    smoothScrollTo(container, Math.max(0, targetScroll), 400);
  }, [currentLineIndex, userScrolled, autoScrollLyrics]);

  const handleUserScroll = useCallback(() => {
    cancelSmoothScroll(scrollContainerRef.current);
    setUserScrolled(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      setUserScrolled(false);
    }, 4500);
  }, []);

  const resumeSync = useCallback(() => {
    setUserScrolled(false);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    prevLineRef.current = -1;
    const container = scrollContainerRef.current;
    if (!container || currentLineIndex < 0) return;
    const activeEl = container.querySelector<HTMLElement>(`[data-lyric-index="${currentLineIndex}"]`);
    if (!activeEl) return;
    const targetScroll = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
    smoothScrollTo(container, Math.max(0, targetScroll), 400);
  }, [currentLineIndex]);

  const handleSeekLyric = useCallback((time: number) => {
    onSeek(time);
  }, [onSeek]);

  const handleSeekFromClientX = useCallback((clientX: number) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * (duration || 180));
  }, [duration, onSeek]);

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleSeekFromClientX(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleSeekFromClientX(moveEvent.clientX);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const currentGradient = dominantTheme
    ? `linear-gradient(180deg, ${dominantTheme.topGradient} 0%, ${dominantTheme.midGradient} 50%, #0a0a0c 100%)`
    : 'linear-gradient(180deg, #1e293b 0%, #0f172a 50%, #0a0a0c 100%)';

  return (
    <div 
      className="fixed inset-0 z-[85] overflow-hidden flex flex-col justify-between text-white animate-in fade-in duration-300 select-none"
    >
      {/* Smooth Seamless Crossfading Dynamic Ambient Background with Ambient Glow */}
      <SmoothBackground 
        trackKey={track.videoId}
        gradient={currentGradient} 
        glowColor={dominantTheme?.topGradient || '#38bdf8'}
        durationMs={700}
      />

      {/* Top Header Bar */}
      <header className="relative z-10 flex items-center justify-between p-4 sm:p-6 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden shadow-md flex-shrink-0 border border-white/10">
            <MusicPoster 
              key={track.videoId}
              src={track.poster || track.thumbnails?.[0]?.url}
              fallbackSrc={track.fallbackPoster}
              videoId={track.videoId}
              alt={track.title}
              className="w-full h-full object-cover object-center"
            />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate leading-snug">
              {track.title}
            </h2>
            <p 
              onClick={() => {
                const primaryA = track.artists?.[0];
                const primaryId = typeof primaryA === 'object' ? primaryA?.id : undefined;
                usePlayerStore.getState().setIsFullScreenLyricsOpen(false);
                usePlayerStore.getState().setIsExpanded(false);
                usePlayerStore.getState().openArtistModal({
                  name: typeof primaryA === 'string' ? primaryA : primaryA?.name || artistName,
                  id: primaryId,
                  avatar: track.poster || track.thumbnails?.[0]?.url
                });
              }}
              className="text-xs sm:text-sm text-neutral-300 hover:text-white truncate cursor-pointer transition-colors"
              title={`View ${artistName}`}
            >
              {artistName}
            </p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {lyricsLines.length > 0 && (
            <span className="hidden sm:inline-flex text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/15 text-white/90 backdrop-blur-sm border border-white/10">
              {lyricsSource}
            </span>
          )}

          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95 border border-white/10"
            title="Exit Fullscreen (Esc)"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Lyrics Scroll Area */}
      <div 
        ref={scrollContainerRef}
        onWheel={handleUserScroll}
        onTouchMove={handleUserScroll}
        className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 md:px-16 py-12 max-w-4xl mx-auto w-full hide-scrollbar"
        style={{
          overscrollBehavior: 'contain',
          willChange: 'scroll-position',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {lyricsLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-white/70">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
            <p className="text-base font-semibold">Loading real-time lyrics...</p>
          </div>
        ) : lyricsLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center text-white/70">
            <Music2 className="w-12 h-12 opacity-50 mb-2" />
            <p className="text-xl font-bold text-white">Lyrics not available for this song</p>
            <p className="text-sm text-white/50 max-w-sm">
              We couldn't find synced lyrics for this track. Enjoy the music!
            </p>
          </div>
        ) : (
          <FullScreenLyricsList
            lyricsLines={lyricsLines}
            currentLineIndex={currentLineIndex}
            onSeek={handleSeekLyric}
          />
        )}
      </div>

      {/* Floating "Resume Sync" Button (Appears when user scrolls manually) */}
      {userScrolled && lyricsLines.length > 0 && (
        <div className="fixed bottom-28 right-6 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={resumeSync}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black font-bold text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Compass className="w-4 h-4 animate-spin text-black" />
            <span>Resume Sync</span>
          </button>
        </div>
      )}

      {/* Floating Bottom Mini-Controls Bar (Consistent with MiniPlayer and rest of website) */}
      <footer className="relative z-10 p-4 pb-6 sm:pb-8 flex justify-center">
        <div className="w-full max-w-lg bg-[#0e0e12]/85 backdrop-blur-2xl border border-white/10 rounded-2xl sm:rounded-3xl px-5 py-3.5 sm:px-6 sm:py-4 shadow-[0_16px_50px_rgba(0,0,0,0.8)] space-y-2.5">
          {/* Controls Row */}
          <div className="flex items-center justify-center gap-5 sm:gap-6">
            <button 
              onClick={toggleShuffle}
              className={`p-1.5 transition-colors cursor-pointer ${
                isShuffled ? 'text-[#00d2c4]' : 'text-neutral-400 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={onPrev}
              className="p-1.5 text-neutral-300 hover:text-white transition-colors hover:scale-110 active:scale-95 cursor-pointer"
              title="Previous"
            >
              <SkipBackIcon className="w-5 h-5" />
            </button>

            <button
              onClick={onTogglePlay}
              disabled={isLoading}
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current stroke-none" />
              ) : (
                <Play className="w-5 h-5 fill-current stroke-none ml-0.5" />
              )}
            </button>

            <button
              onClick={onNext}
              className="p-1.5 text-neutral-300 hover:text-white transition-colors hover:scale-110 active:scale-95 cursor-pointer"
              title="Next"
            >
              <SkipForwardIcon className="w-5 h-5" />
            </button>

            <button 
              onClick={toggleRepeat}
              className={`p-1.5 transition-colors cursor-pointer ${
                repeatMode !== 'off' ? 'text-[#00d2c4]' : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Time & Scrubber Bar Row */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[11px] font-mono text-neutral-400 w-10 text-right flex-shrink-0 select-none">
              {formatTime(progress)}
            </span>

            {/* Interactive Scrubber Track with Thumb */}
            <div 
              ref={progressBarRef}
              onMouseDown={handleProgressBarMouseDown}
              className="group relative flex-1 h-3 flex items-center cursor-pointer"
            >
              <div className="w-full h-1 group-hover:h-1.5 bg-white/20 rounded-full overflow-hidden transition-all duration-150 relative">
                <div 
                  className="h-full bg-white group-hover:bg-[#00d2c4] rounded-full transition-all duration-75"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div 
                className="absolute w-3 h-3 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.7)] -translate-x-1/2 pointer-events-none group-hover:scale-125 transition-transform duration-150"
                style={{ left: `${progressPercent}%` }}
              />
            </div>

            <span className="text-[11px] font-mono text-neutral-400 w-10 text-left flex-shrink-0 select-none">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
