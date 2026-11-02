"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, FolderPlus } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { useAuthStore } from '@/store/authStore';

export default function CreatePlaylistModal() {
  const { 
    isCreatePlaylistOpen, 
    closeCreatePlaylist, 
    createPlaylist,
    createPlaylistCallback 
  } = usePlayerStore();
  const { setToast, isAuthenticated, openAuthModal } = useAuthStore();

  const [playlistName, setPlaylistName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Require authentication to create playlists
  useEffect(() => {
    if (isCreatePlaylistOpen && !isAuthenticated) {
      closeCreatePlaylist();
      openAuthModal('login', 'Please sign in with your email to create custom playlists.');
    }
  }, [isCreatePlaylistOpen, isAuthenticated, closeCreatePlaylist, openAuthModal]);

  // Focus input and reset field when modal opens
  useEffect(() => {
    if (isCreatePlaylistOpen) {
      setPlaylistName('');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isCreatePlaylistOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCreatePlaylistOpen) {
        closeCreatePlaylist();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreatePlaylistOpen, closeCreatePlaylist]);

  if (!isCreatePlaylistOpen) return null;

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAuthenticated) {
      closeCreatePlaylist();
      openAuthModal('login', 'Please sign in with your email to create custom playlists.');
      return;
    }
    const cleanName = playlistName.trim();
    if (!cleanName) {
      setToast('Please enter a playlist name', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const newId = createPlaylist(cleanName);
      if (newId) {
        setToast(`Created playlist "${cleanName}"!`, 'success');
        if (createPlaylistCallback) {
          createPlaylistCallback(newId);
        }
        closeCreatePlaylist();
      }
    } catch (err) {
      console.error(err);
      setToast('Failed to create playlist', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
      onClick={closeCreatePlaylist}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#18181c] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header matching AddToPlaylistModal */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00d2c4]/20 border border-[#00d2c4]/40 flex items-center justify-center text-[#00d2c4]">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Create Playlist</h3>
              <p className="text-[11px] text-neutral-400">Give your new playlist a name to get started</p>
            </div>
          </div>

          <button
            onClick={closeCreatePlaylist}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Playlist Name</label>
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. Chill Vibes, Workout Mix..."
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              maxLength={60}
              className="w-full bg-black/50 border border-white/10 focus:border-[#00d2c4] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none transition-colors"
            />
          </div>


          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={closeCreatePlaylist}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !playlistName.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00d2c4] to-teal-500 hover:brightness-110 active:scale-95 disabled:opacity-40 text-black text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Create Playlist</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
