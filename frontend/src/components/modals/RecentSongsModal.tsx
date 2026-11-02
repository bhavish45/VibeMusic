"use client";

import { useEffect, useRef, memo, useCallback, useMemo, useState } from 'react';
import { 
  History, 
  X, 
  Play, 
  Trash2, 
  Heart, 
  Clock, 
  Sparkles 
} from 'lucide-react';
import { usePlayerStore, Track } from '@/store/playerStore';
import { useAuthStore } from '@/store/authStore';
import MusicPoster from '@/components/ui/MusicPoster';
import SongActionMenu from '@/components/ui/SongActionMenu';
import { attachSmoothWheel } from '@/lib/smoothScroll';

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Memoized individual recent song row with CSS containment for locked high-FPS scrolling
interface RecentSongRowProps {
  track: Track;
  lastPlayed: number;
  isCurrent: boolean;
  isPlaying: boolean;
  liked: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
  onOpenArtist: (artist: string) => void;
}

const RecentSongRow = memo(function RecentSongRow({
  track,
  lastPlayed,
  isCurrent,
  isPlaying,
  liked,
  onPlay,
  onToggleFavorite,
  onRemove,
  onOpenArtist
}: RecentSongRowProps) {
  const primaryArtist = track.artists?.[0]
    ? (typeof track.artists[0] === 'string' ? track.artists[0] : track.artists[0].name)
    : 'Unknown Artist';

  return (
    <div
      style={{
        contain: 'paint',
        contentVisibility: 'auto',
        containIntrinsicSize: '64px'
      }}
      className={`group flex items-center justify-between p-2 sm:p-2.5 rounded-xl transition-all duration-150 cursor-pointer ${
        isCurrent 
          ? 'bg-teal-500/10 border border-teal-500/20' 
          : 'hover:bg-white/5 border border-transparent'
      }`}
      onClick={onPlay}
    >
      {/* Left: Thumbnail, Track Title, Artist */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-neutral-900 shrink-0">
          <MusicPoster
            src={track.poster || track.thumbnails?.[0]?.url || track.fallbackPoster}
            fallbackSrc={track.fallbackPoster}
            videoId={track.videoId}
            alt={track.title}
            className="w-full h-full object-cover"
          />
          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}>
            {isCurrent && isPlaying ? (
              <div className="flex items-end gap-[2px] h-3">
                <span className="w-1 bg-teal-400 rounded-full animate-wave-1" />
                <span className="w-1 bg-teal-400 rounded-full animate-wave-2" />
                <span className="w-1 bg-teal-400 rounded-full animate-wave-3" />
              </div>
            ) : (
              <Play className="w-4 h-4 text-white fill-current ml-0.5" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 pr-2">
          <p className={`text-sm font-semibold truncate ${
            isCurrent ? 'text-teal-400' : 'text-white'
          }`}>
            {track.title}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenArtist(primaryArtist);
              }}
              className="hover:text-white truncate hover:underline"
            >
              {primaryArtist}
            </button>
            <span>•</span>
            <span className="shrink-0 text-[11px] text-neutral-500">
              {formatRelativeTime(lastPlayed)}
            </span>
          </div>
        </div>
      </div>

      {/* Right Actions: Favorite, 3-Dots Options Menu, Remove from history */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title={liked ? "Remove from Favorites" : "Save to Favorites"}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
        </button>

        <SongActionMenu
          track={track}
          buttonClassName="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          iconClassName="w-4 h-4"
          title="Song Options"
        />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/10 text-neutral-500 hover:text-red-400 transition-all cursor-pointer"
          title="Remove from history"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default function RecentSongsModal() {
  const isRecentSongsOpen = usePlayerStore(s => s.isRecentSongsOpen);
  const closeRecentSongs = usePlayerStore(s => s.closeRecentSongs);
  const playHistory = usePlayerStore(s => s.playHistory);
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrackId = usePlayerStore(s => s.currentTrack?.videoId);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const isFavorite = usePlayerStore(s => s.isFavorite);
  const toggleFavorite = usePlayerStore(s => s.toggleFavorite);
  const clearPlayHistory = usePlayerStore(s => s.clearPlayHistory);
  const removeFromPlayHistory = usePlayerStore(s => s.removeFromPlayHistory);
  const openArtistModal = usePlayerStore(s => s.openArtistModal);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isRecentSongsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showClearConfirm) {
          setShowClearConfirm(false);
        } else {
          closeRecentSongs();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecentSongsOpen, showClearConfirm, closeRecentSongs]);

  // Butter-smooth hardware-accelerated kinetic wheel scroll
  useEffect(() => {
    if (!isRecentSongsOpen || !scrollContainerRef.current) return;
    return attachSmoothWheel(scrollContainerRef.current);
  }, [isRecentSongsOpen, playHistory.length]);

  const allHistoryTracks = useMemo(
    () => playHistory.map(h => h.track),
    [playHistory]
  );

  const handlePlayAll = useCallback(() => {
    if (allHistoryTracks.length > 0) {
      playTrack(allHistoryTracks[0], allHistoryTracks);
    }
  }, [allHistoryTracks, playTrack]);

  const handleClearAll = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const handleConfirmClearAll = useCallback(() => {
    clearPlayHistory();
    setShowClearConfirm(false);
    useAuthStore.getState().setToast('Listening history cleared.', 'info');
  }, [clearPlayHistory]);

  const handlePlayTrack = useCallback((track: Track) => {
    playTrack(track, allHistoryTracks);
  }, [playTrack, allHistoryTracks]);

  const handleOpenArtist = useCallback((artist: string) => {
    openArtistModal(artist);
    closeRecentSongs();
  }, [openArtistModal, closeRecentSongs]);

  if (!isRecentSongsOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={closeRecentSongs}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[82vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
              <History className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Recent Songs
                </h2>
                <span className="text-[11px] font-semibold bg-white/10 text-neutral-300 px-2 py-0.5 rounded-full">
                  {playHistory.length}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Tracks you recently listened to
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {playHistory.length > 0 && (
              <>
                <button
                  onClick={handlePlayAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-colors cursor-pointer"
                  title="Play all recent songs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play All</span>
                </button>

                <button
                  onClick={handleClearAll}
                  className="p-2 rounded-full hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              onClick={closeRecentSongs}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: List of Recent Songs with High-FPS Hardware Accelerated Scroll */}
        <div 
          ref={scrollContainerRef}
          style={{
            overscrollBehavior: 'contain',
            willChange: 'scroll-position',
            WebkitOverflowScrolling: 'touch'
          }}
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 space-y-1 hide-scrollbar"
        >
          {playHistory.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-neutral-500 mb-4">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                No listening history yet
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mb-6">
                Songs you play will appear here so you can easily jump back to your favorite vibes anytime.
              </p>
              <button
                onClick={closeRecentSongs}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span>Start Listening</span>
              </button>
            </div>
          ) : (
            playHistory.map((item, index) => {
              const track = item.track;
              const isCurrent = currentTrackId === track.videoId;
              const liked = isFavorite(track.videoId);

              return (
                <RecentSongRow
                  key={`${track.videoId}-${index}`}
                  track={track}
                  lastPlayed={item.lastPlayed}
                  isCurrent={isCurrent}
                  isPlaying={isPlaying}
                  liked={liked}
                  onPlay={() => handlePlayTrack(track)}
                  onToggleFavorite={() => toggleFavorite(track)}
                  onRemove={() => removeFromPlayHistory(track.videoId)}
                  onOpenArtist={handleOpenArtist}
                />
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        {playHistory.length > 0 && (
          <div className="px-5 py-3 border-t border-white/5 bg-black/30 flex items-center justify-between text-xs text-neutral-500">
            <span>Click any song to play sequential recent queue</span>
            <span className="hidden sm:inline">Press Esc to close</span>
          </div>
        )}
      </div>

      {/* Clear Listening History Confirmation Modal */}
      {showClearConfirm && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setShowClearConfirm(false);
          }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#18181c] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center animate-in zoom-in-95 duration-150"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Clear Listening History?</h3>
              <p className="text-xs text-neutral-400">
                Are you sure you want to clear your recently played songs? This will remove all {playHistory.length} tracks from your history.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition-all cursor-pointer"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


