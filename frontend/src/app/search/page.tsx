"use client";

import { useState, useEffect, Suspense } from 'react';
import { 
  ArrowUpRight, 
  MoreVertical, 
  Check, 
  Plus, 
  ListPlus, 
  Loader2,
  Heart,
  ArrowDownCircle,
  ExternalLink,
  Play,
  User as UserIcon,
  ArrowLeft,
  Shuffle,
  Disc,
  Music2
} from 'lucide-react';
import { usePlayerStore, Track } from '@/store/playerStore';
import { useAuthStore, getBackendUrl } from '@/store/authStore';
import { useSearchStore } from '@/store/searchStore';
import MusicPoster from '@/components/ui/MusicPoster';
import SongActionMenu from '@/components/ui/SongActionMenu';
import { getClientCache, setClientCache } from '@/lib/clientCache';
import { cleanString } from '@/lib/searchUtils';

// Moods & Moments (SimpMusic UI)
const MOODS_AND_MOMENTS = [
  { name: "Chill", color: "#10b981" },
  { name: "Feel good", color: "#b45309" },
  { name: "Party", color: "#f43f5e" },
  { name: "Sleep", color: "#06b6d4" },
  { name: "Commute", color: "#ec4899" },
  { name: "Focus", color: "#eab308" },
  { name: "Romance", color: "#d946ef" },
  { name: "Workout", color: "#22c55e" },
  { name: "Energize", color: "#991b1b" },
  { name: "Gaming", color: "#10b981" },
  { name: "Sad", color: "#8b5cf6" },
];

// Genres (SimpMusic UI)
const GENRES = [
  { name: "African", color: "#3b82f6" },
  { name: "Bhojpuri", color: "#06b6d4" },
  { name: "Country & Americana", color: "#14b8a6" },
  { name: "Desi hip-hop", color: "#db2777" },
  { name: "Folk & acoustic", color: "#2dd4bf" },
  { name: "Haryanvi", color: "#2563eb" },
  { name: "Hip-hop", color: "#059669" },
  { name: "Indie & alternative", color: "#9333ea" },
  { name: "K-Pop", color: "#f43f5e" },
  { name: "Arabic", color: "#06b6d4" },
  { name: "Carnatic classical", color: "#4338ca" },
  { name: "Dance & electronic", color: "#2dd4bf" },
  { name: "Devotional", color: "#0d9488" },
  { name: "Ghazal/sufi", color: "#0e7490" },
  { name: "Hindi", color: "#0284c7" },
  { name: "Indian indie", color: "#65a30d" },
  { name: "J-Pop", color: "#2563eb" },
  { name: "Kannada", color: "#16a34a" },
  { name: "Bengali", color: "#10b981" },
  { name: "Classical", color: "#ca8a04" },
  { name: "Decades", color: "#a855f7" },
  { name: "Family", color: "#64748b" },
  { name: "Gujarati", color: "#38bdf8" },
  { name: "Hindustani classical", color: "#84cc16" },
  { name: "Indian pop", color: "#ec4899" },
  { name: "Jazz", color: "#14b8a6" },
  { name: "Latin", color: "#a3e635" },
];

// Result Filter Chips
const RESULT_FILTER_CHIPS = [
  "All",
  "Songs",
  "Videos",
  "Albums",
  "Artists",
  "Playlists"
];

function SearchContent() {
  const { submittedQuery, activeChip, setActiveChip, triggerSearch } = useSearchStore();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [collectionLoadingId, setCollectionLoadingId] = useState<string | null>(null);

  interface SelectedCollection {
    type: 'playlist' | 'album';
    id: string;
    title: string;
    poster: string;
    authorOrArtist?: string;
    year?: string;
    itemCount?: string;
    tracks: Track[];
    loading: boolean;
  }

  const [selectedCollection, setSelectedCollection] = useState<SelectedCollection | null>(null);

  const { 
    playTrack, 
    addToQueue, 
    playlists, 
    addTrackToPlaylist, 
    createPlaylist, 
    currentTrack, 
    isPlaying,
    openArtistModal,
    isFavorite,
    toggleFavorite,
    isDownloaded,
    toggleDownload
  } = usePlayerStore();

  const { user, isAuthenticated, openAuthModal } = useAuthStore();
  const backendUrl = getBackendUrl();

  // Execute full search when submittedQuery or activeChip changes
  useEffect(() => {
    setSelectedCollection(null);
    const clean = submittedQuery.trim();
    if (!clean) {
      setResults([]);
      setLoading(false);
      return;
    }

    let filterParam = "songs";
    if (activeChip === "Videos") filterParam = "videos";
    else if (activeChip === "Albums") filterParam = "albums";
    else if (activeChip === "Artists") filterParam = "artists";
    else if (activeChip === "Playlists") filterParam = "playlists";

    const cacheKey = `search_${clean.toLowerCase()}_${filterParam}`;
    const cachedResults = getClientCache<any[]>(cacheKey);
    if (cachedResults) {
      setResults(cachedResults);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`${backendUrl}/api/search?q=${encodeURIComponent(clean)}&filter=${filterParam}`)
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setResults(list);
        if (list.length > 0) {
          setClientCache(cacheKey, list, 3600);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Search error:", err);
        setLoading(false);
      });
  }, [submittedQuery, activeChip, backendUrl]);

  const handleOpenCollection = async (item: any, type: 'album' | 'playlist') => {
    const id = cleanString(item.browseId || item.playlistId || item.id);
    if (!id) return;

    const title = cleanString(item.title, type === 'playlist' ? 'Playlist' : 'Album');
    const poster = cleanString(item.poster || item.thumbnails?.[0]?.url, '/placeholder.png');
    const authorOrArtist = type === 'playlist' 
      ? cleanString(item.author, 'Community') 
      : cleanString(item.artist || item.artists, 'Artist');
    const year = cleanString(item.year, '');
    const itemCount = cleanString(item.itemCount, '');

    setSelectedCollection({
      type,
      id,
      title,
      poster,
      authorOrArtist,
      year,
      itemCount,
      tracks: [],
      loading: true
    });

    try {
      const res = await fetch(`${backendUrl}/api/${type}/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data && Array.isArray(data.tracks)) {
        const resolvedAuthor = cleanString(
          data.author || data.artist || data.artists || authorOrArtist,
          authorOrArtist
        );
        setSelectedCollection({
          type,
          id,
          title: cleanString(data.title, title),
          poster: cleanString(data.poster, poster),
          authorOrArtist: resolvedAuthor,
          year: cleanString(data.year, year),
          itemCount: data.tracks.length ? `${data.tracks.length} tracks` : itemCount,
          tracks: data.tracks,
          loading: false
        });
      } else {
        setSelectedCollection(prev => prev ? { ...prev, loading: false } : null);
      }
    } catch (err) {
      console.error(`Error loading ${type}:`, err);
      setSelectedCollection(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const handlePlayCollection = async (browseId: string, type: 'album' | 'playlist') => {
    if (!browseId || collectionLoadingId) return;
    setCollectionLoadingId(browseId);
    try {
      const res = await fetch(`${backendUrl}/api/${type}/${encodeURIComponent(browseId)}`);
      const data = await res.json();
      if (data && Array.isArray(data.tracks) && data.tracks.length > 0) {
        playTrack(data.tracks[0], data.tracks);
      } else {
        useAuthStore.getState().setToast(`No playable tracks found in this ${type}.`, 'info');
      }
    } catch (err) {
      console.error(`Error loading ${type}:`, err);
    } finally {
      setCollectionLoadingId(null);
    }
  };

  const handlePlaySong = (track: Track, trackList: Track[]) => {
    playTrack(track, trackList);
  };

  const handleAddToPlaylistPrompt = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    const { isAuthenticated, openAuthModal } = useAuthStore.getState();
    if (!isAuthenticated) {
      openAuthModal('login', 'Please sign in with your email to add tracks to playlists.');
      return;
    }
    const userPlaylists = playlists.filter(p => p.source !== 'spotify' && !p.name.includes('(Spotify)'));
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
  };

  // Top artist preview from results
  const primaryArtistName = results[0]?.artists?.[0]
    ? (typeof results[0].artists[0] === 'string' ? results[0].artists[0] : results[0].artists[0].name)
    : submittedQuery;

  return (
    <div className="space-y-6 pb-20 select-none w-full">


      {/* STATE 1: SEARCH RESULTS WITH FILTER CHIPS OR SELECTED PLAYLIST/ALBUM DETAIL */}
      {submittedQuery ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          {selectedCollection ? (
            /* ================= VIEW: SELECTED PLAYLIST OR ALBUM DETAIL ================= */
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Back Button */}
              <button
                type="button"
                onClick={() => setSelectedCollection(null)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>Back to {activeChip === "Albums" ? "Albums" : activeChip === "Playlists" ? "Playlists" : "Search Results"}</span>
              </button>

              {/* Collection Header Banner */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 p-5 sm:p-7 rounded-3xl bg-[#16161a] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 bg-neutral-900 border border-white/10 relative">
                  <img
                    src={selectedCollection.poster}
                    alt={selectedCollection.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.endsWith('/placeholder.png')) {
                        target.src = '/placeholder.png';
                      }
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between py-1 text-center sm:text-left space-y-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-[11px] font-bold uppercase tracking-wider text-[#00d2c4]">
                      {selectedCollection.type === 'album' ? <Disc className="w-3.5 h-3.5" /> : <Music2 className="w-3.5 h-3.5" />}
                      <span>{selectedCollection.type}</span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black text-white mt-2 leading-tight line-clamp-2">
                      {selectedCollection.title}
                    </h2>

                    <p className="text-xs sm:text-sm text-neutral-300 font-medium mt-1">
                      {cleanString(selectedCollection.authorOrArtist, 'Artist')} {selectedCollection.year ? `• ${cleanString(selectedCollection.year)}` : ''} • {selectedCollection.tracks.length ? `${selectedCollection.tracks.length} tracks` : (cleanString(selectedCollection.itemCount) || '')}
                    </p>
                  </div>

                  {/* Play All & Shuffle Buttons */}
                  {selectedCollection.tracks.length > 0 && (
                    <div className="flex items-center justify-center sm:justify-start gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handlePlaySong(selectedCollection.tracks[0], selectedCollection.tracks)}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-bold text-xs shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                        <span>Play All</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const shuffled = [...selectedCollection.tracks].sort(() => Math.random() - 0.5);
                          handlePlaySong(shuffled[0], shuffled);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="Shuffle Play"
                      >
                        <Shuffle className="w-4 h-4" />
                        <span>Shuffle</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tracks Inside the Playlist / Album */}
              {selectedCollection.loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-400">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00d2c4]" />
                  <span className="text-xs">Loading {selectedCollection.type} songs...</span>
                </div>
              ) : selectedCollection.tracks.length === 0 ? (
                <div className="text-center py-16 bg-[#16161a] rounded-3xl border border-white/5 space-y-2 p-8">
                  <Music2 className="w-10 h-10 text-neutral-600 mx-auto" />
                  <p className="text-sm font-bold text-white">No tracks available in this {selectedCollection.type}</p>
                  <p className="text-xs text-neutral-400">Try playing directly or exploring other {selectedCollection.type}s.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="px-3 pb-2 text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between border-b border-white/5">
                    <span># &nbsp; Title</span>
                    <span className="mr-8">Duration</span>
                  </div>

                  {selectedCollection.tracks.map((track, idx) => {
                    const isPlayingThis = currentTrack?.videoId === track.videoId && isPlaying;
                    const isLiked = isFavorite(track.videoId);
                    const trackArtist = cleanString(track.artists) || cleanString(selectedCollection.authorOrArtist) || 'Unknown Artist';

                    return (
                      <div
                        key={`${track.videoId}-${idx}`}
                        onClick={() => handlePlaySong(track, selectedCollection.tracks)}
                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-[#18181c] transition-colors cursor-pointer border border-transparent hover:border-white/5"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          {/* Index / Playing Wave */}
                          <div className="w-6 text-center text-xs font-mono text-neutral-400 flex items-center justify-center flex-shrink-0">
                            {isPlayingThis ? (
                              <div className="flex items-center gap-0.5">
                                <span className="w-0.5 h-3 bg-[#00d2c4] animate-wave-1 rounded-full" />
                                <span className="w-0.5 h-3 bg-[#00d2c4] animate-wave-2 rounded-full" />
                                <span className="w-0.5 h-3 bg-[#00d2c4] animate-wave-3 rounded-full" />
                              </div>
                            ) : (
                              <span className="group-hover:hidden">{idx + 1}</span>
                            )}
                            {!isPlayingThis && (
                              <Play className="w-3.5 h-3.5 fill-current text-white hidden group-hover:block" />
                            )}
                          </div>

                          {/* Artwork thumbnail */}
                          <div className="w-11 h-11 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
                            <MusicPoster
                              src={track.poster || track.thumbnails?.[0]?.url || selectedCollection.poster}
                              fallbackSrc={track.fallbackPoster || selectedCollection.poster}
                              videoId={track.videoId}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* Title & Artist */}
                          <div className="flex-1 min-w-0 pr-3">
                            <h4 className={`text-sm font-semibold truncate ${isPlayingThis ? 'text-[#00d2c4]' : 'text-white group-hover:text-neutral-100'}`}>
                              {track.title}
                            </h4>
                            <p
                              onClick={(e) => {
                                e.stopPropagation();
                                const primaryA = track.artists?.[0];
                                const aName = (typeof primaryA === 'string' ? primaryA : primaryA?.name) || trackArtist;
                                const aId = typeof primaryA === 'object' ? primaryA?.id : undefined;
                                openArtistModal({
                                  name: aName,
                                  id: aId,
                                  avatar: track.poster || track.thumbnails?.[0]?.url || selectedCollection.poster
                                });
                              }}
                              className="text-xs text-[#8e8e93] hover:text-white truncate mt-0.5 cursor-pointer inline-block"
                            >
                              {trackArtist}
                            </p>
                          </div>
                        </div>

                        {/* Duration, Favorite & Three-Dots Menu */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-mono text-neutral-400 hidden sm:inline mr-2">
                            {track.durationFormatted || '3:30'}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(track);
                            }}
                            className="p-2 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
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
              )}
            </div>
          ) : (
            <>
              {/* Filter Chips Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
                {RESULT_FILTER_CHIPS.map((chip) => {
                  const isSelected = activeChip === chip;
                  return (
                    <button
                      key={chip}
                      onClick={() => {
                        setSelectedCollection(null);
                        setActiveChip(chip);
                      }}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
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

              {/* Content depending on activeChip and state */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-400">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00d2c4]" />
                  <span className="text-xs">Searching songs, albums, and playlists...</span>
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-16 bg-[#16161a] rounded-3xl border border-white/5 space-y-2 p-8">
                  <Music2 className="w-10 h-10 text-neutral-600 mx-auto" />
                  <p className="text-sm font-bold text-white">No results found for "{submittedQuery}"</p>
                  <p className="text-xs text-neutral-400">Check spelling or search for popular songs, artists, or genres.</p>
                </div>
              ) : activeChip === "Artists" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 pt-2">
                  {results.map((artistItem: any, index: number) => {
                    const aName = artistItem.name || artistItem.title;
                    const aAvatar = artistItem.avatar || artistItem.originalAvatar || artistItem.thumbnails?.[0]?.url;
                    const aSubs = artistItem.subscribers;
                    return (
                      <div 
                        key={`artist-res-${index}`}
                        onClick={() => openArtistModal({ 
                          name: aName, 
                          id: artistItem.browseId || artistItem.id,
                          avatar: aAvatar, 
                          subscribers: aSubs 
                        })}
                        className="bg-[#18181c] hover:bg-[#202028] p-3 rounded-2xl border border-white/5 cursor-pointer space-y-2.5 group transition-all hover:scale-[1.03] shadow-md flex flex-col items-center text-center"
                      >
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-lg border-2 border-white/10 group-hover:border-[#00d2c4] transition-colors bg-neutral-900 flex-shrink-0">
                          <img 
                            src={aAvatar || '/default_artist.png'} 
                            alt={aName} 
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              const target = e.currentTarget;
                              const fallback = artistItem.originalAvatar || artistItem.thumbnails?.[0]?.url;
                              if (fallback && target.src !== fallback) {
                                target.src = fallback;
                              } else if (!target.src.endsWith('/default_artist.png')) {
                                target.src = '/default_artist.png';
                              }
                            }}
                          />
                        </div>
                        <div className="w-full">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-full group-hover:text-[#00d2c4] transition-colors">
                            {aName}
                          </h4>
                          <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                            {aSubs || "Artist"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : activeChip === "Albums" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 pt-2">
                  {results.map((albumItem: any, index: number) => {
                    const albTitle = cleanString(albumItem.title, "Album");
                    const albPoster = albumItem.poster || albumItem.thumbnails?.[0]?.url || '/placeholder.png';
                    const albArtist = cleanString(albumItem.artist || albumItem.artists, "Artist");
                    const albYear = cleanString(albumItem.year, "");
                    const albId = cleanString(albumItem.browseId || albumItem.playlistId);
                    const isLoadingThis = collectionLoadingId === albId;

                    return (
                      <div
                        key={`album-res-${index}`}
                        onClick={() => handleOpenCollection(albumItem, 'album')}
                        className="bg-[#18181c] hover:bg-[#202028] p-3 rounded-2xl border border-white/5 cursor-pointer space-y-2.5 group transition-all hover:scale-[1.03] shadow-md relative overflow-hidden"
                      >
                        <div className="aspect-square rounded-xl overflow-hidden bg-neutral-900 relative shadow-md">
                          <img
                            src={albPoster}
                            alt={albTitle}
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              const target = e.currentTarget;
                              const fallback = albumItem.thumbnails?.[0]?.url;
                              if (fallback && target.src !== fallback) {
                                target.src = fallback;
                              } else if (!target.src.endsWith('/placeholder.png')) {
                                target.src = '/placeholder.png';
                              }
                            }}
                          />
                          {/* Quick Play Hover Button */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlayCollection(albId, 'album');
                              }}
                              className="w-10 h-10 rounded-full bg-[#00d2c4] text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 hover:scale-110 active:scale-95 transition-all pointer-events-auto cursor-pointer"
                              title="Play Album"
                            >
                              {isLoadingThis ? (
                                <Loader2 className="w-5 h-5 text-black animate-spin" />
                              ) : (
                                <Play className="w-5 h-5 fill-current ml-0.5" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#00d2c4] transition-colors">
                            {albTitle}
                          </h4>
                          <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                            {albArtist} {albYear ? `• ${albYear}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : activeChip === "Playlists" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 pt-2">
                  {results.map((plItem: any, index: number) => {
                    const plTitle = cleanString(plItem.title, "Playlist");
                    const plPoster = plItem.poster || plItem.thumbnails?.[0]?.url || '/placeholder.png';
                    const plAuthor = cleanString(plItem.author, "Community");
                    const plCount = cleanString(plItem.itemCount, "");
                    const plId = cleanString(plItem.browseId);
                    const isLoadingThis = collectionLoadingId === plId;

                    return (
                      <div
                        key={`pl-res-${index}`}
                        onClick={() => handleOpenCollection(plItem, 'playlist')}
                        className="bg-[#18181c] hover:bg-[#202028] p-3 rounded-2xl border border-white/5 cursor-pointer space-y-2.5 group transition-all hover:scale-[1.03] shadow-md relative overflow-hidden"
                      >
                        <div className="aspect-square rounded-xl overflow-hidden bg-neutral-900 relative shadow-md">
                          <img
                            src={plPoster}
                            alt={plTitle}
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              const target = e.currentTarget;
                              const fallback = plItem.thumbnails?.[0]?.url;
                              if (fallback && target.src !== fallback) {
                                target.src = fallback;
                              } else if (!target.src.endsWith('/placeholder.png')) {
                                target.src = '/placeholder.png';
                              }
                            }}
                          />
                          {/* Quick Play Hover Button */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlayCollection(plId, 'playlist');
                              }}
                              className="w-10 h-10 rounded-full bg-[#00d2c4] text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 hover:scale-110 active:scale-95 transition-all pointer-events-auto cursor-pointer"
                              title="Play Playlist"
                            >
                              {isLoadingThis ? (
                                <Loader2 className="w-5 h-5 text-black animate-spin" />
                              ) : (
                                <Play className="w-5 h-5 fill-current ml-0.5" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#00d2c4] transition-colors">
                            {plTitle}
                          </h4>
                          <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                            {plAuthor} {plCount ? `• ${plCount}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Songs / Videos Results List */
                <div className="space-y-2">
                  {results.map((track, index) => {
                    const isPlayingThis = currentTrack?.videoId === track.videoId && isPlaying;
                    const isLiked = isFavorite(track.videoId);
                    const trackArtist = track.artists?.map((a: any) => typeof a === 'string' ? a : a.name).join(', ') || 'Unknown Artist';

                    return (
                      <div
                        key={`${track.videoId}-${index}`}
                        onClick={() => handlePlaySong(track, results)}
                        className="group relative flex items-center justify-between p-2 rounded-xl hover:bg-[#18181c] transition-colors cursor-pointer border border-transparent hover:border-white/5"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          {/* Thumbnail or Equalizer Wave if playing */}
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
                            <MusicPoster
                              src={track.poster || track.thumbnails?.[0]?.url}
                              fallbackSrc={track.fallbackPoster}
                              videoId={track.videoId}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />

                            {isPlayingThis && (
                              <div className="absolute inset-0 bg-black/70 flex items-center justify-center gap-0.5">
                                <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-1" />
                                <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-2" />
                                <span className="w-1 bg-[#00d2c4] rounded-full animate-wave-3" />
                              </div>
                            )}
                          </div>

                          {/* Title & Clickable Artist Name */}
                          <div className="flex-1 min-w-0 pr-3">
                            <h4 className={`text-sm font-semibold truncate ${isPlayingThis ? 'text-[#00d2c4]' : 'text-white group-hover:text-neutral-100'}`}>
                              {track.title}
                            </h4>
                            
                            <p 
                              onClick={(e) => {
                                e.stopPropagation();
                                const primaryA = track.artists?.[0];
                                const aName = (typeof primaryA === 'string' ? primaryA : primaryA?.name) || track.channel || 'Artist';
                                const aId = typeof primaryA === 'object' ? primaryA?.id : undefined;
                                openArtistModal({
                                  name: aName,
                                  id: aId,
                                  avatar: track.poster || track.thumbnails?.[0]?.url
                                });
                              }}
                              className="text-xs text-[#8e8e93] hover:text-white truncate mt-0.5 cursor-pointer inline-block"
                              title={`View ${trackArtist}`}
                            >
                              {trackArtist}
                            </p>
                          </div>
                        </div>

                        {/* Right Action Icons: Favorite Heart, Duration, 3-Dots Menu */}
                        <div className="relative flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs font-mono text-neutral-400 hidden sm:inline mr-2">
                            {track.durationFormatted || '3:30'}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(track);
                            }}
                            className="p-2 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                            title={isLiked ? "Remove Favorite" : "Add to Favorites"}
                          >
                            <Heart className={`w-4 h-4 ${isLiked ? 'text-red-500 fill-red-500' : ''}`} />
                          </button>

                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <SongActionMenu 
                              track={track} 
                              buttonClassName="p-2 text-neutral-400 hover:text-white transition-colors cursor-pointer" 
                              iconClassName="w-4 h-4" 
                              title="Song Options"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* STATE 2: EXPLORE MOODS & GENRES */
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Moods & Moment */}
          <section className="space-y-3">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9e9ea7]">
                LET'S PICK A PLAYLIST FOR YOU
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Moods & Moment
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {MOODS_AND_MOMENTS.map((item) => (
                <div
                  key={item.name}
                  onClick={() => triggerSearch(item.name)}
                  className="group relative flex items-center justify-center h-14 bg-[#18181c] hover:bg-[#222228] rounded-xl overflow-hidden cursor-pointer transition-all border border-white/5 shadow-sm"
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2.5 rounded-l-xl"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs sm:text-sm font-semibold text-white pl-2">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Genre Section */}
          <section className="space-y-3 pt-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Genre
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {GENRES.map((item) => (
                <div
                  key={item.name}
                  onClick={() => triggerSearch(item.name)}
                  className="group relative flex items-center justify-center h-14 bg-[#18181c] hover:bg-[#222228] rounded-xl overflow-hidden cursor-pointer transition-all border border-white/5 shadow-sm"
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2.5 rounded-l-xl"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs sm:text-sm font-semibold text-white text-center px-2 pl-3 line-clamp-2">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="space-y-6 pb-20 select-none w-full min-h-[50vh]" />}>
      <SearchContent />
    </Suspense>
  );
}

