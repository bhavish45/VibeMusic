"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Check, Music, FolderPlus, Sparkles } from 'lucide-react';
import { usePlayerStore, Playlist, getPlaylistCover } from '@/store/playerStore';
import { useAuthStore } from '@/store/authStore';
import MusicPoster from '@/components/ui/MusicPoster';

export default function AddToPlaylistModal() {
  const { 
    addToPlaylistTrack, 
    closeAddToPlaylist, 
    playlists, 
    createPlaylist, 
    addTrackToPlaylist 
  } = usePlayerStore();
  const { setToast, isAuthenticated, openAuthModal } = useAuthStore();

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Require login to add songs to playlists
  useEffect(() => {
    if (addToPlaylistTrack && !isAuthenticated) {
      closeAddToPlaylist();
      openAuthModal('login', 'Please sign in with your email to add songs to playlists.');
    }
  }, [addToPlaylistTrack, isAuthenticated, closeAddToPlaylist, openAuthModal]);

  // Focus input when modal opens
  useEffect(() => {
    if (addToPlaylistTrack) {
      setNewPlaylistName('');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [addToPlaylistTrack]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && addToPlaylistTrack) {
        closeAddToPlaylist();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addToPlaylistTrack, closeAddToPlaylist]);

  if (!addToPlaylistTrack) return null;

  // Filter out Spotify playlists where external tracks cannot be added
  const eligiblePlaylists = playlists.filter(p => p.source !== 'spotify' && !p.id.startsWith('sp_pl_'));

  const handleCreateAndAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAuthenticated) {
      closeAddToPlaylist();
      openAuthModal('login', 'Please sign in with your email to create playlists.');
      return;
    }
    const cleanName = newPlaylistName.trim();
    if (!cleanName) {
      setToast('Please enter a playlist name', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const newId = createPlaylist(cleanName, undefined, undefined, [addToPlaylistTrack]);
      if (newId) {
        setToast(`Created "${cleanName}" and added track!`, 'success');
        closeAddToPlaylist();
      }
    } catch (err) {
      console.error(err);
      setToast('Failed to create playlist', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectPlaylist = (p: Playlist) => {
    if (!isAuthenticated) {
      closeAddToPlaylist();
      openAuthModal('login', 'Please sign in with your email to add songs to playlists.');
      return;
    }
    const isAlreadyIn = p.tracks.some(t => t.videoId === addToPlaylistTrack.videoId);
    if (isAlreadyIn) {
      setToast(`Track is already in "${p.name}"`, 'info');
      return;
    }

    addTrackToPlaylist(p.id, addToPlaylistTrack);
    setToast(`Added to "${p.name}"!`, 'success');
    closeAddToPlaylist();
  };

  const primaryArtist = addToPlaylistTrack.artists?.[0]
    ? (typeof addToPlaylistTrack.artists[0] === 'string' 
        ? addToPlaylistTrack.artists[0] 
        : addToPlaylistTrack.artists[0].name)
    : 'Unknown Artist';

  return (
    <div 
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={closeAddToPlaylist}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#18181c] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00d2c4]/20 border border-[#00d2c4]/40 flex items-center justify-center text-[#00d2c4]">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Add to Playlist</h3>
              <p className="text-[11px] text-neutral-400">Choose a playlist or create a new one</p>
            </div>
          </div>

          <button
            onClick={closeAddToPlaylist}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Track Preview Card */}
        <div className="px-6 py-3.5 bg-black/30 border-b border-white/5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg overflow-hidden bg-neutral-900 shrink-0">
            <MusicPoster
              src={addToPlaylistTrack.poster || addToPlaylistTrack.thumbnails?.[0]?.url}
              fallbackSrc={addToPlaylistTrack.fallbackPoster}
              videoId={addToPlaylistTrack.videoId}
              alt={addToPlaylistTrack.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-white truncate">{addToPlaylistTrack.title}</h4>
            <p className="text-[11px] text-neutral-400 truncate">{primaryArtist}</p>
          </div>
        </div>

        {/* Create New Playlist Input */}
        <div className="px-6 py-4 border-b border-white/5">
          <form onSubmit={handleCreateAndAdd} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter new playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 bg-black/50 border border-white/10 focus:border-[#00d2c4] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isCreating || !newPlaylistName.trim()}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00d2c4] to-teal-500 hover:brightness-110 active:scale-95 disabled:opacity-40 text-black text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Create &amp; Add</span>
            </button>
          </form>
        </div>

        {/* Existing Playlists Section */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5 hide-scrollbar">
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
            Your Playlists ({eligiblePlaylists.length})
          </p>

          {eligiblePlaylists.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Music className="w-7 h-7 text-neutral-600 mx-auto" />
              <p className="text-xs text-neutral-300 font-semibold">No playlists yet</p>
              <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                Type a name above to create your first playlist and add this track!
              </p>
            </div>
          ) : (
            eligiblePlaylists.map((p) => {
              const isAlreadyIn = p.tracks.some(t => t.videoId === addToPlaylistTrack.videoId);

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPlaylist(p)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer ${
                    isAlreadyIn 
                      ? 'bg-white/5 opacity-70 cursor-default' 
                      : 'hover:bg-white/10 active:scale-[0.99]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {(() => {
                      const cover = getPlaylistCover(p);
                      return cover ? (
                        <img 
                          src={cover} 
                          alt={p.name} 
                          className="w-10 h-10 rounded-xl object-cover shrink-0" 
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00d2c4] to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      );
                    })()}
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white truncate">{p.name}</h4>
                        {p.source === 'local_custom' && (
                          <span className="text-[9px] bg-white/10 text-neutral-400 px-1.5 py-0.2 rounded font-medium">
                            Local
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        {p.tracks.length} {p.tracks.length === 1 ? 'song' : 'songs'}
                      </p>
                    </div>
                  </div>

                  {isAlreadyIn ? (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Added</span>
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/5 hover:bg-[#00d2c4] hover:text-black text-neutral-300 flex items-center justify-center transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
