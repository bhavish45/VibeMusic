import { create } from 'zustand';
import { useAuthStore, getBackendUrl, registerOnLogout } from '@/store/authStore';

export interface Track {
  videoId: string;
  title: string;
  artists: { name: string; id?: string }[];
  album?: { name: string; id?: string };
  duration: number; // in seconds
  durationFormatted?: string;
  thumbnails?: { url: string; width?: number; height?: number }[];
  poster?: string;
  fallbackPoster?: string;
  viewCount?: string;
  description?: string;
  published?: string;
  channel?: string;
  subscribers?: string;
  source?: string;
  spotifyId?: string;
}

export interface PlayHistoryItem {
  track: Track;
  playCount: number;
  lastPlayed: number; // timestamp
}

export interface FollowedArtist {
  name: string;
  id?: string;
  avatar?: string;
  subscribers?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  cover_url?: string;
  source?: 'custom' | 'spotify' | 'local_custom';
  spotify_playlist_id?: string;
  tracks: Track[];
  createdAt: number;
}

/**
 * Returns the effective cover artwork for any playlist.
 * - For imported Spotify playlists: retains their authentic Spotify cover.
 * - For local/custom playlists: if the playlist has songs, it takes the first song's poster.
 * - If the playlist is empty: returns undefined (so it renders the default letter/gradient placeholder).
 */
export function getPlaylistCover(playlist?: Playlist | null): string | undefined {
  if (!playlist) return undefined;
  if (playlist.source === 'spotify' && playlist.cover_url) {
    return playlist.cover_url;
  }
  if (playlist.tracks && playlist.tracks.length > 0) {
    const first = playlist.tracks[0];
    const firstCover = first.poster || first.thumbnails?.[0]?.url || first.fallbackPoster;
    if (firstCover) return firstCover;
  }
  return playlist.cover_url || undefined;
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  progress: number; // current time in seconds
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isExpanded: boolean;
  isQueueOpen: boolean;
  isFullScreenLyricsOpen: boolean;
  error: string | null;

  // Active Artist Modal State
  activeArtistModal: { name: string; id?: string; avatar?: string; subscribers?: string } | null;
  openArtistModal: (artist: { name: string; id?: string; avatar?: string; subscribers?: string } | string) => void;
  closeArtistModal: () => void;

  // Recent Songs Modal State & Actions
  isRecentSongsOpen: boolean;
  openRecentSongs: () => void;
  closeRecentSongs: () => void;
  clearPlayHistory: () => void;
  removeFromPlayHistory: (videoId: string) => void;

  // Settings Modal State
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  // Updates / Changelog Modal State
  isUpdatesOpen: boolean;
  openUpdates: () => void;
  closeUpdates: () => void;

  // Keyboard Shortcuts Modal State
  isShortcutsOpen: boolean;
  openShortcuts: () => void;
  closeShortcuts: () => void;
  toggleShortcuts: () => void;

  // Add to Playlist Modal State
  addToPlaylistTrack: Track | null;
  openAddToPlaylist: (track: Track) => void;
  closeAddToPlaylist: () => void;

  // Create Playlist Modal State
  isCreatePlaylistOpen: boolean;
  createPlaylistCallback: ((playlistId: string) => void) | null;
  openCreatePlaylist: (onCreated?: (playlistId: string) => void) => void;
  closeCreatePlaylist: () => void;

  // Real Persistent User Library Collections
  favorites: Track[];
  followedArtists: FollowedArtist[];
  playHistory: PlayHistoryItem[];
  downloadedTracks: Track[];
  playlists: Playlist[];

  // Library Actions
  toggleFavorite: (track: Track) => void;
  isFavorite: (videoId: string) => boolean;
  toggleFollowArtist: (artist: FollowedArtist | string) => void;
  isFollowingArtist: (name: string) => boolean;
  toggleDownload: (track: Track) => void;
  addDownloadedTrack: (track: Track) => void;
  removeDownloadedTrack: (videoId: string) => void;
  isDownloaded: (videoId: string) => boolean;
  recordPlay: (track: Track) => void;

  createPlaylist: (name: string, description?: string, coverUrl?: string, initialTracks?: Track[]) => string;
  deletePlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromPlaylist: (playlistId: string, videoId: string) => void;
  updatePlaylistTrackArtwork: (playlistId: string, trackVideoId: string, posterUrl: string) => void;
  updateTrackResolution: (
    oldVideoId: string,
    newVideoId: string,
    poster?: string,
    fallbackPoster?: string,
    thumbnails?: { url: string; width: number; height: number }[]
  ) => void;
  fetchUserLibrary: (token: string) => Promise<void>;
  syncLocalToDatabase: () => Promise<boolean>;
  handleUserLogout: () => void;

  // Player Actions
  playTrack: (track: Track, queue?: Track[]) => void;
  playQueueIndex: (index: number) => void;
  advanceCrossfadeTrack: (index: number) => void;
  pause: () => void;
  play: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (vol: number) => void;
  setProgress: (prog: number) => void;
  setTrackDuration: (duration: number) => void;
  setIsLoading: (loading: boolean) => void;
  setIsExpanded: (expanded: boolean) => void;
  setIsQueueOpen: (open: boolean) => void;
  setIsFullScreenLyricsOpen: (open: boolean) => void;
  setError: (err: string | null) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  playNextInQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  clearQueue: () => void;

  // Cached home feed data
  homeSections: any[];
  setHomeSections: (sections: any[]) => void;
  initPersistedState: () => void;
}

// LocalStorage Persistence Keys
const STORAGE_KEY_LIB = 'vibemusic_library_v2';

function loadPersistedLibrary() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LIB);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load user library from localStorage:', e);
  }
  return null;
}

function savePersistedLibrary(state: {
  favorites: Track[];
  followedArtists: FollowedArtist[];
  playHistory: PlayHistoryItem[];
  downloadedTracks: Track[];
  playlists: Playlist[];
}) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_LIB, JSON.stringify({
      favorites: state.favorites,
      followedArtists: state.followedArtists,
      playHistory: state.playHistory.slice(0, 100), // Keep top 100
      downloadedTracks: state.downloadedTracks,
      playlists: state.playlists
    }));
  } catch (e) {
    console.warn('Failed to save library to localStorage:', e);
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  isLoading: false,
  volume: 1,
  progress: 0,
  isShuffled: false,
  repeatMode: 'off',
  isExpanded: false,
  isQueueOpen: false,
  isFullScreenLyricsOpen: false,
  error: null,

  initPersistedState: () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('vibemusic_current_track_v2');
      localStorage.removeItem('vibemusic_current_track');
    } catch (e) { }

    const storedLib = loadPersistedLibrary();
    if (storedLib) {
      const cleanPlaylists = (storedLib.playlists || [])
        .filter((p: Playlist) => {
          if (!p || !p.id || !p.name || p.name === 'null' || p.name === 'undefined') return false;
          if (p.id.startsWith('demo_') || p.id.startsWith('sp_pl_demo') || p.name.includes('(Spotify)')) return false;
          if (p.source === 'spotify') {
            const spId = p.spotify_playlist_id || p.id.replace('sp_pl_', '');
            if (!spId || spId.length < 15 || spId === 'hi') return false;
          }
          return true;
        })
        .map((p: Playlist) => {
          let plCover = p.cover_url;
          if (p.source !== 'spotify') {
            if (p.tracks && p.tracks.length > 0) {
              const first = p.tracks[0];
              plCover = first.poster || first.thumbnails?.[0]?.url || first.fallbackPoster || plCover;
            } else {
              plCover = undefined;
            }
          }
          const cleanedTracks = (p.tracks || []).map((t: Track) => {
            const isSameAsPlaylist = Boolean(
              p.source === 'spotify' && plCover && (t.poster === plCover || t.fallbackPoster === plCover)
            );
            return {
              ...t,
              poster: isSameAsPlaylist ? undefined : t.poster,
              fallbackPoster: isSameAsPlaylist ? undefined : t.fallbackPoster
            };
          });
          return { ...p, cover_url: plCover, tracks: cleanedTracks };
        });

      set({
        favorites: storedLib.favorites || [],
        followedArtists: storedLib.followedArtists || [],
        playHistory: storedLib.playHistory || [],
        downloadedTracks: storedLib.downloadedTracks || [],
        playlists: cleanPlaylists
      });
      savePersistedLibrary({
        favorites: storedLib.favorites || [],
        followedArtists: storedLib.followedArtists || [],
        playHistory: storedLib.playHistory || [],
        downloadedTracks: storedLib.downloadedTracks || [],
        playlists: cleanPlaylists
      });
    }
  },

  activeArtistModal: null,
  openArtistModal: (artist) => {
    if (typeof artist === 'string') {
      set({ activeArtistModal: { name: artist } });
    } else {
      set({ activeArtistModal: artist });
    }
  },
  closeArtistModal: () => set({ activeArtistModal: null }),

  isRecentSongsOpen: false,
  openRecentSongs: () => set({ isRecentSongsOpen: true }),
  closeRecentSongs: () => set({ isRecentSongsOpen: false }),

  // Add to Playlist Modal
  addToPlaylistTrack: null,
  openAddToPlaylist: (track: Track) => {
    const auth = useAuthStore.getState();
    if (!auth.isAuthenticated || !auth.token) {
      auth.openAuthModal('login', 'Please sign in with your email to add tracks to playlists.');
      return;
    }
    set({ addToPlaylistTrack: track });
  },
  closeAddToPlaylist: () => set({ addToPlaylistTrack: null }),

  // Create Playlist Modal
  isCreatePlaylistOpen: false,
  createPlaylistCallback: null,
  openCreatePlaylist: (onCreated) => {
    const auth = useAuthStore.getState();
    if (!auth.isAuthenticated || !auth.token) {
      auth.openAuthModal('login', 'Please sign in with your email to create custom playlists.');
      return;
    }
    set({ isCreatePlaylistOpen: true, createPlaylistCallback: onCreated || null });
  },
  closeCreatePlaylist: () => set({ isCreatePlaylistOpen: false, createPlaylistCallback: null }),

  clearPlayHistory: () => {
    set({ playHistory: [] });
    savePersistedLibrary({
      favorites: get().favorites,
      followedArtists: get().followedArtists,
      playHistory: [],
      downloadedTracks: get().downloadedTracks,
      playlists: get().playlists
    });
  },
  removeFromPlayHistory: (videoId: string) => {
    const newHistory = get().playHistory.filter(h => h.track.videoId !== videoId);
    set({ playHistory: newHistory });
    savePersistedLibrary({
      favorites: get().favorites,
      followedArtists: get().followedArtists,
      playHistory: newHistory,
      downloadedTracks: get().downloadedTracks,
      playlists: get().playlists
    });
  },

  isSettingsOpen: false,
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  isUpdatesOpen: false,
  openUpdates: () => set({ isUpdatesOpen: true }),
  closeUpdates: () => set({ isUpdatesOpen: false }),

  isShortcutsOpen: false,
  openShortcuts: () => set({ isShortcutsOpen: true }),
  closeShortcuts: () => set({ isShortcutsOpen: false }),
  toggleShortcuts: () => set((state) => ({ isShortcutsOpen: !state.isShortcutsOpen })),

  favorites: [],
  followedArtists: [],
  playHistory: [],
  downloadedTracks: [],
  playlists: [],
  homeSections: [],
  setHomeSections: (sections) => set({ homeSections: sections }),

  // Record every track play to user's real play history & most played counter
  recordPlay: (track: Track) => {
    const history = [...get().playHistory];
    const existingIdx = history.findIndex(h => h.track.videoId === track.videoId);
    let newHistory: PlayHistoryItem[];

    if (existingIdx >= 0) {
      const existing = history[existingIdx];
      newHistory = [
        {
          track: { ...existing.track, ...track },
          playCount: (existing.playCount || 1) + 1,
          lastPlayed: Date.now()
        },
        ...history.filter((_, i) => i !== existingIdx)
      ];
    } else {
      newHistory = [
        { track, playCount: 1, lastPlayed: Date.now() },
        ...history
      ];
    }

    set({ playHistory: newHistory });
    savePersistedLibrary({
      favorites: get().favorites,
      followedArtists: get().followedArtists,
      playHistory: newHistory,
      downloadedTracks: get().downloadedTracks,
      playlists: get().playlists
    });
  },

  // Toggle favorite - strictly requires authentication as requested
  toggleFavorite: (track: Track) => {
    const auth = useAuthStore.getState();
    if (!auth.isAuthenticated || !auth.token) {
      auth.openAuthModal('login', 'Please sign in with your email to save songs to your favorites.');
      return;
    }

    const favs = get().favorites;
    const exists = favs.some(t => t.videoId === track.videoId);
    const newFavs = exists
      ? favs.filter(t => t.videoId !== track.videoId)
      : [track, ...favs];

    set({ favorites: newFavs });
    savePersistedLibrary({
      favorites: newFavs,
      followedArtists: get().followedArtists,
      playHistory: get().playHistory,
      downloadedTracks: get().downloadedTracks,
      playlists: get().playlists
    });

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    if (exists) {
      fetch(`${backendUrl}/api/user/favorites/${track.videoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` }
      }).catch(e => console.warn('Favorite sync error:', e));
    } else {
      fetch(`${backendUrl}/api/user/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify(track)
      }).catch(e => console.warn('Favorite sync error:', e));
    }
  },

  isFavorite: (videoId: string) => {
    return get().favorites.some(t => t.videoId === videoId);
  },

  // Follow / Unfollow Artists (Requires Email Login)
  toggleFollowArtist: (artistInput) => {
    const auth = useAuthStore.getState();
    if (!auth.isAuthenticated || !auth.token) {
      auth.openAuthModal('login', 'Please sign in with your email to follow artists.');
      return;
    }

    const artist: FollowedArtist = typeof artistInput === 'string'
      ? { name: artistInput }
      : artistInput;

    const current = get().followedArtists;
    const exists = current.some(a => a.name.toLowerCase() === artist.name.toLowerCase());
    const newFollowed = exists
      ? current.filter(a => a.name.toLowerCase() !== artist.name.toLowerCase())
      : [{ ...artist }, ...current];

    set({ followedArtists: newFollowed });
    savePersistedLibrary({
      favorites: get().favorites,
      followedArtists: newFollowed,
      playHistory: get().playHistory,
      downloadedTracks: get().downloadedTracks,
      playlists: get().playlists
    });

    const backendUrl = getBackendUrl();
    if (exists) {
      fetch(`${backendUrl}/api/user/artists/${encodeURIComponent(artist.name)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` }
      }).catch(e => console.warn('Unfollow artist db sync error:', e));
    } else {
      fetch(`${backendUrl}/api/user/artists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({ artist })
      }).catch(e => console.warn('Follow artist db sync error:', e));
    }
  },

  isFollowingArtist: (name: string) => {
    return get().followedArtists.some(a => a.name.toLowerCase() === name.toLowerCase());
  },

  // Download / Offline toggle (persisted strictly to localStorage, never database)
  toggleDownload: (track: Track) => {
    const downloads = get().downloadedTracks;
    const exists = downloads.some(t => t.videoId === track.videoId);
    const newDownloads = exists
      ? downloads.filter(t => t.videoId !== track.videoId)
      : [track, ...downloads];

    set({ downloadedTracks: newDownloads });
    savePersistedLibrary({
      favorites: get().favorites,
      followedArtists: get().followedArtists,
      playHistory: get().playHistory,
      downloadedTracks: newDownloads,
      playlists: get().playlists
    });
  },

  addDownloadedTrack: (track: Track) => {
    const downloads = get().downloadedTracks;
    if (downloads.some(t => t.videoId === track.videoId)) return;
    const newDownloads = [track, ...downloads];
    set({ downloadedTracks: newDownloads });
    savePersistedLibrary({
      favorites: get().favorites,
      followedArtists: get().followedArtists,
      playHistory: get().playHistory,
      downloadedTracks: newDownloads,
      playlists: get().playlists
    });
  },

  removeDownloadedTrack: (videoId: string) => {
    const downloads = get().downloadedTracks;
    const newDownloads = downloads.filter(t => t.videoId !== videoId);
    set({ downloadedTracks: newDownloads });
    savePersistedLibrary({
      favorites: get().favorites,
      followedArtists: get().followedArtists,
      playHistory: get().playHistory,
      downloadedTracks: newDownloads,
      playlists: get().playlists
    });
  },

  isDownloaded: (videoId: string) => {
    return get().downloadedTracks.some(t => t.videoId === videoId);
  },

  // Playlists management - Requires Authentication (synced to Supabase database)
  createPlaylist: (name: string, description?: string, coverUrl?: string, initialTracks?: Track[]) => {
    const auth = useAuthStore.getState();
    const isAuthed = Boolean(auth.isAuthenticated && auth.token);
    if (!isAuthed) {
      auth.openAuthModal('login', 'Please sign in with your email to create and save custom playlists.');
      return '';
    }
    const id = `pl_${Date.now()}`;
    const tracks = initialTracks || [];
    let effectiveCover = coverUrl;
    if (!effectiveCover && tracks.length > 0) {
      const first = tracks[0];
      effectiveCover = first.poster || first.thumbnails?.[0]?.url || first.fallbackPoster;
    }
    const newPlaylist: Playlist = {
      id,
      name: name.trim() || 'My Playlist',
      description: description || '',
      cover_url: effectiveCover,
      source: 'custom',
      tracks,
      createdAt: Date.now()
    };
    const newPlaylists = [newPlaylist, ...get().playlists];
    set({ playlists: newPlaylists });
    savePersistedLibrary({
      favorites: get().favorites,
      followedArtists: get().followedArtists,
      playHistory: get().playHistory,
      downloadedTracks: get().downloadedTracks,
      playlists: newPlaylists
    });

    const backendUrl = getBackendUrl();
    fetch(`${backendUrl}/api/user/playlists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`
      },
      body: JSON.stringify({
        id: newPlaylist.id,
        name: newPlaylist.name,
        description,
        cover_url: effectiveCover,
        tracks
      })
    }).catch(e => console.warn('Playlist db sync error:', e));

    return id;
  },

  deletePlaylist: (playlistId: string) => {
    const auth = useAuthStore.getState();
    const cleanTargetId = playlistId.replace('sp_pl_', '');
    const newPlaylists = get().playlists.filter(p => {
      const pCleanId = p.id.replace('sp_pl_', '');
      const pSpotifyId = p.spotify_playlist_id || (p as any).spotify_id;
      return (
        p.id !== playlistId &&
        pCleanId !== cleanTargetId &&
        pSpotifyId !== playlistId &&
        pSpotifyId !== cleanTargetId
      );
    });
    set({ playlists: newPlaylists });
    savePersistedLibrary({
      favorites: get().favorites,
      followedArtists: get().followedArtists,
      playHistory: get().playHistory,
      downloadedTracks: get().downloadedTracks,
      playlists: newPlaylists
    });

    if (auth.isAuthenticated && auth.token && !playlistId.startsWith('local_')) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      fetch(`${backendUrl}/api/user/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` }
      }).catch(e => console.warn('Delete playlist db sync error:', e));
    }
  },

  addTrackToPlaylist: (playlistId: string, track: Track) => {
    const auth = useAuthStore.getState();
    if (!auth.isAuthenticated || !auth.token) {
      auth.openAuthModal('login', 'Please sign in with your email to add tracks to playlists.');
      return;
    }

    const targetPlaylist = get().playlists.find(p => p.id === playlistId);
    if (targetPlaylist && targetPlaylist.source === 'spotify') {
      console.warn('Cannot add tracks to imported Spotify playlists.');
      return;
    }
    const newPlaylists = get().playlists.map(p => {
      if (p.id === playlistId) {
        if (p.tracks.some(t => t.videoId === track.videoId)) return p;
        const updatedTracks = [...p.tracks, track];
        let updatedCover = p.cover_url;
        if (p.source !== 'spotify') {
          const first = updatedTracks[0];
          updatedCover = first ? (first.poster || first.thumbnails?.[0]?.url || first.fallbackPoster) : p.cover_url;
        }
        return { ...p, tracks: updatedTracks, cover_url: updatedCover };
      }
      return p;
    });
    set({ playlists: newPlaylists });
    savePersistedLibrary({
      favorites: get().favorites,
      followedArtists: get().followedArtists,
      playHistory: get().playHistory,
      downloadedTracks: get().downloadedTracks,
      playlists: newPlaylists
    });

    if (auth.isAuthenticated && auth.token && !playlistId.startsWith('local_')) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      fetch(`${backendUrl}/api/user/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({ track })
      }).catch(e => console.warn('Add track to playlist db sync error:', e));
    }
  },

  removeTrackFromPlaylist: (playlistId: string, videoId: string) => {
    const targetPlaylist = get().playlists.find(p => p.id === playlistId);
    if (targetPlaylist && targetPlaylist.source === 'spotify') {
      console.warn('Cannot delete songs from imported Spotify playlists.');
      return;
    }

    const newPlaylists = get().playlists.map(p => {
      if (p.id === playlistId) {
        const updatedTracks = p.tracks.filter(t => t.videoId !== videoId);
        let updatedCover = p.cover_url;
        if (p.source !== 'spotify') {
          if (updatedTracks.length === 0) {
            updatedCover = undefined;
          } else {
            const first = updatedTracks[0];
            updatedCover = first.poster || first.thumbnails?.[0]?.url || first.fallbackPoster;
          }
        }
        return { ...p, tracks: updatedTracks, cover_url: updatedCover };
      }
      return p;
    });
    set({ playlists: newPlaylists });
    savePersistedLibrary({
      favorites: get().favorites,
      followedArtists: get().followedArtists,
      playHistory: get().playHistory,
      downloadedTracks: get().downloadedTracks,
      playlists: newPlaylists
    });

    const auth = useAuthStore.getState();
    if (auth.isAuthenticated && auth.token && !playlistId.startsWith('local_')) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      fetch(`${backendUrl}/api/user/playlists/${playlistId}/tracks/${videoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` }
      }).catch(e => console.warn('Remove track from playlist db sync error:', e));
    }
  },

  // Fetch full user library from database upon login or init
  fetchUserLibrary: async (token: string) => {
    const backendUrl = getBackendUrl();
    try {
      const res = await fetch(`${backendUrl}/api/user/library`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const serverFavs: Track[] = data.favorites || [];
        const serverPlaylists: Playlist[] = (data.playlists || [])
          .filter((p: Playlist) => {
            if (!p || !p.id || !p.name || p.name === 'null' || p.name === 'undefined') return false;
            if (p.id.startsWith('demo_') || p.id.startsWith('sp_pl_demo') || p.name.includes('(Spotify)')) return false;
            if (p.source === 'spotify') {
              const spId = p.spotify_playlist_id || p.id.replace('sp_pl_', '');
              if (!spId || spId.length < 15 || spId === 'hi') return false;
            }
            return true;
          })
          .map((p: any) => {
            let plCover = p.cover_url;
            const existingMemoryPl = get().playlists.find(
              lp => lp.id === p.id || (p.spotify_playlist_id && lp.spotify_playlist_id === p.spotify_playlist_id)
            );
            const rawTracks = (p.tracks && p.tracks.length > 0)
              ? p.tracks
              : (existingMemoryPl && existingMemoryPl.tracks?.length > 0 ? existingMemoryPl.tracks : []);

            if (p.source !== 'spotify') {
              if (rawTracks.length > 0) {
                const first = rawTracks[0];
                plCover = first.poster || first.thumbnails?.[0]?.url || first.fallbackPoster || plCover;
              } else {
                plCover = undefined;
              }
            }

            const cleanedTracks = rawTracks.map((t: Track) => {
              const isSameAsPlaylist = Boolean(
                p.source === 'spotify' && plCover && (t.poster === plCover || t.fallbackPoster === plCover)
              );
              return {
                ...t,
                poster: isSameAsPlaylist ? undefined : t.poster,
                fallbackPoster: isSameAsPlaylist ? undefined : t.fallbackPoster
              };
            });
            return {
              ...p,
              cover_url: plCover,
              createdAt: p.createdAt || p.created_at || Date.now(),
              tracks: cleanedTracks
            };
          });

        // Retain any guest local or in-memory playlists that the server has not yet returned
        const serverIds = new Set(serverPlaylists.map(p => p.id));
        const memoryPlaylistsToKeep = get().playlists.filter(
          p => !p.id.startsWith('demo_') && !p.id.startsWith('sp_pl_demo') && !serverIds.has(p.id)
        );
        const mergedPlaylists = [...serverPlaylists, ...memoryPlaylistsToKeep];

        // Merge followed artists from server and local memory
        const serverFollowed: FollowedArtist[] = data.followedArtists || [];
        const currentFollowed = get().followedArtists;
        const followedMap = new Map<string, FollowedArtist>();
        serverFollowed.forEach((a: FollowedArtist) => {
          if (a?.name) followedMap.set(a.name.toLowerCase(), a);
        });
        currentFollowed.forEach((a: FollowedArtist) => {
          if (a?.name && !followedMap.has(a.name.toLowerCase())) {
            followedMap.set(a.name.toLowerCase(), a);
          }
        });
        const mergedFollowed = Array.from(followedMap.values());

        set({
          favorites: serverFavs,
          playlists: mergedPlaylists,
          followedArtists: mergedFollowed
        });

        savePersistedLibrary({
          favorites: serverFavs,
          followedArtists: mergedFollowed,
          playHistory: get().playHistory,
          downloadedTracks: get().downloadedTracks,
          playlists: mergedPlaylists
        });
      }
    } catch (e) {
      console.warn('Failed to fetch user library from database:', e);
    }
  },

  handleUserLogout: () => {
    set({
      favorites: [],
      followedArtists: [],
      playlists: []
    });
    savePersistedLibrary({
      favorites: [],
      followedArtists: [],
      playHistory: get().playHistory,
      downloadedTracks: get().downloadedTracks,
      playlists: []
    });
  },

  updatePlaylistTrackArtwork: (playlistId: string, trackVideoId: string, posterUrl: string) => {
    if (!posterUrl) return;
    set(state => {
      const updatedPlaylists = state.playlists.map(p => {
        if (p.id !== playlistId) return p;
        return {
          ...p,
          tracks: p.tracks.map(t => {
            if (t.videoId === trackVideoId || (t.spotifyId && trackVideoId.includes(t.spotifyId))) {
              return {
                ...t,
                poster: posterUrl,
                fallbackPoster: posterUrl
              };
            }
            return t;
          })
        };
      });

      // Also update currentTrack if it matches
      const updatedCurrentTrack = state.currentTrack && (
        state.currentTrack.videoId === trackVideoId ||
        (state.currentTrack.spotifyId && trackVideoId.includes(state.currentTrack.spotifyId))
      ) ? {
        ...state.currentTrack,
        poster: posterUrl,
        fallbackPoster: posterUrl
      } : state.currentTrack;

      savePersistedLibrary({
        favorites: state.favorites,
        followedArtists: state.followedArtists,
        playHistory: state.playHistory,
        downloadedTracks: state.downloadedTracks,
        playlists: updatedPlaylists
      });

      return {
        playlists: updatedPlaylists,
        currentTrack: updatedCurrentTrack
      };
    });
  },

  updateTrackResolution: (oldVideoId, newVideoId, poster, fallbackPoster, thumbnails) => {
    if (!oldVideoId || !newVideoId || oldVideoId === newVideoId) return;

    set(state => {
      // 1. Update in queue
      const updatedQueue = state.queue.map(q => {
        if (q.videoId === oldVideoId || (q.spotifyId && oldVideoId.includes(q.spotifyId))) {
          return {
            ...q,
            videoId: newVideoId,
            poster: poster || q.poster,
            fallbackPoster: fallbackPoster || q.fallbackPoster,
            thumbnails: thumbnails || q.thumbnails
          };
        }
        return q;
      });

      // 2. Update currentTrack if playing
      const updatedCurrentTrack = state.currentTrack && (
        state.currentTrack.videoId === oldVideoId ||
        (state.currentTrack.spotifyId && oldVideoId.includes(state.currentTrack.spotifyId))
      ) ? {
        ...state.currentTrack,
        videoId: newVideoId,
        poster: poster || state.currentTrack.poster,
        fallbackPoster: fallbackPoster || state.currentTrack.fallbackPoster,
        thumbnails: thumbnails || state.currentTrack.thumbnails
      } : state.currentTrack;

      // 3. Update across all playlists (imported Spotify & local/custom playlists)
      const updatedPlaylists = state.playlists.map(pl => ({
        ...pl,
        tracks: pl.tracks.map(pt => {
          if (pt.videoId === oldVideoId || (pt.spotifyId && oldVideoId.includes(pt.spotifyId))) {
            return {
              ...pt,
              videoId: newVideoId,
              poster: poster || pt.poster,
              fallbackPoster: fallbackPoster || pt.fallbackPoster,
              thumbnails: thumbnails || pt.thumbnails
            };
          }
          return pt;
        })
      }));

      savePersistedLibrary({
        favorites: state.favorites,
        followedArtists: state.followedArtists,
        playHistory: state.playHistory,
        downloadedTracks: state.downloadedTracks,
        playlists: updatedPlaylists
      });

      return {
        queue: updatedQueue,
        currentTrack: updatedCurrentTrack,
        playlists: updatedPlaylists
      };
    });
  },

  // Sync / migrate guest local favorites & playlists to database
  syncLocalToDatabase: async () => {
    const auth = useAuthStore.getState();
    if (!auth.isAuthenticated || !auth.token) return false;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const localPlaylists = get().playlists.filter(p => p.source === 'local_custom');
    try {
      const res = await fetch(`${backendUrl}/api/user/sync-local`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          favorites: get().favorites,
          playlists: localPlaylists
        })
      });
      if (res.ok) {
        await get().fetchUserLibrary(auth.token);
        return true;
      }
    } catch (e) {
      console.warn('Failed to sync local data to database:', e);
    }
    return false;
  },

  // PlayTrack implementation with auto Spotify-to-YouTube resolution
  playTrack: (track, queue) => {
    const cleanDuration = typeof track.duration === 'number' && !isNaN(track.duration) && track.duration > 0
      ? track.duration
      : 210;

    // Never allow imported Spotify playlist group cover to be used as individual track poster
    const isPlaylistCover = get().playlists.some(
      p => p.source === 'spotify' && p.cover_url && (track.poster === p.cover_url || track.fallbackPoster === p.cover_url)
    );
    const safePoster = isPlaylistCover ? undefined : (track.poster || track.thumbnails?.[0]?.url);
    const isSpTrack = track.videoId.startsWith('sp_') || track.source === 'spotify';
    const safeFallback = isPlaylistCover || isSpTrack
      ? (isSpTrack ? undefined : track.fallbackPoster)
      : (track.fallbackPoster || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`);

    const formattedTrack: Track = {
      ...track,
      duration: cleanDuration,
      poster: safePoster,
      fallbackPoster: safeFallback
    };

    let newQueue = queue ? [...queue] : get().queue;
    let newIndex = newQueue.findIndex(t => t.videoId === track.videoId);

    if (newIndex === -1) {
      if (newQueue.length === 0) {
        newQueue = [formattedTrack];
        newIndex = 0;
      } else {
        newQueue = [...newQueue, formattedTrack];
        newIndex = newQueue.length - 1;
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const { audioPlayer } = require('@/lib/audioPlayer');
        audioPlayer.resetPlaybackState();
      } catch {}
    }

    set({
      currentTrack: formattedTrack,
      queue: newQueue,
      queueIndex: newIndex,
      isPlaying: true,
      isLoading: true,
      progress: 0,
      error: null
    });

    // Record this play in real user play history
    get().recordPlay(formattedTrack);

    // If track is from Spotify and lacks YouTube videoId, resolve in background
    if (isSpTrack) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      fetch(`${backendUrl}/api/spotify/resolve-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.title,
          artist: track.artists?.[0]?.name || ''
        })
      })
        .then(res => res.json())
        .then(match => {
          if (match && match.videoId) {
            const targetVid = track.videoId;
            const matchPoster = match.poster || match.thumbnails?.[0]?.url;
            const matchFallback = match.fallbackPoster || (match.videoId ? `https://i.ytimg.com/vi/${match.videoId}/mqdefault.jpg` : undefined);
            get().updateTrackResolution(targetVid, match.videoId, matchPoster, matchFallback, match.thumbnails);
          }
        })
        .catch(() => { });
    }
  },

  playQueueIndex: (index: number) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    const targetTrack = queue[index];
    if (!targetTrack) return;

    if (typeof window !== 'undefined') {
      try {
        const { audioPlayer } = require('@/lib/audioPlayer');
        audioPlayer.resetPlaybackState();
      } catch {}
    }

    const cleanTrack: Track = {
      ...targetTrack,
      poster: targetTrack.poster || targetTrack.thumbnails?.[0]?.url || (targetTrack.videoId ? `https://i.ytimg.com/vi/${targetTrack.videoId}/hqdefault.jpg` : undefined),
      fallbackPoster: targetTrack.fallbackPoster || (targetTrack.videoId ? `https://i.ytimg.com/vi/${targetTrack.videoId}/hqdefault.jpg` : undefined)
    };

    set({
      currentTrack: cleanTrack,
      queueIndex: index,
      isPlaying: true,
      isLoading: true,
      progress: 0,
      error: null
    });
    get().recordPlay(cleanTrack);

    if (cleanTrack.videoId.startsWith('sp_')) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      fetch(`${backendUrl}/api/spotify/resolve-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTrack.title,
          artist: cleanTrack.artists?.[0]?.name || ''
        })
      })
        .then(res => res.json())
        .then(match => {
          if (match && match.videoId) {
            const targetVid = cleanTrack.videoId;
            const matchPoster = match.poster || match.thumbnails?.[0]?.url;
            const matchFallback = match.fallbackPoster || (match.videoId ? `https://i.ytimg.com/vi/${match.videoId}/mqdefault.jpg` : undefined);
            get().updateTrackResolution(targetVid, match.videoId, matchPoster, matchFallback, match.thumbnails);
          }
        })
        .catch(() => {});
    }
  },

  advanceCrossfadeTrack: (index: number) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    const targetTrack = queue[index];
    if (!targetTrack) return;

    const cleanTrack: Track = {
      ...targetTrack,
      poster: targetTrack.poster || targetTrack.thumbnails?.[0]?.url || (targetTrack.videoId ? `https://i.ytimg.com/vi/${targetTrack.videoId}/hqdefault.jpg` : undefined),
      fallbackPoster: targetTrack.fallbackPoster || (targetTrack.videoId ? `https://i.ytimg.com/vi/${targetTrack.videoId}/hqdefault.jpg` : undefined)
    };

    set({
      currentTrack: cleanTrack,
      queueIndex: index,
      isPlaying: true,
      isLoading: false,
      error: null
    });
    get().recordPlay(cleanTrack);
  },

  pause: () => set({ isPlaying: false }),
  play: () => set((state) => ({ isPlaying: state.currentTrack !== null })),

  nextTrack: () => {
    const { queue, queueIndex, repeatMode, isShuffled } = get();
    if (queue.length === 0) return;

    let nextIndex = queueIndex + 1;
    if (isShuffled && queue.length > 1) {
      let rand = Math.floor(Math.random() * queue.length);
      while (rand === queueIndex && queue.length > 1) {
        rand = Math.floor(Math.random() * queue.length);
      }
      nextIndex = rand;
    } else if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        set({ isPlaying: false, progress: 0 });
        if (typeof window !== 'undefined') {
          try {
            const { audioPlayer } = require('@/lib/audioPlayer');
            audioPlayer.resetPlaybackState();
          } catch {}
        }
        return;
      }
    }

    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      if (typeof window !== 'undefined') {
        try {
          const { audioPlayer } = require('@/lib/audioPlayer');
          audioPlayer.resetPlaybackState();
        } catch {}
      }

      const cleanTrack: Track = {
        ...nextTrack,
        poster: nextTrack.poster || nextTrack.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${nextTrack.videoId}/hqdefault.jpg`,
        fallbackPoster: nextTrack.fallbackPoster || `https://i.ytimg.com/vi/${nextTrack.videoId}/hqdefault.jpg`
      };
      set({
        currentTrack: cleanTrack,
        queueIndex: nextIndex,
        isPlaying: true,
        isLoading: true,
        progress: 0,
        error: null
      });
      get().recordPlay(cleanTrack);

      if (cleanTrack.videoId.startsWith('sp_')) {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        fetch(`${backendUrl}/api/spotify/resolve-track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: cleanTrack.title,
            artist: cleanTrack.artists?.[0]?.name || ''
          })
        })
          .then(res => res.json())
          .then(match => {
            if (match && match.videoId) {
              const targetVid = cleanTrack.videoId;
              const matchPoster = match.poster || match.thumbnails?.[0]?.url;
              const matchFallback = match.fallbackPoster || (match.videoId ? `https://i.ytimg.com/vi/${match.videoId}/mqdefault.jpg` : undefined);
              get().updateTrackResolution(targetVid, match.videoId, matchPoster, matchFallback, match.thumbnails);
            }
          })
          .catch(() => {});
      }
    }
  },

  prevTrack: () => {
    const { queue, queueIndex, progress } = get();
    if (progress > 3) {
      set({ progress: 0 });
      if (typeof window !== 'undefined') {
        try {
          const { audioPlayer } = require('@/lib/audioPlayer');
          audioPlayer.resetPlaybackState();
        } catch {}
      }
      return;
    }

    if (queue.length === 0 || queueIndex <= 0) {
      set({ progress: 0 });
      if (typeof window !== 'undefined') {
        try {
          const { audioPlayer } = require('@/lib/audioPlayer');
          audioPlayer.resetPlaybackState();
        } catch {}
      }
      return;
    }

    const prevIndex = queueIndex - 1;
    const prevTrack = queue[prevIndex];
    if (prevTrack) {
      if (typeof window !== 'undefined') {
        try {
          const { audioPlayer } = require('@/lib/audioPlayer');
          audioPlayer.resetPlaybackState();
        } catch {}
      }

      const cleanTrack: Track = {
        ...prevTrack,
        poster: prevTrack.poster || prevTrack.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${prevTrack.videoId}/hqdefault.jpg`,
        fallbackPoster: prevTrack.fallbackPoster || `https://i.ytimg.com/vi/${prevTrack.videoId}/hqdefault.jpg`
      };
      set({
        currentTrack: cleanTrack,
        queueIndex: prevIndex,
        isPlaying: true,
        isLoading: true,
        progress: 0,
        error: null
      });
      get().recordPlay(cleanTrack);

      if (cleanTrack.videoId.startsWith('sp_')) {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        fetch(`${backendUrl}/api/spotify/resolve-track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: cleanTrack.title,
            artist: cleanTrack.artists?.[0]?.name || ''
          })
        })
          .then(res => res.json())
          .then(match => {
            if (match && match.videoId) {
              const targetVid = cleanTrack.videoId;
              const matchPoster = match.poster || match.thumbnails?.[0]?.url;
              const matchFallback = match.fallbackPoster || (match.videoId ? `https://i.ytimg.com/vi/${match.videoId}/mqdefault.jpg` : undefined);
              get().updateTrackResolution(targetVid, match.videoId, matchPoster, matchFallback, match.thumbnails);
            }
          })
          .catch(() => {});
      }
    }
  },

  setVolume: (volume) => set({ volume }),
  setProgress: (progress) => set({ progress }),
  setTrackDuration: (duration) => set((state) => (
    state.currentTrack ? { currentTrack: { ...state.currentTrack, duration } } : {}
  )),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsExpanded: (isExpanded) => set({ isExpanded }),
  setIsQueueOpen: (isQueueOpen) => set({ isQueueOpen }),
  setIsFullScreenLyricsOpen: (isFullScreenLyricsOpen) => set({ isFullScreenLyricsOpen }),
  setError: (error) => set({ error, isLoading: false }),

  toggleShuffle: () => set((state) => ({ isShuffled: !state.isShuffled })),

  toggleRepeat: () => set((state) => {
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
    const nextIndex = (modes.indexOf(state.repeatMode) + 1) % modes.length;
    return { repeatMode: modes[nextIndex] };
  }),

  addToQueue: (track) => set((state) => ({
    queue: [...state.queue, track],
    queueIndex: state.queueIndex === -1 ? 0 : state.queueIndex,
    currentTrack: state.currentTrack || track
  })),

  playNextInQueue: (track) => set((state) => {
    if (state.queue.length === 0 || !state.currentTrack) {
      return {
        queue: [track],
        queueIndex: 0,
        currentTrack: track
      };
    }
    const newQueue = [...state.queue];
    const insertIndex = Math.max(0, state.queueIndex + 1);
    newQueue.splice(insertIndex, 0, track);
    return { queue: newQueue };
  }),

  removeFromQueue: (index) => set((state) => {
    const newQueue = [...state.queue];
    newQueue.splice(index, 1);

    let newIndex = state.queueIndex;
    if (index < state.queueIndex) {
      newIndex--;
    } else if (index === state.queueIndex) {
      newIndex = Math.min(index, newQueue.length - 1);
    }

    return {
      queue: newQueue,
      queueIndex: newIndex,
      currentTrack: newIndex >= 0 ? newQueue[newIndex] : null
    };
  }),

  reorderQueue: (startIndex, endIndex) => set((state) => {
    const newQueue = Array.from(state.queue);
    const [removed] = newQueue.splice(startIndex, 1);
    newQueue.splice(endIndex, 0, removed);

    let newIndex = state.queueIndex;
    if (startIndex === state.queueIndex) {
      newIndex = endIndex;
    } else if (startIndex < state.queueIndex && endIndex >= state.queueIndex) {
      newIndex--;
    } else if (startIndex > state.queueIndex && endIndex <= state.queueIndex) {
      newIndex++;
    }

    return { queue: newQueue, queueIndex: newIndex };
  }),

  clearQueue: () => {
    set({ queue: [], queueIndex: -1, currentTrack: null, isPlaying: false, progress: 0 });
  },
}));

// Register onLogout hook to immediately purge user database data upon signing out
registerOnLogout(() => {
  usePlayerStore.getState().handleUserLogout();
});
