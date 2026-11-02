"use client";

import { useState, useRef, useEffect } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { 
  Play, 
  Pause, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Heart, 
  X, 
  Loader2,
  Mic2,
  ListMusic
} from 'lucide-react';
import { SkipBackIcon, SkipForwardIcon } from '@/components/ui/PlayerIcons';
import { audioPlayer } from '@/lib/audioPlayer';
import MusicPoster from '@/components/ui/MusicPoster';
import ExpandedPlayer from './ExpandedPlayer';
import QueueDrawer from './QueueDrawer';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Running Marquee component: When song title exceeds space, it runs smoothly to the left
function MarqueeTitle({ text, className = "" }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowDistance, setOverflowDistance] = useState(0);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const diff = textRef.current.scrollWidth - containerRef.current.clientWidth;
        if (diff > 4) {
          setOverflowDistance(diff + 16);
        } else {
          setOverflowDistance(0);
        }
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  const duration = Math.max(6, Math.min(18, overflowDistance / 20));

  return (
    <div ref={containerRef} className="overflow-hidden whitespace-nowrap relative w-full">
      <span
        ref={textRef}
        style={
          overflowDistance > 0
            ? ({
                '--marquee-distance': `-${overflowDistance}px`,
                '--marquee-duration': `${duration}s`,
              } as React.CSSProperties)
            : undefined
        }
        className={`${className} ${overflowDistance > 0 ? 'animate-marquee-running' : 'truncate block'}`}
      >
        {text}
      </span>
    </div>
  );
}

export default function MiniPlayer() {
  const { 
    currentTrack, 
    isPlaying, 
    isLoading,
    progress, 
    volume, 
    isShuffled, 
    repeatMode,
    isExpanded,
    isFullScreenLyricsOpen,
    isQueueOpen,
    toggleShuffle,
    toggleRepeat,
    setIsExpanded,
    setIsFullScreenLyricsOpen,
    setIsQueueOpen,
    clearQueue,
    isFavorite,
    toggleFavorite,
    openArtistModal,
    activeArtistModal
  } = usePlayerStore();

  const [isMounted, setIsMounted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    usePlayerStore.getState().initPersistedState?.();
  }, []);

  // Hidden strictly in full screen player page and full screen lyrics page
  const isHidden = isExpanded || isFullScreenLyricsOpen;

  if (!isMounted || !currentTrack) return null;

  const isLiked = isFavorite(currentTrack.videoId);

  const trackDuration = currentTrack.duration && currentTrack.duration > 0 
    ? currentTrack.duration 
    : 127;

  const progressPercent = Math.min(100, Math.max(0, (progress / trackDuration) * 100));

  const togglePlay = () => {
    if (isPlaying) {
      audioPlayer.pause();
    } else {
      audioPlayer.play();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    audioPlayer.seek(ratio * trackDuration);
  };

  const toggleMute = () => {
    if (isMuted) {
      audioPlayer.setVolume(prevVolume || 0.8);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      audioPlayer.setVolume(0);
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    audioPlayer.setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  return (
    <>
      {/* Bottom Player Bar - Visible in each page except in full screen player page and in full screen lyrics page */}
      {!isHidden && (
        <div 
          className={`fixed ${activeArtistModal ? 'bottom-0' : 'bottom-16 md:bottom-0'} left-0 right-0 h-20 bg-black/95 border-t border-white/10 flex items-center justify-between px-4 sm:px-6 z-[70] backdrop-blur-xl select-none`}
        >
        {/* Left: Poster & Track Info (Fixed width slot so it NEVER shifts center controls) */}
        <div 
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-3 sm:gap-3.5 w-[28%] md:w-[26%] max-w-[320px] min-w-0 cursor-pointer group z-10"
        >
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow-md">
            <MusicPoster 
              key={currentTrack.videoId}
              src={currentTrack.poster || currentTrack.thumbnails?.[0]?.url}
              fallbackSrc={currentTrack.fallbackPoster}
              videoId={currentTrack.videoId}
              alt={currentTrack.title}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
            />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            {/* Running marquee title if long */}
            <MarqueeTitle
              text={currentTrack.title}
              className="text-sm font-bold text-white group-hover:text-[#00d2c4] transition-colors leading-tight"
            />
            
            <span 
              onClick={(e) => {
                e.stopPropagation();
                const primaryA = currentTrack.artists?.[0];
                const aName = (typeof primaryA === 'string' ? primaryA : primaryA?.name) || 'Unknown Artist';
                const aId = typeof primaryA === 'object' ? primaryA?.id : undefined;
                openArtistModal({
                  name: aName,
                  id: aId,
                  avatar: currentTrack.poster || currentTrack.thumbnails?.[0]?.url
                });
              }}
              className="text-xs text-[#8e8e93] hover:text-white truncate mt-0.5 leading-tight cursor-pointer"
              title="View Artist"
            >
              {currentTrack.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ') || 'Unknown Artist'}
            </span>
          </div>
        </div>

        {/* Center: Playback Controls & Scrubber (ABSOLUTELY PINNED to exact horizontal 50% dead center) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl px-2 sm:px-4 z-20 pointer-events-none">
          <div className="flex flex-col items-center justify-center w-full">
            {/* Controls Row */}
            <div className="flex items-center gap-4 sm:gap-6 pointer-events-auto">
              {/* Shuffle */}
              <button 
                onClick={toggleShuffle}
                className={`p-1.5 transition-colors hidden sm:block ${
                  isShuffled ? 'text-[#00d2c4]' : 'text-[#8e8e93] hover:text-white'
                }`}
                title="Shuffle"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              {/* Prev */}
              <button 
                onClick={() => usePlayerStore.getState().prevTrack()}
                className="p-1 text-[#d4d4d8] hover:text-white transition-colors hover:scale-110 active:scale-95 cursor-pointer"
                title="Previous"
              >
                <SkipBackIcon className="w-5 h-5" />
              </button>

              {/* Play / Pause */}
              <button 
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              {/* Next */}
              <button 
                onClick={() => usePlayerStore.getState().nextTrack()}
                className="p-1 text-[#d4d4d8] hover:text-white transition-colors hover:scale-110 active:scale-95 cursor-pointer"
                title="Next"
              >
                <SkipForwardIcon className="w-5 h-5" />
              </button>

              {/* Repeat */}
              <button 
                onClick={toggleRepeat}
                className={`p-1.5 transition-colors hidden sm:block ${
                  repeatMode !== 'off' ? 'text-[#00d2c4]' : 'text-[#8e8e93] hover:text-white'
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

            {/* Progress Bar & Timestamps Row */}
            <div className="w-full flex items-center gap-2.5 mt-1 pointer-events-auto">
              <span className="text-[11px] font-mono text-[#8e8e93] w-10 text-right flex-shrink-0">
                {formatTime(progress)}
              </span>

              {/* Interactive Scrubber Track with Thumb */}
              <div 
                ref={progressBarRef}
                onClick={handleSeek}
                className="group relative flex-1 h-3 flex items-center cursor-pointer"
              >
                <div className="w-full h-1 bg-[#333338] rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-75"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div 
                  className="absolute w-3 h-3 bg-white rounded-full shadow-md -translate-x-1/2 pointer-events-none group-hover:scale-125 transition-transform"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>

              <span className="text-[11px] font-mono text-[#8e8e93] w-10 text-left flex-shrink-0">
                {formatTime(trackDuration)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Heart (Left), Queue (Next Right), Lyrics, Fullscreen Expand, Volume, Close */}
        <div className="flex items-center gap-2.5 sm:gap-4 justify-end w-[28%] md:w-[26%] max-w-[320px] min-w-0 z-10 ml-auto">

          {/* Heart / Favorite (Positioned to Left) */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(currentTrack);
            }}
            className={`p-1.5 transition-colors cursor-pointer ${
              isLiked ? 'text-red-500' : 'text-[#8e8e93] hover:text-white'
            }`}
            title={isLiked ? "Remove Favorite" : "Add Favorite"}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>

          {/* Playback Queue Button (Next Right to Favorite) */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsQueueOpen(!isQueueOpen);
            }}
            className={`p-1.5 transition-colors cursor-pointer ${
              isQueueOpen ? 'text-[#00d2c4]' : 'text-[#8e8e93] hover:text-white'
            }`}
            title="Queue"
          >
            <ListMusic className="w-4 h-4" />
          </button>

          {/* Full Screen Lyrics */}
          <button 
            onClick={() => {
              setIsExpanded(true);
              setIsFullScreenLyricsOpen(true);
            }}
            className="p-1.5 text-[#8e8e93] hover:text-white transition-colors cursor-pointer"
            title="Lyrics (Full Screen)"
          >
            <Mic2 className="w-4 h-4" />
          </button>

          {/* Fullscreen Expand */}
          <button 
            onClick={() => {
              setIsFullScreenLyricsOpen(false);
              setIsExpanded(true);
            }}
            className="p-1.5 text-[#8e8e93] hover:text-white transition-colors cursor-pointer"
            title="Open Full Screen Player"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Volume Control */}
          <div className="hidden lg:flex items-center gap-2">
            <button 
              onClick={toggleMute}
              className="text-[#8e8e93] hover:text-white transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-18 h-1 bg-[#333338] accent-white rounded-lg cursor-pointer"
            />
          </div>

          {/* Dismiss Player */}
          <button 
            onClick={clearQueue}
            className="p-1.5 text-[#8e8e93] hover:text-white transition-colors hidden sm:block cursor-pointer"
            title="Close Player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      )}

      {/* Expanded Fullscreen Player */}
      {isExpanded && <ExpandedPlayer />}

      {/* Queue Drawer */}
      {isQueueOpen && <QueueDrawer />}
    </>
  );
}
