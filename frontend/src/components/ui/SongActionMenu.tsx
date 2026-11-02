"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  MoreVertical, 
  CornerDownRight, 
  ListPlus, 
  FolderPlus, 
  Heart,
  Trash2,
  Download,
  Loader2
} from 'lucide-react';
import { usePlayerStore, Track } from '@/store/playerStore';
import { useAuthStore } from '@/store/authStore';
import { downloadSong, useDownloadStore } from '@/lib/downloadService';

interface SongActionMenuProps {
  track: Track;
  buttonClassName?: string;
  iconClassName?: string;
  title?: string;
  onRemoveFromQueue?: () => void;
}

export default function SongActionMenu({
  track,
  buttonClassName,
  iconClassName = "w-4 h-4",
  title = "More options",
  onRemoveFromQueue
}: SongActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    currentTrack,
    addToQueue,
    playNextInQueue,
    openAddToPlaylist,
    toggleFavorite,
    isFavorite,
    isDownloaded,
    removeDownloadedTrack
  } = usePlayerStore();

  const isDownloading = useDownloadStore((s) => s.isDownloading(track.videoId));
  const { setToast, isAuthenticated, openAuthModal } = useAuthStore();
  const isFav = isFavorite(track.videoId);
  const isDownloadedAlready = isDownloaded(track.videoId);
  const hasActivePlayback = Boolean(currentTrack);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const calculatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 215;
    const menuHeight = hasActivePlayback 
      ? (onRemoveFromQueue ? 320 : 270) 
      : (onRemoveFromQueue ? 230 : 185);

    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight) {
      top = Math.max(10, rect.top - menuHeight - 6);
    }

    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    setMenuCoords({ top, left });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isOpen) {
      calculatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Close on outside click, window resize, scroll, or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handlePlayNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    playNextInQueue(track);
    setToast(`Playing "${track.title}" next`, 'info');
    setIsOpen(false);
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(track);
    setToast(`Added "${track.title}" to queue`, 'info');
    setIsOpen(false);
  };

  const handleAddToPlaylist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal('login', 'Please sign in with your email to add songs to playlists.');
      setIsOpen(false);
      return;
    }
    openAddToPlaylist(track);
    setIsOpen(false);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(track);
    setToast(
      isFav ? `Removed from Favorites` : `Added "${track.title}" to Favorites`,
      isFav ? 'info' : 'success'
    );
    setIsOpen(false);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;
    setIsOpen(false);
    await downloadSong(track);
  };

  const handleRemoveDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteSong = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeDownloadedTrack(track.videoId);
    setToast(`Removed "${track.title}" from downloaded songs`, 'info');
    setShowDeleteConfirm(false);
    setIsOpen(false);
  };

  const defaultButtonClass = "w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={buttonClassName || defaultButtonClass}
        title={title}
        aria-label={title}
      >
        <MoreVertical className={iconClassName} />
      </button>

      {isMounted && isOpen && menuCoords && createPortal(
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${menuCoords.top}px`,
            left: `${menuCoords.left}px`,
            zIndex: 9999
          }}
          className="w-56 bg-[#1c1c22]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 select-none divide-y divide-white/5"
        >
          {/* Main Action Group */}
          <div className="space-y-0.5">
            {hasActivePlayback && (
              <>
                {/* Play Next */}
                <button
                  type="button"
                  onClick={handlePlayNext}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-200 hover:text-white hover:bg-white/10 text-left transition-colors cursor-pointer group"
                >
                  <CornerDownRight className="w-4 h-4 text-[#00d2c4] group-hover:scale-110 transition-transform" />
                  <span>Play Next</span>
                </button>

                {/* Add to Queue */}
                <button
                  type="button"
                  onClick={handleAddToQueue}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-200 hover:text-white hover:bg-white/10 text-left transition-colors cursor-pointer group"
                >
                  <ListPlus className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>Add to Queue</span>
                </button>
              </>
            )}

            {/* Add to Playlist */}
            <button
              type="button"
              onClick={handleAddToPlaylist}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-200 hover:text-white hover:bg-white/10 text-left transition-colors cursor-pointer group"
            >
              <FolderPlus className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Add to Playlist</span>
            </button>

            {/* Remove from Queue (if applicable) */}
            {onRemoveFromQueue && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromQueue();
                  setToast(`Removed "${track.title}" from queue`, 'info');
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-200 hover:text-red-400 hover:bg-white/10 text-left transition-colors cursor-pointer group"
              >
                <Trash2 className="w-4 h-4 text-neutral-400 group-hover:text-red-400 group-hover:scale-110 transition-transform" />
                <span>Remove from Queue</span>
              </button>
            )}
          </div>

          {/* Favorite Toggle Group */}
          <div className="pt-0.5 mt-0.5">
            <button
              type="button"
              onClick={handleToggleFavorite}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-200 hover:text-white hover:bg-white/10 text-left transition-colors cursor-pointer group"
            >
              <Heart 
                className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                  isFav ? 'text-red-500 fill-red-500' : 'text-neutral-400 group-hover:text-red-400'
                }`} 
              />
              <span>{isFav ? 'Remove Favorite' : 'Add to Favorites'}</span>
            </button>
          </div>

          {/* Download Group at the bottom */}
          <div className="pt-0.5 mt-0.5 space-y-0.5">
            {/* Download Song */}
            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownload}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl text-neutral-200 hover:text-white hover:bg-white/10 text-left transition-colors cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5">
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                )}
                <span>{isDownloading ? 'Downloading...' : 'Download Song'}</span>
              </div>
              {isDownloadedAlready && (
                <span className="text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-medium">
                  Saved
                </span>
              )}
            </button>

            {/* Remove from Downloads (if already downloaded) */}
            {isDownloadedAlready && (
              <button
                type="button"
                onClick={handleRemoveDownload}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-300 hover:text-red-400 hover:bg-white/10 text-left transition-colors cursor-pointer group"
              >
                <Trash2 className="w-4 h-4 text-neutral-400 group-hover:text-red-400 group-hover:scale-110 transition-transform" />
                <span>Remove from Downloads</span>
              </button>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Delete Downloaded Song Confirmation Modal */}
      {isMounted && showDeleteConfirm && createPortal(
        <div 
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="bg-[#18181c] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Delete Downloaded Song?</h3>
              <p className="text-xs text-neutral-400">
                Are you sure you want to remove <span className="font-semibold text-white">"{track.title}"</span> from your downloaded songs?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSong}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition-all cursor-pointer"
              >
                Delete Song
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
