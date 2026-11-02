"use client";

import { useState, useEffect } from 'react';
import { usePlayerStore, Track, FollowedArtist, getPlaylistCover } from '@/store/playerStore';
import { useAuthStore } from '@/store/authStore';
import {
  Heart,
  Sparkles,
  TrendingUp,
  ArrowDownCircle,
  Check,
  MoreVertical,
  Plus,
  ArrowLeft,
  Music,
  Play,
  Shuffle,
  Trash2,
  UserCheck,
  UserPlus,
  ExternalLink,
  ListPlus,
  Lock,
  Music2,
  RefreshCw,
  Info,
  Link2,
  X,
  Loader2,
  Smartphone,
  Monitor,
  Copy,
  CheckCheck,
  Share2,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import MusicPoster from '@/components/ui/MusicPoster';
import SongActionMenu from '@/components/ui/SongActionMenu';

const LIBRARY_FILTER_CHIPS = [
  "Your library",
  "Favorites",
  "Followed Artists",
  "Most Played",
  "Downloaded",
  "Your Playlists",
  "Spotify Playlists"
];

// Curated starter tracks if user has fresh/empty history
const STARTER_POPULAR_TRACKS: Track[] = [
  {
    videoId: "Qr5Kb3Ku99s",
    title: "Make Me A Believer",
    artists: [{ name: "Thousand Foot Krutch" }],
    duration: 170,
    durationFormatted: "2:50",
    poster: "https://i.ytimg.com/vi/Qr5Kb3Ku99s/hqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/Qr5Kb3Ku99s/hqdefault.jpg"
  },
  {
    videoId: "kJQP7kiw5Fk",
    title: "Despacito",
    artists: [{ name: "Luis Fonsi, Daddy Yankee" }],
    duration: 228,
    durationFormatted: "3:48",
    poster: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg"
  },
  {
    videoId: "fJ9rUzIMcZQ",
    title: "Bohemian Rhapsody",
    artists: [{ name: "Queen" }],
    duration: 359,
    durationFormatted: "5:59",
    poster: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg"
  },
  {
    videoId: "4NRXx6U8ABQ",
    title: "Blinding Lights",
    artists: [{ name: "The Weeknd" }],
    duration: 200,
    durationFormatted: "3:20",
    poster: "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg",
    fallbackPoster: "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg"
  }
];

// Recommended artists with verified authentic artist portraits from YouTube Music
const RECOMMENDED_ARTISTS: FollowedArtist[] = [
  {
    name: "The Weeknd",
    subscribers: "40.2M subscribers",
    avatar: "https://lh3.googleusercontent.com/U-SAmNOu4TynE818gLCfKsuHZ0U5YNEtO9mrjSI9WCCKERs98LzrCal5kajBBTQNwdcisoB2Bn-pHp4=s800-c-k-c0x00ffffff-no-rj"
  },
  {
    name: "Taylor Swift",
    subscribers: "63.5M subscribers",
    avatar: "https://yt3.googleusercontent.com/RCpTA6EXJQyjVFDosWOKa2SMmqkua_lA9mHPDWWciLwgqpZLz-k8rXWRF_367trrQ7up9BUwCbk6kRk=s800-c-k-c0x00ffffff-no-rj"
  },
  {
    name: "Arijit Singh",
    subscribers: "6.52M subscribers",
    avatar: "https://lh3.googleusercontent.com/W_yOqnKSDYyeVOY_AsXhuAtb6rW3vCL3GtJ9DA1GxWOrJfyeSOqzvTv_TkFHijdkVPXWutASBlRFPg=s800-c-k-c0x00ffffff-no-rj"
  },
  {
    name: "Imagine Dragons",
    subscribers: "33.4M subscribers",
    avatar: "https://lh3.googleusercontent.com/TAadzeojHFGU1EJ5jnOWDn6K8Cf8O2x0F04PVxnZwUEhcaYN0pA0dic49VU7OKGs7oovBTylWx70xhY=s800-c-k-c0x00ffffff-no-rj"
  },
  {
    name: "Billie Eilish",
    subscribers: "58.7M subscribers",
    avatar: "https://lh3.googleusercontent.com/tQC4rOL6xz6FhmFr0ggQExxyGbYSOsyveXVSnPBh2WjEyIzQ9pMHablLJ-0GlMBrLBlBrbWQGmzrV6KN=s800-c-k-c0x00ffffff-no-rj"
  },
  {
    name: "Dua Lipa",
    subscribers: "25.5M subscribers",
    avatar: "https://lh3.googleusercontent.com/aFx8s1fTuelgxONGbezmTG0EKR8r82uB5H-Q6ZJtssyCWLJWF8GfZNr4tHo84sXdFCPBKrA4R6zXOss=s800-c-k-c0x00ffffff-no-rj"
  },
  {
    name: "Ed Sheeran",
    subscribers: "59.3M subscribers",
    avatar: "https://lh3.googleusercontent.com/jQoBIAS6JjFGpcqQY1M_Mh3AasOvFENCdVRxkgax1a0K6qiq7AgE3MbJ6Jtt-Jndcarvoawmrg66KTny=s800-c-k-c0x00ffffff-no-rj"
  }
];

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function LibraryPage() {
  const {
    playlists,
    playTrack,
    createPlaylist,
    deletePlaylist,
    removeTrackFromPlaylist,
    addTrackToPlaylist,
    currentTrack,
    isPlaying,
    favorites,
    toggleFavorite,
    isFavorite,
    followedArtists,
    toggleFollowArtist,
    playHistory,
    downloadedTracks,
    toggleDownload,
    openArtistModal,
    addToQueue,
    openCreatePlaylist
  } = usePlayerStore();

  const { isAuthenticated, user, openAuthModal } = useAuthStore();

  const [activeChip, setActiveChip] = useState("Your library");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);

  // Spotify Playlist link import & step guide state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [spotifyUrlInput, setSpotifyUrlInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [guidePlatform, setGuidePlatform] = useState<'mobile' | 'desktop'>('mobile');
  const [copiedLink, setCopiedLink] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<{ id: string; name: string } | null>(null);
  const [songToDelete, setSongToDelete] = useState<Track | null>(null);
  const [isLoadingSpotifyTracks, setIsLoadingSpotifyTracks] = useState(false);

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);
  const spotifyPlaylists = playlists.filter(
    p => p.source === 'spotify' &&
    !p.id.startsWith('demo_') &&
    !p.id.startsWith('sp_pl_demo') &&
    !p.name.includes('(Spotify)') &&
    p.name !== 'null' &&
    p.name !== 'undefined' &&
    (p.spotify_playlist_id ? p.spotify_playlist_id.length >= 15 : p.id.replace('sp_pl_', '').length >= 15)
  );
  const userPlaylists = playlists.filter(p => p.source !== 'spotify' && !p.name.includes('(Spotify)'));

  const handleConfirmDeletePlaylist = () => {
    if (!playlistToDelete) return;
    deletePlaylist(playlistToDelete.id);
    const cleanTargetId = playlistToDelete.id.replace('sp_pl_', '');
    if (
      selectedPlaylistId === playlistToDelete.id ||
      (selectedPlaylistId && selectedPlaylistId.replace('sp_pl_', '') === cleanTargetId)
    ) {
      setSelectedPlaylistId(null);
    }
    useAuthStore.getState().setToast(`Deleted "${playlistToDelete.name}".`, 'info');
    setPlaylistToDelete(null);
  };

  const handleConfirmDeleteSong = () => {
    if (!songToDelete) return;
    toggleDownload(songToDelete);
    useAuthStore.getState().setToast(`Removed "${songToDelete.title}" from downloaded songs.`, 'info');
    setSongToDelete(null);
  };

  // Reset selected playlist on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setSelectedPlaylistId(null);
    }
  }, [isAuthenticated]);

  // Auto-heal Spotify playlist tracks that lack individual artwork or mistakenly have the playlist group banner
  useEffect(() => {
    if (!selectedPlaylist || selectedPlaylist.tracks.length === 0) return;
    const plCover = selectedPlaylist.cover_url;
    const needsArt = selectedPlaylist.tracks.filter(t => {
      const isBogus = Boolean(plCover && (t.poster === plCover || t.fallbackPoster === plCover));
      const hasRealPoster = Boolean(t.poster && !isBogus);
      return !hasRealPoster && (t.videoId.startsWith('sp_') || (t as any).spotifyId);
    });

    if (needsArt.length === 0) return;

    let isCancelled = false;
    const resolveArtwork = async () => {
      // Resolve up to 40 tracks in parallel batches of 10
      for (let i = 0; i < Math.min(needsArt.length, 40); i += 10) {
        if (isCancelled) break;
        const chunk = needsArt.slice(i, i + 10);
        await Promise.all(
          chunk.map(async (track) => {
            if (isCancelled) return;
            const spId = (track as any).spotifyId || track.videoId.replace('sp_', '').trim();
            if (!spId || spId.startsWith('track_')) return;
            try {
              const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${spId}`);
              if (res.ok) {
                const data = await res.json();
                if (data?.thumbnail_url && !isCancelled) {
                  const hd = data.thumbnail_url.replace("ab67616d00001e02", "ab67616d0000b273");
                  usePlayerStore.getState().updatePlaylistTrackArtwork(selectedPlaylist.id, track.videoId, hd);
                }
              }
            } catch {}
          })
        );
      }
    };

    resolveArtwork();
    return () => {
      isCancelled = true;
    };
  }, [selectedPlaylistId, selectedPlaylist?.tracks.length]);

  // Load Spotify playlist tracks on-demand when user opens a lightweight Spotify playlist
  useEffect(() => {
    if (!selectedPlaylist) return;
    if (selectedPlaylist.source === 'spotify' && selectedPlaylist.tracks.length === 0) {
      const spId = selectedPlaylist.spotify_playlist_id || selectedPlaylist.id.replace('sp_pl_', '');
      if (!spId) return;

      let isCancelled = false;
      setIsLoadingSpotifyTracks(true);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      fetch(`${backendUrl}/api/spotify/playlist/${spId}`)
        .then(res => res.json())
        .then(data => {
          if (isCancelled || !data?.playlist?.tracks) return;
          const cleanTracks = (data.playlist.tracks || []).map((t: Track) => {
            const isSame = Boolean(
              selectedPlaylist.cover_url &&
              (t.poster === selectedPlaylist.cover_url || t.fallbackPoster === selectedPlaylist.cover_url)
            );
            return {
              ...t,
              poster: isSame ? undefined : t.poster,
              fallbackPoster: isSame ? undefined : t.fallbackPoster
            };
          });

          const currentPlaylists = usePlayerStore.getState().playlists;
          const updated = currentPlaylists.map(p =>
            p.id === selectedPlaylist.id ? { ...p, tracks: cleanTracks } : p
          );
          usePlayerStore.setState({ playlists: updated });
        })
        .catch(err => console.warn('Failed to load Spotify tracks on-demand:', err))
        .finally(() => {
          if (!isCancelled) setIsLoadingSpotifyTracks(false);
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [selectedPlaylistId, selectedPlaylist?.tracks.length]);

  const handleImportSpotifyUrl = async (e?: React.FormEvent, customUrl?: string) => {
    if (e) e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal('login', 'Please sign in with your email to import Spotify playlists.');
      return;
    }
    const cleanUrl = (customUrl || spotifyUrlInput).trim();
    if (!cleanUrl) return;

    // Strict validation: Must match Spotify playlist URL pattern or valid Spotify ID (15-35 chars)
    const isSpotifyPattern = /(?:spotify\.com\/(?:intl-[a-z]+\/)?playlist\/[a-zA-Z0-9]{15,35}|spotify:playlist:[a-zA-Z0-9]{15,35}|^[a-zA-Z0-9]{15,35}$)/i.test(cleanUrl);
    if (!isSpotifyPattern) {
      setImportError('Invalid link. Please enter a valid Spotify playlist link (e.g. https://open.spotify.com/playlist/...).');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${backendUrl}/api/spotify/import-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: cleanUrl })
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.detail || 'Failed to import Spotify playlist. Please ensure the link is public.');
        setIsImporting(false);
        return;
      }

      const importedPl = data.playlist;
      if (!importedPl || !importedPl.name || importedPl.name === 'null' || !Array.isArray(importedPl.tracks) || importedPl.tracks.length === 0) {
        setImportError('Could not import playlist. Please check that the link is valid, public, and contains tracks.');
        setIsImporting(false);
        return;
      }
      const plId = importedPl.spotify_id ? `sp_pl_${importedPl.spotify_id}` : `pl_${Date.now()}`;
      const cleanTracks = (importedPl.tracks || []).map((t: Track) => {
        const isSame = Boolean(
          importedPl.cover_url && (t.poster === importedPl.cover_url || t.fallbackPoster === importedPl.cover_url)
        );
        return {
          ...t,
          poster: isSame ? undefined : t.poster,
          fallbackPoster: isSame ? undefined : t.fallbackPoster
        };
      });
      const newPlaylist = {
        id: plId,
        name: importedPl.name,
        description: importedPl.description,
        cover_url: importedPl.cover_url,
        source: 'spotify' as const,
        spotify_playlist_id: importedPl.spotify_id,
        tracks: cleanTracks,
        createdAt: Date.now()
      };

      const existingIdx = playlists.findIndex(p => p.spotify_playlist_id === importedPl.spotify_id || p.id === plId);
      let updated;
      if (existingIdx >= 0) {
        updated = [...playlists];
        updated[existingIdx] = newPlaylist;
      } else {
        updated = [newPlaylist, ...playlists];
      }

      usePlayerStore.setState({ playlists: updated });
      if (token) {
        await usePlayerStore.getState().fetchUserLibrary(token);
      }

      setIsImportModalOpen(false);
      setSpotifyUrlInput('');
      setIsImporting(false);
      setSelectedPlaylistId(newPlaylist.id);
      setActiveChip('Spotify Playlists');
      useAuthStore.getState().setToast(`Imported "${newPlaylist.name}" (${newPlaylist.tracks.length} songs)!`, 'success');
    } catch (err: any) {
      setImportError(err.message || 'Network error.');
      setIsImporting(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setSpotifyUrlInput(text.trim());
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2000);
        }
      }
    } catch {
      // Clipboard read permission might not be granted
    }
  };

  // Derive most played tracks sorted by playCount descending
  const mostPlayedTracks = [...playHistory].sort((a, b) => b.playCount - a.playCount);

  // Derive recently played tracks (most recent first)
  const recentTracks = playHistory.length > 0
    ? playHistory.map(h => h.track)
    : STARTER_POPULAR_TRACKS;

  const handleCreatePlaylist = () => {
    if (!isAuthenticated) {
      openAuthModal('login', 'Please sign in with your email to create and organize custom playlists.');
      return;
    }
    openCreatePlaylist(() => {
      setSelectedPlaylistId(null);
      setActiveChip("Your Playlists");
    });
  };

  const handlePlaySong = (track: Track, allTracks: Track[]) => {
    playTrack(track, allTracks);
  };

  const handleShufflePlay = (trackList: Track[]) => {
    if (trackList.length > 0) {
      const shuffled = [...trackList].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  const handleAddToPlaylistPrompt = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal('login', 'Please sign in with your email to add songs to playlists.');
      return;
    }
    if (userPlaylists.length === 0) {
      const name = prompt("Enter a name for your first playlist:");
      if (name && name.trim()) {
        const id = createPlaylist(name.trim());
        if (id) {
          addTrackToPlaylist(id, track);
          useAuthStore.getState().setToast(`Created playlist "${name}" and added track!`);
        }
      }
      return;
    }
    const pListStr = userPlaylists.map((p, i) => `${i + 1}: ${p.name}`).join('\n');
    const choice = prompt(`Select playlist number:\n${pListStr}`);
    if (choice) {
      const idx = parseInt(choice) - 1;
      if (userPlaylists[idx]) {
        addTrackToPlaylist(userPlaylists[idx].id, track);
        useAuthStore.getState().setToast(`Added to "${userPlaylists[idx].name}"!`);
      }
    }
    setActiveMenuTrackId(null);
  };

  return (
    <div className="space-y-6 pb-24 select-none max-w-7xl mx-auto">
      {/* Unauthenticated Guest Banner */}
      {!isAuthenticated && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#5AF9DB]/10 via-[#181820] to-[#121216] border border-[#5AF9DB]/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#5AF9DB]/15 border border-[#5AF9DB]/40 flex items-center justify-center text-[#5AF9DB] flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Sign In to Your Account
              </h4>
              <p className="text-xs text-neutral-400 mt-0.5 max-w-xl">
                Sign in with your Email to save favorites, create playlists, and import Spotify playlists across your devices.
              </p>
            </div>
          </div>
          <button
            onClick={() => openAuthModal('login')}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#5AF9DB] to-teal-400 text-black font-bold text-xs hover:opacity-90 active:scale-95 transition-all shadow-[0_0_15px_rgba(90,249,219,0.25)] whitespace-nowrap cursor-pointer"
          >
            Sign In with Email
          </button>
        </div>
      )}

      {/* Filter Chips Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 hide-scrollbar">
        {LIBRARY_FILTER_CHIPS.map((chip) => {
          const isSelected = activeChip === chip;
          return (
            <button
              key={chip}
              onClick={() => {
                setActiveChip(chip);
                setSelectedPlaylistId(null);
              }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${isSelected
                  ? 'bg-[#2b2b2e] text-white border border-white/20'
                  : 'bg-[#18181b]/70 hover:bg-[#27272a] text-[#d4d4d8] border border-white/5'
                }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{chip}</span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: FAVORITES */}
      {activeChip === "Favorites" ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#fb7185] text-red-950 shadow-md">
                <Heart className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Favorite Songs</h3>
                <p className="text-xs text-neutral-400">
                  {isAuthenticated ? `${favorites.length} saved songs (Synced to database)` : "Sign in required to save favorites"}
                </p>
              </div>
            </div>

            {favorites.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePlaySong(favorites[0], favorites)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-xs font-bold shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  Play All
                </button>
                <button
                  onClick={() => handleShufflePlay(favorites)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Shuffle Favorites"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="text-center py-16 bg-[#16161a] rounded-3xl border border-white/5 space-y-4 p-8">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Sign In to Save Favorites</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Favorite songs are synced to your account database so you never lose them. Sign in with your email to start saving tracks.
              </p>
              <button
                onClick={() => openAuthModal('login', 'Sign in with your email to access and save your favorite songs.')}
                className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-bold shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                Sign In With Email
              </button>
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-16 bg-[#16161a] rounded-3xl border border-white/5 space-y-3 p-8">
              <Heart className="w-10 h-10 text-neutral-600 mx-auto" />
              <h4 className="text-base font-bold text-white">No favorite songs yet</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Tap the heart icon on any track in Search, Home, or the Music Player to add it to your favorites.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {favorites.map((track, idx) => {
                const isPlayingThis = currentTrack?.videoId === track.videoId && isPlaying;
                return (
                  <div
                    key={`fav-${track.videoId}-${idx}`}
                    onClick={() => handlePlaySong(track, favorites)}
                    className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-[#18181c] transition-colors cursor-pointer border border-transparent hover:border-white/5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
                        <MusicPoster
                          src={track.poster || track.thumbnails?.[0]?.url}
                          fallbackSrc={track.fallbackPoster}
                          videoId={track.videoId}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className={`text-sm font-semibold truncate ${isPlayingThis ? 'text-[#00d2c4]' : 'text-white'}`}>
                          {track.title}
                        </h4>
                        <p
                          onClick={(e) => {
                            e.stopPropagation();
                            const primaryA = track.artists?.[0];
                            const aName = (typeof primaryA === 'string' ? primaryA : primaryA?.name) || 'Artist';
                            const aId = typeof primaryA === 'object' ? primaryA?.id : undefined;
                            openArtistModal({ name: aName, id: aId, avatar: track.poster || track.thumbnails?.[0]?.url });
                          }}
                          className="text-xs text-neutral-400 truncate hover:text-white mt-0.5 cursor-pointer"
                        >
                          {track.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ') || 'Artist'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-mono text-neutral-400 hidden sm:inline mr-2">
                        {track.durationFormatted || '3:30'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(track);
                        }}
                        className="p-2 text-red-500 hover:text-red-400 transition-colors"
                        title="Remove from favorites"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                      <SongActionMenu
                        track={track}
                        buttonClassName="p-2 text-neutral-400 hover:text-white rounded-full transition-colors cursor-pointer"
                        iconClassName="w-4 h-4"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeChip === "Followed Artists" ? (
        /* VIEW 2: FOLLOWED ARTISTS */
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[#facc15] text-black shadow-md">
              <Sparkles className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Followed Artists</h3>
              <p className="text-xs text-neutral-400">
                {isAuthenticated ? `${followedArtists.length} artists followed` : 'Sign in required'}
              </p>
            </div>
          </div>

          {!isAuthenticated ? (
            <div className="text-center py-16 bg-[#16161a] rounded-3xl border border-white/5 space-y-4 p-8">
              <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto text-yellow-400">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Sign In to View Followed Artists</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Followed artists are synced to your account database. Sign in with your email to see and manage the artists you follow.
              </p>
              <button
                onClick={() => openAuthModal('login', 'Sign in with your email to access your followed artists.')}
                className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-bold shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                Sign In With Email
              </button>
            </div>
          ) : followedArtists.length === 0 ? (
            <div className="space-y-6">
              <div className="text-center py-10 bg-[#16161a] rounded-3xl border border-white/5 space-y-2 p-6">
                <Sparkles className="w-8 h-8 text-yellow-500/80 mx-auto" />
                <h4 className="text-base font-bold text-white">No followed artists yet</h4>
                <p className="text-xs text-neutral-400">Follow your favorite artists to stay updated with their songs.</p>
              </div>

              {/* Recommended Artists Carousel / Grid */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                  Recommended Artists To Follow
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {RECOMMENDED_ARTISTS.map((art) => (
                    <div
                      key={art.name}
                      onClick={() => openArtistModal({ name: art.name, avatar: art.avatar, subscribers: art.subscribers })}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[#18181c] hover:bg-[#202028] border border-white/5 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={art.avatar}
                          alt={art.name}
                          className="w-12 h-12 rounded-full object-cover border border-white/10 group-hover:scale-105 transition-transform"
                        />
                        <div className="min-w-0">
                          <h5 className="text-sm font-bold text-white truncate group-hover:text-[#00d2c4] transition-colors">
                            {art.name}
                          </h5>
                          <p className="text-xs text-neutral-400 truncate">{art.subscribers}</p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFollowArtist(art);
                        }}
                        className="p-2 text-neutral-400 hover:text-white transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {followedArtists.map((artist) => (
                  <div
                    key={artist.name}
                    onClick={() => openArtistModal(artist)}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-[#18181c] hover:bg-[#202028] border border-white/5 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {artist.avatar ? (
                        <img
                          src={artist.avatar}
                          alt={artist.name}
                          className="w-12 h-12 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-white font-bold text-base">
                          {artist.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-[#00d2c4] transition-colors">
                          {artist.name}
                        </h4>
                        <p className="text-xs text-neutral-400 truncate">
                          {artist.subscribers || 'Artist'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFollowArtist(artist);
                      }}
                      className="p-2 text-[#00d2c4] hover:text-red-400 transition-colors"
                      title="Following"
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Recommended Artists to Follow shown below followed artists */}
              {(() => {
                const unFollowed = RECOMMENDED_ARTISTS.filter(
                  rec => !followedArtists.some(f => f.name.toLowerCase() === rec.name.toLowerCase())
                );
                if (unFollowed.length === 0) return null;
                return (
                  <div className="pt-4 border-t border-white/10 space-y-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                      Recommended Artists To Follow
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {unFollowed.map((art) => (
                        <div
                          key={art.name}
                          onClick={() => openArtistModal({ name: art.name, avatar: art.avatar, subscribers: art.subscribers })}
                          className="flex items-center justify-between p-3 rounded-2xl bg-[#18181c] hover:bg-[#202028] border border-white/5 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={art.avatar}
                              alt={art.name}
                              className="w-12 h-12 rounded-full object-cover border border-white/10 group-hover:scale-105 transition-transform"
                            />
                            <div className="min-w-0">
                              <h5 className="text-sm font-bold text-white truncate group-hover:text-[#00d2c4] transition-colors">
                                {art.name}
                              </h5>
                              <p className="text-xs text-neutral-400 truncate">{art.subscribers}</p>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFollowArtist(art);
                            }}
                            className="p-2 text-neutral-400 hover:text-white transition-colors"
                            title={`Follow ${art.name}`}
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : activeChip === "Most Played" ? (
        /* VIEW 3: MOST PLAYED */
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#06b6d4] text-black shadow-md">
                <TrendingUp className="w-6 h-6 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Most Played Tracks</h3>
                <p className="text-xs text-neutral-400">Ranked by your play count</p>
              </div>
            </div>

            {mostPlayedTracks.length > 0 && (
              <button
                onClick={() => handlePlaySong(mostPlayedTracks[0].track, mostPlayedTracks.map(m => m.track))}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-xs font-bold shadow-md cursor-pointer hover:scale-105 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                Play All
              </button>
            )}
          </div>

          {mostPlayedTracks.length === 0 ? (
            <div className="text-center py-16 bg-[#16161a] rounded-3xl border border-white/5 space-y-3 p-8">
              <TrendingUp className="w-10 h-10 text-neutral-600 mx-auto" />
              <h4 className="text-base font-bold text-white">No listening data yet</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Start playing tracks across VibeMusic and your personal most played songs will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {mostPlayedTracks.map((item, idx) => {
                const track = item.track;
                const isPlayingThis = currentTrack?.videoId === track.videoId && isPlaying;
                return (
                  <div
                    key={`mp-${track.videoId}-${idx}`}
                    onClick={() => handlePlaySong(track, mostPlayedTracks.map(m => m.track))}
                    className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-[#18181c] transition-colors cursor-pointer border border-transparent hover:border-white/5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <span className="w-5 text-center text-xs font-bold text-neutral-500 font-mono">
                        #{idx + 1}
                      </span>
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
                        <MusicPoster
                          src={track.poster || track.thumbnails?.[0]?.url}
                          fallbackSrc={track.fallbackPoster}
                          videoId={track.videoId}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className={`text-sm font-semibold truncate ${isPlayingThis ? 'text-[#00d2c4]' : 'text-white'}`}>
                          {track.title}
                        </h4>
                        <p className="text-xs text-neutral-400 truncate mt-0.5">
                          {track.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ') || 'Artist'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 text-cyan-300">
                        {item.playCount} {item.playCount === 1 ? 'play' : 'plays'}
                      </span>
                      <SongActionMenu
                        track={track}
                        buttonClassName="p-2 text-neutral-400 hover:text-white rounded-full transition-colors cursor-pointer"
                        iconClassName="w-4 h-4"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeChip === "Downloaded" ? (
        /* VIEW 4: DOWNLOADED / SAVED TRACKS */
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#4ade80] text-black shadow-md">
                <ArrowDownCircle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Downloaded Tracks</h3>
                <p className="text-xs text-neutral-400">{downloadedTracks.length} tracks saved offline</p>
              </div>
            </div>

            {downloadedTracks.length > 0 && (
              <button
                onClick={() => handlePlaySong(downloadedTracks[0], downloadedTracks)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-xs font-bold shadow-md cursor-pointer hover:scale-105 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                Play Offline
              </button>
            )}
          </div>

          {downloadedTracks.length === 0 ? (
            <div className="text-center py-16 bg-[#16161a] rounded-3xl border border-white/5 space-y-3 p-8">
              <ArrowDownCircle className="w-10 h-10 text-neutral-600 mx-auto" />
              <h4 className="text-base font-bold text-white">No downloaded tracks</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Save songs offline using the options menu on any track to listen anytime without data.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {downloadedTracks.map((track, idx) => {
                const isPlayingThis = currentTrack?.videoId === track.videoId && isPlaying;
                return (
                  <div
                    key={`down-${track.videoId}-${idx}`}
                    onClick={() => handlePlaySong(track, downloadedTracks)}
                    className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-[#18181c] transition-colors cursor-pointer border border-transparent hover:border-white/5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
                        <MusicPoster
                          src={track.poster || track.thumbnails?.[0]?.url}
                          fallbackSrc={track.fallbackPoster}
                          videoId={track.videoId}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className={`text-sm font-semibold truncate ${isPlayingThis ? 'text-[#00d2c4]' : 'text-white'}`}>
                          {track.title}
                        </h4>
                        <p className="text-xs text-neutral-400 truncate mt-0.5">
                          {track.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ') || 'Artist'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Saved
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSongToDelete(track);
                        }}
                        className="p-2 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove download"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : selectedPlaylist ? (
        /* VIEW 5: SELECTED PLAYLIST DETAIL */
        <div className="space-y-6 animate-in fade-in duration-200">
          <button
            onClick={() => setSelectedPlaylistId(null)}
            className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Library</span>
          </button>

          <div className="flex items-center justify-between bg-[#18181c] p-6 rounded-3xl border border-white/5">
            <div className="flex items-center gap-5">
              {(() => {
                const cover = getPlaylistCover(selectedPlaylist);
                return cover ? (
                  <img
                    src={cover}
                    alt={selectedPlaylist.name}
                    className="w-24 h-24 rounded-2xl object-cover shadow-lg border border-white/10"
                  />
                ) : (
                  <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg ${selectedPlaylist.source === 'spotify'
                      ? 'bg-gradient-to-tr from-[#1DB954] to-emerald-700'
                      : 'bg-gradient-to-tr from-[#00d2c4] to-blue-600'
                    }`}>
                    {selectedPlaylist.name.charAt(0).toUpperCase()}
                  </div>
                );
              })()}
              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">{selectedPlaylist.name}</h2>
                {selectedPlaylist.description && (
                  <p className="text-xs text-neutral-300 max-w-lg line-clamp-2">{selectedPlaylist.description}</p>
                )}
                <p className="text-xs text-neutral-400">{selectedPlaylist.tracks.length} tracks</p>
                {selectedPlaylist.tracks.length > 0 && (
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => handlePlaySong(selectedPlaylist.tracks[0], selectedPlaylist.tracks)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black font-semibold text-xs shadow-md cursor-pointer hover:scale-105 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      Play All
                    </button>
                    <button
                      onClick={() => handleShufflePlay(selectedPlaylist.tracks)}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title="Shuffle"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setPlaylistToDelete({ id: selectedPlaylist.id, name: selectedPlaylist.name });
              }}
              className="p-2.5 rounded-full text-neutral-400 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
              title="Delete Playlist"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1">
            {selectedPlaylist.tracks.length === 0 ? (
              isLoadingSpotifyTracks ? (
                <div className="text-center py-16 bg-[#16161a] rounded-2xl border border-white/5 space-y-3 p-6 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-neutral-200 font-semibold">Loading Spotify tracks on demand...</p>
                  <p className="text-xs text-neutral-400">Fetching high quality audio streams and artwork</p>
                </div>
              ) : (
                <div className="text-center py-16 bg-[#16161a] rounded-2xl border border-white/5 space-y-2 p-6">
                  <Music className="w-8 h-8 text-neutral-600 mx-auto" />
                  <p className="text-sm text-neutral-300 font-semibold">This playlist is empty</p>
                  <p className="text-xs text-neutral-400">Search songs or tap the 3-dots menu on any song to add them here.</p>
                </div>
              )
            ) : (
              selectedPlaylist.tracks.map((t, idx) => (
                <div
                  key={`${t.videoId}-${idx}`}
                  onClick={() => handlePlaySong(t, selectedPlaylist.tracks)}
                  className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-[#18181c] transition-colors cursor-pointer border border-transparent hover:border-white/5"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {(() => {
                      // Ensure Spotify playlist collage banner is not erroneously used as track poster
                      const isPosterSameAsPlaylist = Boolean(
                        selectedPlaylist.source === 'spotify' &&
                        selectedPlaylist.cover_url &&
                        (t.poster === selectedPlaylist.cover_url || t.fallbackPoster === selectedPlaylist.cover_url)
                      );
                      const trackPoster = isPosterSameAsPlaylist ? undefined : (t.poster || t.thumbnails?.[0]?.url);
                      const trackFallback = isPosterSameAsPlaylist ? undefined : t.fallbackPoster;
                      return (
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
                          <MusicPoster
                            src={trackPoster}
                            fallbackSrc={trackFallback}
                            videoId={t.videoId}
                            alt={t.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      );
                    })()}
                    <div className="min-w-0 flex-1 pr-2">
                      <h4 className="text-sm font-semibold text-white truncate">{t.title}</h4>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">
                        {t.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ') || 'Artist'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(t);
                      }}
                      className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                      title={isFavorite(t.videoId) ? "Remove Favorite" : "Favorite"}
                    >
                      <Heart className={`w-4 h-4 ${isFavorite(t.videoId) ? 'text-red-500 fill-red-500' : ''}`} />
                    </button>

                    <SongActionMenu
                      track={t}
                      buttonClassName="p-2 text-neutral-400 hover:text-white rounded-full transition-colors cursor-pointer"
                      iconClassName="w-4 h-4"
                    />

                    {selectedPlaylist.source !== 'spotify' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrackFromPlaylist(selectedPlaylist.id, t.videoId);
                        }}
                        className="p-2 text-neutral-400 hover:text-red-400 transition-colors"
                        title="Remove from playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : activeChip === "Spotify Playlists" ? (
        /* VIEW 6: SPOTIFY IMPORTED PLAYLISTS */
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 flex-shrink-0">
                <img 
                  src="/spotify-app-logo.png" 
                  alt="Spotify" 
                  className="w-full h-full object-contain" 
                />
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-bold text-white leading-none">
                  Spotify Playlist
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    openAuthModal('login', 'Please sign in with your email to import Spotify playlists.');
                    return;
                  }
                  setIsImportModalOpen(true);
                  setImportError(null);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold transition-all cursor-pointer shadow-md shadow-[#1DB954]/25 hover:scale-105 active:scale-95"
                title="Paste any Spotify playlist link"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Import by Link</span>
              </button>
            </div>
          </div>

          {/* Locked / Empty State */}
          {!isAuthenticated ? (
            <div className="text-center py-16 bg-[#16161a] rounded-3xl border border-white/5 space-y-4 p-8">
              <div className="w-12 h-12 rounded-2xl bg-[#1DB954]/10 border border-[#1DB954]/20 flex items-center justify-center mx-auto text-[#1DB954]">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Sign In to Import Spotify Playlists</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Imported Spotify playlists are synced to your account database so you can stream them anywhere. Sign in with your email to import and manage playlists.
              </p>
              <button
                onClick={() => openAuthModal('login', 'Please sign in with your email to import Spotify playlists.')}
                className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-bold shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                Sign In With Email
              </button>
            </div>
          ) : spotifyPlaylists.length === 0 ? (
            <div className="text-center py-16 bg-[#16161a] rounded-3xl border border-white/5 space-y-3 p-8">
              <Music className="w-10 h-10 text-neutral-600 mx-auto" />
              <h4 className="text-base font-bold text-white">No playlists yet</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Import public Spotify playlists to organize your favorite tracks. All playlists are saved to your account.
              </p>
              <button
                onClick={() => {
                  setIsImportModalOpen(true);
                  setImportError(null);
                }}
                className="px-5 py-2.5 rounded-full bg-white text-black text-xs font-bold shadow-md cursor-pointer hover:scale-105 transition-all"
              >
                Import Your First Playlist
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {spotifyPlaylists.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlaylistId(p.id)}
                  className="bg-[#18181c] hover:bg-[#202028] p-3 rounded-2xl border border-white/5 cursor-pointer space-y-2.5 group transition-all hover:scale-[1.03] shadow-md relative overflow-hidden"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-neutral-900 relative shadow-md">
                    {p.cover_url ? (
                      <img
                        src={p.cover_url}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-[#1DB954] to-emerald-800 flex items-center justify-center text-white text-3xl font-black">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {/* Delete button on card */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaylistToDelete({ id: p.id, name: p.name });
                      }}
                      className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/75 hover:bg-red-600 text-white/80 hover:text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 shadow-md backdrop-blur-md cursor-pointer z-10"
                      title="Delete playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />
                      <span className="text-[10px] font-bold text-white">Spotify</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#1DB954] transition-colors">{p.name}</h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{p.tracks.length} tracks</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeChip === "Your Playlists" ? (
        /* VIEW 7: PLAYLISTS GRID */
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Your Playlists</h3>
            <button
              onClick={handleCreatePlaylist}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-xs font-bold shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Playlist</span>
            </button>
          </div>

          {/* Locked / Empty State */}
          {!isAuthenticated ? (
            <div className="text-center py-16 bg-[#16161a] rounded-3xl border border-white/5 space-y-4 p-8">
              <div className="w-12 h-12 rounded-2xl bg-[#00d2c4]/10 border border-[#00d2c4]/20 flex items-center justify-center mx-auto text-[#00d2c4]">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Sign In to Create Playlists</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Custom playlists are synced to your account database so your music is always backed up. Sign in with your email to create and organize your playlists.
              </p>
              <button
                onClick={() => openAuthModal('login', 'Please sign in with your email to create and organize custom playlists.')}
                className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-bold shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                Sign In With Email
              </button>
            </div>
          ) : userPlaylists.length === 0 ? (
            <div className="text-center py-16 bg-[#16161a] rounded-3xl border border-white/5 space-y-3 p-8">
              <Music className="w-10 h-10 text-neutral-600 mx-auto" />
              <h4 className="text-base font-bold text-white">No playlists yet</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Create custom playlists to organize your favorite tracks. All playlists are saved to your account.
              </p>
              <button
                onClick={handleCreatePlaylist}
                className="px-5 py-2.5 rounded-full bg-white text-black text-xs font-bold shadow-md cursor-pointer hover:scale-105 transition-all"
              >
                Create Your First Playlist
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {userPlaylists.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlaylistId(p.id)}
                  className="bg-[#18181c] hover:bg-[#202028] p-3 rounded-2xl border border-white/5 cursor-pointer space-y-2.5 group transition-all hover:scale-[1.03] shadow-md relative overflow-hidden"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-neutral-900 relative shadow-md">
                    {(() => {
                      const cover = getPlaylistCover(p);
                      return cover ? (
                        <img
                          src={cover}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-3xl font-black bg-gradient-to-tr from-[#00d2c4] to-blue-600">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      );
                    })()}
                    {/* Delete button on card */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaylistToDelete({ id: p.id, name: p.name });
                      }}
                      className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/75 hover:bg-red-600 text-white/80 hover:text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 shadow-md backdrop-blur-md cursor-pointer z-10"
                      title="Delete playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:underline">{p.name}</h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{p.tracks.length} tracks</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* DEFAULT VIEW: 2X2 CATEGORY BANNERS + REAL RECENTLY PLAYED */
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* 2x2 Quick Category Action Banners */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Top-Left: Favorite (Pink) */}
            <div
              onClick={() => setActiveChip("Favorites")}
              className="flex items-center justify-between px-5 py-4 rounded-2xl bg-[#fb7185] hover:brightness-105 transition-all cursor-pointer shadow-md"
            >
              <div className="flex items-center gap-3.5">
                <div className="text-red-950">
                  <Heart className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <span className="text-base font-extrabold text-black tracking-tight block">
                    Favorite
                  </span>
                  <span className="text-xs font-semibold text-black/70">
                    {isAuthenticated ? `${favorites.length} saved songs` : 'Sign in to save'}
                  </span>
                </div>
              </div>
              <Play className="w-4 h-4 fill-black text-black opacity-80" />
            </div>

            {/* Top-Right: Followed (Yellow) */}
            <div
              onClick={() => setActiveChip("Followed Artists")}
              className="flex items-center justify-between px-5 py-4 rounded-2xl bg-[#facc15] hover:brightness-105 transition-all cursor-pointer shadow-md"
            >
              <div className="flex items-center gap-3.5">
                <div className="text-black">
                  <Sparkles className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <span className="text-base font-extrabold text-black tracking-tight block">
                    Followed
                  </span>
                  <span className="text-xs font-semibold text-black/70">
                    {isAuthenticated ? `${followedArtists.length} artists` : 'Sign in to follow'}
                  </span>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-black opacity-80" />
            </div>

            {/* Bottom-Left: Most Played (Cyan) */}
            <div
              onClick={() => setActiveChip("Most Played")}
              className="flex items-center justify-between px-5 py-4 rounded-2xl bg-[#06b6d4] hover:brightness-105 transition-all cursor-pointer shadow-md"
            >
              <div className="flex items-center gap-3.5">
                <div className="text-black">
                  <TrendingUp className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <span className="text-base font-extrabold text-black tracking-tight block">
                    Most Played
                  </span>
                  <span className="text-xs font-semibold text-black/70">
                    Your top tracks
                  </span>
                </div>
              </div>
              <Play className="w-4 h-4 fill-black text-black opacity-80" />
            </div>

            {/* Bottom-Right: Downloaded (Green) */}
            <div
              onClick={() => setActiveChip("Downloaded")}
              className="flex items-center justify-between px-5 py-4 rounded-2xl bg-[#4ade80] hover:brightness-105 transition-all cursor-pointer shadow-md"
            >
              <div className="flex items-center gap-3.5">
                <div className="text-black">
                  <ArrowDownCircle className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-base font-extrabold text-black tracking-tight block">
                    Downloaded
                  </span>
                  <span className="text-xs font-semibold text-black/70">
                    {downloadedTracks.length} tracks offline
                  </span>
                </div>
              </div>
              <Check className="w-4 h-4 stroke-[3] text-black opacity-80" />
            </div>
          </div>


          {/* Recently Played / Added Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {playHistory.length > 0 ? "Recently Played" : "Trending In Library"}
              </h2>
              {recentTracks.length > 0 && (
                <button
                  onClick={() => handlePlaySong(recentTracks[0], recentTracks)}
                  className="text-xs font-bold text-[#00d2c4] hover:underline"
                >
                  Play All
                </button>
              )}
            </div>

            <div className="space-y-1">
              {recentTracks.slice(0, 15).map((track, idx) => {
                const isPlayingThis = currentTrack?.videoId === track.videoId && isPlaying;
                const isLiked = isFavorite(track.videoId);
                const isMenuOpen = activeMenuTrackId === track.videoId;
                const historyMeta = playHistory.find(h => h.track.videoId === track.videoId);
                const timeAgo = historyMeta ? formatTimeAgo(historyMeta.lastPlayed) : null;

                return (
                  <div
                    key={`${track.videoId}-${idx}`}
                    onClick={() => handlePlaySong(track, recentTracks)}
                    className="group relative flex items-center justify-between p-2.5 rounded-xl hover:bg-[#18181c] transition-colors cursor-pointer border border-transparent hover:border-white/5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
                        <MusicPoster
                          src={track.poster || track.thumbnails?.[0]?.url}
                          fallbackSrc={track.fallbackPoster}
                          videoId={track.videoId}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />

                        {isPlayingThis && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-0.5">
                            <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-1" />
                            <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-2" />
                            <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-3" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-3">
                        <h4 className={`text-sm font-semibold truncate ${isPlayingThis ? 'text-[#00d2c4]' : 'text-white group-hover:text-neutral-100'}`}>
                          {track.title}
                        </h4>
                        <p
                          onClick={(e) => {
                            e.stopPropagation();
                            const primaryA = track.artists?.[0];
                            const aName = (typeof primaryA === 'string' ? primaryA : primaryA?.name) || 'Artist';
                            const aId = typeof primaryA === 'object' ? primaryA?.id : undefined;
                            openArtistModal({ name: aName, id: aId, avatar: track.poster || track.thumbnails?.[0]?.url });
                          }}
                          className="text-xs text-[#8e8e93] hover:text-white truncate mt-0.5 cursor-pointer"
                        >
                          {track.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ') || 'Unknown Artist'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {timeAgo && (
                        <span className="text-[11px] font-mono text-neutral-500 hidden sm:inline mr-2">
                          {timeAgo}
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(track);
                        }}
                        className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                        title={isLiked ? "Remove Favorite" : "Favorite"}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'text-red-500 fill-red-500' : ''}`} />
                      </button>

                      <SongActionMenu
                        track={track}
                        buttonClassName="p-2 text-neutral-400 hover:text-white rounded-full transition-colors cursor-pointer"
                        iconClassName="w-4 h-4"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Footer */}
          <div className="pt-12 pb-6 text-center space-y-1">
            <p className="text-xs font-mono text-neutral-400">
              @2026 VibeMusic v1.0.0
            </p>
            <p className="text-xs font-mono text-neutral-500">
              <a
                href="https://github.com/bhavish45"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors cursor-pointer underline underline-offset-2"
              >
                bhavish45
              </a>
              {" "}&bull; VibeMusic
            </p>
          </div>
        </div>
      )}

      {/* Spotify Playlist URL Import Modal */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsImportModalOpen(false)}
        >
          <div
            className="relative w-full max-w-lg bg-[#141419] border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Ambient Top Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-[#1DB954]/15 blur-3xl pointer-events-none rounded-full" />

            {/* Modal Header */}
            <div className="flex items-center justify-between relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex-shrink-0">
                  <img 
                    src="/spotify-app-logo.png" 
                    alt="Spotify" 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Import Spotify Playlist
                  </h3>
                  <p className="text-[11px] text-neutral-400">Paste any public Spotify playlist link to import</p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step-by-Step Instructions Banner with Device Switcher */}
            <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[#1DB954]" />
                  <span>Where &amp; how to get the link:</span>
                </span>

                <div className="flex items-center p-0.5 bg-neutral-900 border border-white/10 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setGuidePlatform('mobile')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${guidePlatform === 'mobile'
                        ? 'bg-[#1DB954] text-black shadow'
                        : 'text-neutral-400 hover:text-white'
                      }`}
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>Mobile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuidePlatform('desktop')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${guidePlatform === 'desktop'
                        ? 'bg-[#1DB954] text-black shadow'
                        : 'text-neutral-400 hover:text-white'
                      }`}
                  >
                    <Monitor className="w-3 h-3" />
                    <span>Desktop</span>
                  </button>
                </div>
              </div>

              {/* Instructions Steps */}
              {guidePlatform === 'mobile' ? (
                <div className="space-y-1.5 text-xs text-neutral-300">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#1DB954]/20 text-[#1DB954] font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                    <span>Open the <strong>Spotify mobile app</strong> and go to the playlist.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#1DB954]/20 text-[#1DB954] font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    <span>Tap the <span className="bg-white/10 px-1 py-0.2 rounded font-mono font-bold text-white">•••</span> menu below the cover image.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#1DB954]/20 text-[#1DB954] font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                    <span>Tap <strong className="text-[#1DB954]">Share</strong> &rarr; tap <strong className="text-white">Copy link</strong>.</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs text-neutral-300">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#1DB954]/20 text-[#1DB954] font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                    <span>Open Spotify or visit <strong>open.spotify.com</strong> and open any playlist.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#1DB954]/20 text-[#1DB954] font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    <span>Click the <span className="bg-white/10 px-1 py-0.2 rounded font-mono font-bold text-white">•••</span> icon next to the green Play button.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#1DB954]/20 text-[#1DB954] font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                    <span>Hover over <strong className="text-[#1DB954]">Share</strong> &rarr; click <strong className="text-white">Copy link to playlist</strong>.</span>
                  </div>
                </div>
              )}
            </div>

            {importError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {importError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleImportSpotifyUrl} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-neutral-300">
                  Paste Playlist Link
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={spotifyUrlInput}
                    onChange={e => setSpotifyUrlInput(e.target.value)}
                    placeholder="https://open.spotify.com/playlist/..."
                    className="w-full bg-black/60 border border-white/15 focus:border-[#1DB954] rounded-2xl pl-10 pr-24 py-3 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                    title="Paste from clipboard"
                  >
                    {copiedLink ? <CheckCheck className="w-3.5 h-3.5 text-[#1DB954]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Paste</span>
                  </button>
                </div>
              </div>

              {/* Preset Sample Pills */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-neutral-400 block">Try with sample playlists:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSpotifyUrlInput("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#1DB954]/20 hover:text-[#1DB954] border border-white/5 text-neutral-300 text-[11px] font-medium transition-all cursor-pointer"
                  >
                    🔥 Today&apos;s Top Hits
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpotifyUrlInput("https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd")}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#1DB954]/20 hover:text-[#1DB954] border border-white/5 text-neutral-300 text-[11px] font-medium transition-all cursor-pointer"
                  >
                    ⚡ RapCaviar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpotifyUrlInput("https://open.spotify.com/playlist/37i9dQZF1DXdLEN7aqioXM")}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#1DB954]/20 hover:text-[#1DB954] border border-white/5 text-neutral-300 text-[11px] font-medium transition-all cursor-pointer"
                  >
                    🎧 Chill Lofi Beats
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !spotifyUrlInput.trim()}
                  className="px-5 py-2.5 rounded-2xl bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(29,185,84,0.3)] active:scale-95"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing Tracks...</span>
                    </>
                  ) : (
                    <>
                      <Music2 className="w-4 h-4 stroke-[2.5]" />
                      <span>Import Playlist</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Playlist Confirmation Modal */}
      {playlistToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#18181c] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Delete Playlist?</h3>
              <p className="text-xs text-neutral-400">
                Are you sure you want to delete <span className="font-semibold text-white">"{playlistToDelete.name}"</span>? This will remove the entire playlist from your library.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPlaylistToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePlaylist}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition-all cursor-pointer"
              >
                Delete Playlist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Downloaded Song Confirmation Modal */}
      {songToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#18181c] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Delete Downloaded Song?</h3>
              <p className="text-xs text-neutral-400">
                Are you sure you want to remove <span className="font-semibold text-white">"{songToDelete.title}"</span> from your downloaded songs?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSongToDelete(null)}
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
        </div>
      )}
    </div>
  );
}
