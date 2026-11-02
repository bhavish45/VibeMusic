"use client";

import { useState, useEffect } from 'react';
import { usePlayerStore, Track } from '@/store/playerStore';
import { useAuthStore, getBackendUrl } from '@/store/authStore';
import { 
  X, 
  Play, 
  Shuffle, 
  Check, 
  Plus, 
  Heart, 
  MoreVertical, 
  Loader2, 
  Music2, 
  UserCheck, 
  UserPlus,
  ListPlus,
  ChevronDown,
  Disc,
  Sparkles
} from 'lucide-react';
import MusicPoster from '@/components/ui/MusicPoster';
import { extractDominantColor, DominantColor } from '@/lib/colorExtractor';
import SmoothBackground from '@/components/ui/SmoothBackground';
import SongActionMenu from '@/components/ui/SongActionMenu';

export default function ArtistModal() {
  const { 
    activeArtistModal, 
    closeArtistModal, 
    playTrack, 
    addToQueue, 
    currentTrack, 
    isPlaying,
    isFollowingArtist,
    toggleFollowArtist,
    isFavorite,
    toggleFavorite,
    playlists,
    addTrackToPlaylist
  } = usePlayerStore();

  const [artistTracks, setArtistTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dominantTheme, setDominantTheme] = useState<DominantColor | null>(null);
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);
  const [subscriberCount, setSubscriberCount] = useState<string>("");
  const [monthlyListeners, setMonthlyListeners] = useState<string>("");
  const [artistBio, setArtistBio] = useState<string>("");
  const [showFullBio, setShowFullBio] = useState<boolean>(false);
  const [artistAvatar, setArtistAvatar] = useState<string>('');
  const [songsBrowseId, setSongsBrowseId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalSongs, setTotalSongs] = useState<number | null>(null);
  const [artistAlbums, setArtistAlbums] = useState<any[]>([]);
  const [playingAlbumId, setPlayingAlbumId] = useState<string | null>(null);

  const backendUrl = getBackendUrl();

  const handlePlayArtistAlbum = async (browseId: string) => {
    if (!browseId || playingAlbumId) return;
    setPlayingAlbumId(browseId);
    try {
      const res = await fetch(`${backendUrl}/api/album/${encodeURIComponent(browseId)}`);
      const data = await res.json();
      if (data && Array.isArray(data.tracks) && data.tracks.length > 0) {
        playTrack(data.tracks[0], data.tracks);
        useAuthStore.getState().setToast(`Playing "${data.title || 'Album'}"`);
      } else {
        useAuthStore.getState().setToast("No playable tracks found in this album.", "info");
      }
    } catch (err) {
      console.error("Error playing album:", err);
    } finally {
      setPlayingAlbumId(null);
    }
  };

  useEffect(() => {
    if (!activeArtistModal) {
      setArtistTracks([]);
      setLoading(false);
      setLoadingMore(false);
      setArtistAvatar('');
      setSubscriberCount('');
      setMonthlyListeners('');
      setArtistBio('');
      setShowFullBio(false);
      setSongsBrowseId(null);
      setHasMore(false);
      setTotalSongs(null);
      setArtistAlbums([]);
      return;
    }

    const artistName = activeArtistModal.name;
    const browseId = activeArtistModal.id;

    // Immediately show existing avatar and subscribers for zero-lag feeling
    if (activeArtistModal.avatar) {
      setArtistAvatar(activeArtistModal.avatar);
    }
    if (activeArtistModal.subscribers) {
      setSubscriberCount(activeArtistModal.subscribers);
    }

    setLoading(true);
    setArtistTracks([]);

    // Construct URL with browseId if available for instant direct fetch
    const url = new URL(`${backendUrl}/api/artist/${encodeURIComponent(artistName)}`);
    if (browseId) {
      url.searchParams.set('browseId', browseId);
    }

    fetch(url.toString())
      .then(res => res.json())
      .then(async (data) => {
        if (data && !data.error) {
          if (data.avatar) {
            setArtistAvatar(data.avatar);
          }
          if (data.subscribers) {
            setSubscriberCount(data.subscribers);
          }
          if (data.monthlyListeners) {
            setMonthlyListeners(data.monthlyListeners);
          }
          if (data.description) {
            setArtistBio(data.description);
          }
          if (data.songsBrowseId) {
            setSongsBrowseId(data.songsBrowseId);
          }
          if (typeof data.hasMore === 'boolean') {
            setHasMore(data.hasMore);
          }
          if (typeof data.totalSongs === 'number' && data.totalSongs > 0) {
            setTotalSongs(data.totalSongs);
          } else if (Array.isArray(data.songs)) {
            setTotalSongs(data.songs.length);
          }
          if (Array.isArray(data.albums) && data.albums.length > 0) {
            setArtistAlbums(data.albums);
          }
          if (Array.isArray(data.songs) && data.songs.length > 0) {
            setArtistTracks(data.songs);
          }

          const heroPoster = data.avatar || activeArtistModal.avatar || (data.songs?.[0]?.poster);
          if (heroPoster) {
            const color = await extractDominantColor(heroPoster, artistName);
            setDominantTheme(color);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching artist details:", err);
        setLoading(false);
      });
  }, [activeArtistModal, backendUrl]);

  if (!activeArtistModal) return null;

  const artistName = activeArtistModal.name;
  const isFollowing = isFollowingArtist(artistName);

  const heroImage = artistAvatar || 
    activeArtistModal.avatar || 
    artistTracks[0]?.poster || 
    artistTracks[0]?.thumbnails?.[0]?.url || 
    `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80`;

  const handlePlayAll = async () => {
    if (artistTracks.length === 0) return;
    if (songsBrowseId && totalSongs && totalSongs > artistTracks.length) {
      try {
        const url = new URL(`${backendUrl}/api/artist/${encodeURIComponent(artistName)}/more-songs`);
        url.searchParams.set('browseId', songsBrowseId);
        url.searchParams.set('offset', '0');
        url.searchParams.set('limit', '200');
        const res = await fetch(url.toString());
        const data = await res.json();
        if (data && Array.isArray(data.tracks) && data.tracks.length > 0) {
          playTrack(data.tracks[0], data.tracks);
          setArtistTracks(data.tracks);
          setHasMore(false);
          return;
        }
      } catch (err) {
        console.error("Error playing all tracks:", err);
      }
    }
    playTrack(artistTracks[0], artistTracks);
  };

  const handleShufflePlay = async () => {
    if (artistTracks.length === 0) return;
    let tracksToPlay = artistTracks;
    if (songsBrowseId && totalSongs && totalSongs > artistTracks.length) {
      try {
        const url = new URL(`${backendUrl}/api/artist/${encodeURIComponent(artistName)}/more-songs`);
        url.searchParams.set('browseId', songsBrowseId);
        url.searchParams.set('offset', '0');
        url.searchParams.set('limit', '200');
        const res = await fetch(url.toString());
        const data = await res.json();
        if (data && Array.isArray(data.tracks) && data.tracks.length > 0) {
          tracksToPlay = data.tracks;
          setArtistTracks(data.tracks);
          setHasMore(false);
        }
      } catch (err) {
        console.error("Error loading tracks for shuffle:", err);
      }
    }
    const shuffled = [...tracksToPlay].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled);
  };

  const handleFollowToggle = () => {
    toggleFollowArtist({
      name: artistName,
      avatar: heroImage,
      subscribers: subscriberCount
    });
  };

  const handleLoadMoreSongs = async (loadAll: boolean = false) => {
    if (loadingMore || !artistName) return;
    setLoadingMore(true);

    try {
      const url = new URL(`${backendUrl}/api/artist/${encodeURIComponent(artistName)}/more-songs`);
      if (songsBrowseId) {
        url.searchParams.set('browseId', songsBrowseId);
      }
      url.searchParams.set('offset', artistTracks.length.toString());
      url.searchParams.set('limit', loadAll ? '200' : '40');

      const res = await fetch(url.toString());
      const data = await res.json();

      if (data && Array.isArray(data.tracks) && data.tracks.length > 0) {
        setArtistTracks(prev => {
          const existingIds = new Set(prev.map(t => t.videoId));
          const fresh = data.tracks.filter((t: Track) => !existingIds.has(t.videoId));
          return [...prev, ...fresh];
        });
        setHasMore(Boolean(data.hasMore && !loadAll));
        if (data.total) {
          setTotalSongs(data.total);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading more artist songs:", err);
    } finally {
      setLoadingMore(false);
    }
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
      const name = prompt("Create a new playlist name:");
      if (name && name.trim()) {
        const id = usePlayerStore.getState().createPlaylist(name.trim());
        if (id) {
          usePlayerStore.getState().addTrackToPlaylist(id, track);
          useAuthStore.getState().setToast(`Created and added to "${name}"`);
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
        useAuthStore.getState().setToast(`Added to "${userPlaylists[idx].name}"`);
      }
    }
    setActiveMenuTrackId(null);
  };

  // Same fade of color in range as in player page (0% topGradient -> 40% midGradient -> 100% #0a0a0c)
  const currentGradient = dominantTheme
    ? `linear-gradient(180deg, ${dominantTheme.topGradient} 0%, ${dominantTheme.midGradient} 40%, #0a0a0c 100%)`
    : 'linear-gradient(180deg, #1e293b 0%, #0f172a 40%, #0a0a0c 100%)';

  return (
    <div 
      className="fixed inset-0 z-[60] overflow-y-auto select-none hide-scrollbar"
    >
      <SmoothBackground 
        trackKey={artistName}
        gradient={currentGradient} 
        glowColor={dominantTheme?.topGradient || '#38bdf8'}
        durationMs={700} 
      />
      <div className="relative z-10 max-w-4xl mx-auto min-h-screen pb-32 px-4 sm:px-6 pt-4">
        {/* Top Floating Close Bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between py-3 backdrop-blur-md">
          <button
            onClick={closeArtistModal}
            className="p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white/90 hover:text-white transition-all shadow-md cursor-pointer"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <span className="text-xs uppercase font-extrabold tracking-widest text-neutral-300">
            Artist Profile
          </span>
          <div className="w-10" />
        </div>

        {/* Hero Section: Square image box + Artist details */}
        <div 
          className="relative rounded-3xl overflow-hidden mt-2 border shadow-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-stretch gap-6 sm:gap-8 backdrop-blur-xl"
          style={{
            backgroundColor: dominantTheme?.cardBg || 'rgba(24, 24, 28, 0.65)',
            borderColor: dominantTheme?.cardBorder || 'rgba(255, 255, 255, 0.12)'
          }}
        >
          {/* Square Image Box */}
          <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 aspect-square rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/15 flex-shrink-0 bg-neutral-900 group relative">
            <img
              src={heroImage}
              alt={artistName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-top sm:object-[center_15%] transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = activeArtistModal.avatar || 
                  artistTracks[0]?.poster || 
                  artistTracks[0]?.thumbnails?.[0]?.url || 
                  '/default_artist.png';
                if (fallback && target.src !== fallback) {
                  target.src = fallback;
                } else if (!target.src.endsWith('/default_artist.png')) {
                  target.src = '/default_artist.png';
                }
              }}
            />
          </div>

          {/* Artist Bio & Action Controls: Vertically distributed to fill the hero card */}
          <div className="min-w-0 flex-1 text-center sm:text-left z-10 w-full flex flex-col justify-between py-1 sm:py-2 gap-4 sm:gap-0">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                {monthlyListeners ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00d2c4]/20 backdrop-blur-md text-[#00d2c4] text-xs font-bold tracking-wide border border-[#00d2c4]/30 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" /> {monthlyListeners}
                  </span>
                ) : (
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Artist
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight drop-shadow-md truncate leading-[1.15]">
                {artistName}
              </h1>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm text-neutral-300 font-medium flex-wrap">
                {subscriberCount && <span>{subscriberCount}</span>}
                {subscriberCount && (totalSongs || artistTracks.length > 0) && (
                  <span className="text-neutral-500">•</span>
                )}
                {(totalSongs || artistTracks.length > 0) && (
                  <span>{totalSongs || artistTracks.length} tracks</span>
                )}
                {artistAlbums.length > 0 && (
                  <>
                    <span className="text-neutral-500">•</span>
                    <span>{artistAlbums.length} albums</span>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons: Play All, Shuffle, Follow */}
            <div className="flex items-center justify-center sm:justify-start gap-3 pt-3 sm:pt-0 flex-wrap">
              <button
                onClick={handlePlayAll}
                disabled={artistTracks.length === 0}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-extrabold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                Play All ({totalSongs || artistTracks.length})
              </button>

              <button
                onClick={handleShufflePlay}
                disabled={artistTracks.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold text-sm backdrop-blur-md transition-all cursor-pointer disabled:opacity-50"
                title="Shuffle Songs"
              >
                <Shuffle className="w-4 h-4" />
                Shuffle
              </button>

              <button
                onClick={handleFollowToggle}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer border ${
                  isFollowing
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Popular Songs Section */}
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Top Songs
            </h3>
            <span className="text-xs text-neutral-400 font-mono">
              {artistTracks.length} {totalSongs && totalSongs > artistTracks.length ? `of ${totalSongs}+` : ''} tracks
            </span>
          </div>

          {loading && artistTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-400">
              <Loader2 className="w-7 h-7 animate-spin text-[#00d2c4]" />
              <span className="text-xs">Loading tracks for {artistName}...</span>
            </div>
          ) : artistTracks.length === 0 ? (
            <div className="text-center py-16 bg-[#16161a] rounded-2xl border border-white/5 space-y-2">
              <Music2 className="w-8 h-8 text-neutral-500 mx-auto" />
              <p className="text-sm text-neutral-300 font-semibold">No tracks found for this artist.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {artistTracks.map((track, index) => {
                const isPlayingThis = currentTrack?.videoId === track.videoId && isPlaying;
                const isLiked = isFavorite(track.videoId);
                const isMenuOpen = activeMenuTrackId === track.videoId;

                return (
                  <div
                    key={`${track.videoId}-${index}`}
                    onClick={() => playTrack(track, artistTracks)}
                    className="group relative flex items-center justify-between p-2.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Track Number / Equalizer */}
                      <span className="w-5 text-center text-xs font-mono text-neutral-400 font-bold flex-shrink-0">
                        {isPlayingThis ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="w-0.5 h-3 bg-[#00d2c4] rounded-full animate-wave-1" />
                            <span className="w-0.5 h-3 bg-[#00d2c4] rounded-full animate-wave-2" />
                            <span className="w-0.5 h-3 bg-[#00d2c4] rounded-full animate-wave-3" />
                          </div>
                        ) : (
                          index + 1
                        )}
                      </span>

                      {/* Poster Thumbnail */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow-md">
                        <MusicPoster
                          src={track.poster || track.thumbnails?.[0]?.url}
                          fallbackSrc={track.fallbackPoster}
                          videoId={track.videoId}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Title & Duration */}
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className={`text-sm font-semibold truncate ${isPlayingThis ? 'text-[#00d2c4]' : 'text-white'}`}>
                          {track.title}
                        </h4>
                        <p className="text-xs text-neutral-400 truncate mt-0.5">
                          {track.artists?.map(a => typeof a === 'string' ? a : a.name).join(', ') || artistName}
                        </p>
                      </div>
                    </div>

                    {/* Actions: Duration, Favorite Heart, 3-dots */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-mono text-neutral-400 hidden sm:inline mr-2">
                        {track.durationFormatted || '3:30'}
                      </span>

                      <button
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

              {/* Load More / Full Discography Buttons */}
              <div className="pt-6 pb-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                {hasMore ? (
                  <>
                    <button
                      onClick={() => handleLoadMoreSongs(false)}
                      disabled={loadingMore}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-sm backdrop-blur-md border border-white/10 transition-all cursor-pointer shadow-lg hover:border-[#00d2c4]/50"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#00d2c4]" />
                          <span>Loading more tracks...</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 text-[#00d2c4]" />
                          <span>
                            Load More Songs {totalSongs ? `(${artistTracks.length} of ${totalSongs})` : ''}
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleLoadMoreSongs(true)}
                      disabled={loadingMore}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#00d2c4]/15 hover:bg-[#00d2c4]/25 active:scale-95 text-[#00d2c4] font-bold text-sm border border-[#00d2c4]/30 transition-all cursor-pointer shadow-lg"
                      title="Load all available songs in full catalog"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Load All Songs</span>
                    </button>
                  </>
                ) : artistTracks.length > 5 ? (
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-neutral-300 shadow-md">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>All {artistTracks.length} songs loaded</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Albums & Discography Section */}
        {artistAlbums.length > 0 && (
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-2">
              <Disc className="w-5 h-5 text-[#00d2c4]" />
              <h4 className="text-xl font-bold text-white tracking-tight">
                Albums & Releases
              </h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {artistAlbums.map((album, idx) => {
                const isLoadingThis = playingAlbumId === album.browseId;
                return (
                  <div 
                    key={`alb-${idx}`}
                    onClick={() => handlePlayArtistAlbum(album.browseId)}
                    className="group flex flex-col p-3 rounded-2xl bg-[#16161a] hover:bg-[#202028] border border-white/5 transition-all shadow-md cursor-pointer hover:scale-[1.03]"
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-neutral-900 mb-3 shadow-lg relative">
                      <img 
                        src={album.cover || '/logo.png'} 
                        alt={album.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.src.endsWith('/logo.png')) {
                            target.src = '/logo.png';
                          }
                        }}
                      />
                      {/* Quick Play Hover Button */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[#00d2c4] text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                          {isLoadingThis ? (
                            <Loader2 className="w-5 h-5 text-black animate-spin" />
                          ) : (
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>
                    <h5 className="text-xs font-bold text-white truncate group-hover:text-[#00d2c4] transition-colors">
                      {album.title}
                    </h5>
                    <span className="text-[11px] text-neutral-400 mt-0.5">
                      {album.year || 'Album'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* About the Artist Bio Section */}
        {artistBio && (
          <div className="mt-12 p-6 rounded-3xl bg-[#16161a] border border-white/10 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-white tracking-tight">
                About {artistName}
              </h4>
              {monthlyListeners && (
                <span className="text-xs font-semibold text-[#00d2c4] bg-[#00d2c4]/10 px-3 py-1 rounded-full border border-[#00d2c4]/20">
                  {monthlyListeners}
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line font-normal">
              {showFullBio || artistBio.length <= 280 
                ? artistBio 
                : `${artistBio.slice(0, 280)}...`}
            </p>
            {artistBio.length > 280 && (
              <button
                onClick={() => setShowFullBio(!showFullBio)}
                className="text-xs font-bold text-[#00d2c4] hover:underline cursor-pointer pt-1"
              >
                {showFullBio ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
