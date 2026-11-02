"use client";

import { useMemo, memo, useEffect } from 'react';
import { usePlayerStore, Track } from '@/store/playerStore';
import { audioPlayer } from '@/lib/audioPlayer';
import { X, ListMusic, Music } from 'lucide-react';
import MusicPoster from '@/components/ui/MusicPoster';
import SongActionMenu from '@/components/ui/SongActionMenu';

// Memoized individual queue row for locked 60fps/120fps scrolling
const QueueTrackRow = memo(function QueueTrackRow({
  track,
  targetQueueIndex,
  onPlay,
  onRemove
}: {
  track: Track;
  targetQueueIndex: number;
  onPlay: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div 
      style={{
        contain: 'paint',
        contentVisibility: 'auto',
        containIntrinsicSize: '58px'
      }}
      className="group relative flex items-center justify-between p-2.5 rounded-xl hover:bg-[#18181c] transition-colors cursor-pointer border border-transparent hover:border-white/5"
      onClick={() => onPlay(targetQueueIndex)}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Thumbnail Artwork (Clean, no play overlay) */}
        <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-900 border border-white/5">
          <MusicPoster 
            src={track.poster || track.thumbnails?.[0]?.url}
            fallbackSrc={track.fallbackPoster}
            videoId={track.videoId}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Track Details */}
        <div className="flex-1 min-w-0 pr-2">
          <h5 className="text-sm font-semibold text-white truncate group-hover:text-neutral-100 transition-colors">
            {track.title}
          </h5>
          <p className="text-xs text-[#8e8e93] hover:text-white truncate mt-0.5 transition-colors">
            {track.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ')}
          </p>
        </div>
      </div>

      {/* 3-Dots Action Menu on Hover */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
      >
        <SongActionMenu
          track={track}
          buttonClassName="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          iconClassName="w-4 h-4"
          title="Song Options"
          onRemoveFromQueue={() => onRemove(targetQueueIndex)}
        />
      </div>
    </div>
  );
});

export default function QueueDrawer() {
  // Selective store subscriptions: strictly excludes `progress` so 4x/sec audio updates NEVER cause queue lag or scroll stutter
  const queue = usePlayerStore(s => s.queue);
  const queueIndex = usePlayerStore(s => s.queueIndex);
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const isExpanded = usePlayerStore(s => s.isExpanded);
  const playQueueIndex = usePlayerStore(s => s.playQueueIndex);
  const removeFromQueue = usePlayerStore(s => s.removeFromQueue);
  const setIsQueueOpen = usePlayerStore(s => s.setIsQueueOpen);

  const upNextTracks = useMemo(
    () => queue.slice(Math.max(0, queueIndex + 1)),
    [queue, queueIndex]
  );

  // Proactively ensure queue never ends by replenishing similar songs in background
  useEffect(() => {
    if (upNextTracks.length <= 4 && currentTrack) {
      audioPlayer.ensureAutoplayQueue();
    }
  }, [upNextTracks.length, currentTrack]);

  return (
    <>
      {/* Click-away backdrop overlay: ZERO blur, website remains 100% sharp */}
      <div 
        onClick={() => setIsQueueOpen(false)}
        className="fixed inset-0 z-[88] bg-black/20 animate-in fade-in duration-150"
        aria-hidden="true"
      />

      {/* Queue Drawer Container: Pure dark background matching Settings */}
      <div 
        className={`fixed top-0 right-0 w-full sm:w-[400px] bg-black border-l border-white/10 z-[90] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 select-none ${
          isExpanded ? 'bottom-0' : 'bottom-20 md:bottom-20'
        }`}
      >
        {/* Header (No Clear button, No song counter) */}
        <div className="sticky top-0 z-10 bg-black/95 border-b border-white/10 p-4 sm:px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00d2c4]/10 border border-[#00d2c4]/30 flex items-center justify-center text-[#00d2c4] shrink-0">
              <ListMusic className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-white">Playback Queue</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsQueueOpen(false)}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Close queue"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Queue Content with Hardware Accelerated Scroll Layer */}
        <div 
          style={{
            overscrollBehavior: 'contain',
            willChange: 'scroll-position',
            WebkitOverflowScrolling: 'touch'
          }}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 hide-scrollbar"
        >
          {/* Currently Playing Card (Styled identical to Library recent playing song) */}
          {currentTrack && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#00d2c4] block">
                Now Playing
              </span>

              <div className="group relative flex items-center justify-between p-2.5 rounded-xl bg-[#18181c] border border-transparent hover:border-white/5 transition-colors cursor-pointer">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Thumbnail Artwork with Running Wave Style Animation */}
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-900 border border-white/5">
                    <MusicPoster 
                      src={currentTrack.poster || currentTrack.thumbnails?.[0]?.url}
                      fallbackSrc={currentTrack.fallbackPoster}
                      videoId={currentTrack.videoId}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />

                    {/* Running Soundwave Effect like Library Section */}
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-0.5">
                        <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-1" />
                        <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-2" />
                        <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-3" />
                      </div>
                    )}
                  </div>
                  
                  {/* Track Details: Teal Title & Gray Artist */}
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="text-sm font-semibold text-[#00d2c4] truncate transition-colors">
                      {currentTrack.title}
                    </h4>
                    <p className="text-xs text-[#8e8e93] hover:text-white truncate mt-0.5 transition-colors">
                      {currentTrack.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ')}
                    </p>
                  </div>
                </div>

                {/* 3-Dots Action Menu */}
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 ml-2"
                >
                  <SongActionMenu
                    track={currentTrack}
                    buttonClassName="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    iconClassName="w-4 h-4"
                    title="Song Options"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Up Next List (No song counter) */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Up Next
            </span>

            {upNextTracks.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <Music className="w-8 h-8 text-neutral-600 mx-auto" />
                <p className="text-xs font-medium text-neutral-400">
                  Queue is empty
                </p>
                <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                  Add songs from search, albums, or playlists to build your queue.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {upNextTracks.map((track, relativeIdx) => {
                  const targetQueueIndex = queueIndex + 1 + relativeIdx;
                  return (
                    <QueueTrackRow
                      key={`${track.videoId}-${targetQueueIndex}`}
                      track={track}
                      targetQueueIndex={targetQueueIndex}
                      onPlay={playQueueIndex}
                      onRemove={removeFromQueue}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
