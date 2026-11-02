"use client";

import { useEffect, useRef } from 'react';
import { 
  Search as SearchIcon, 
  X, 
  History, 
  ArrowUpRight, 
  Trash2 
} from 'lucide-react';
import { useSearchStore } from '@/store/searchStore';
import { usePlayerStore, Track } from '@/store/playerStore';
import { getBackendUrl } from '@/store/authStore';
import MusicPoster from '@/components/ui/MusicPoster';
import SongActionMenu from '@/components/ui/SongActionMenu';
import { cleanSuggestionsList, matchesArtistName } from '@/lib/searchUtils';
import { getClientCache, setClientCache } from '@/lib/clientCache';

export default function SearchBarHeader() {
  const {
    query,
    setQuery,
    suggestions,
    setSuggestions,
    quickSongs,
    setQuickSongs,
    quickArtist,
    setQuickArtist,
    showDropdown,
    setShowDropdown,
    recentSearches,
    initRecentSearches,
    clearRecentSearches,
    removeRecentSearch,
    triggerSearch,
    clearSearch
  } = useSearchStore();

  const { playTrack, openArtistModal } = usePlayerStore();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const backendUrl = getBackendUrl();

  // Initialize recent searches from localStorage on mount
  useEffect(() => {
    initRecentSearches();
  }, [initRecentSearches]);

  // Handle clicking outside the search container to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowDropdown]);

  // Live suggestions, quick songs & matching artist preview while typing
  useEffect(() => {
    const clean = query.trim();
    if (clean.length >= 2) {
      // 1. Text autocomplete suggestions
      const cacheKey = `sug_${clean.toLowerCase()}`;
      const cachedSug = getClientCache<string[]>(cacheKey);
      if (cachedSug) {
        setSuggestions(cleanSuggestionsList(cachedSug, clean, quickSongs));
      } else {
        fetch(`${backendUrl}/api/suggestions?q=${encodeURIComponent(clean)}`)
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setClientCache(cacheKey, data, 3600);
              setSuggestions(cleanSuggestionsList(data, clean, quickSongs));
            }
          })
          .catch(() => {});
      }

      // 2. Pre-fetch quick songs preview
      fetch(`${backendUrl}/api/search?q=${encodeURIComponent(clean)}&filter=songs`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            const topSongs = data.slice(0, 5);
            setQuickSongs(topSongs);
            const currentSug = useSearchStore.getState().suggestions;
            setSuggestions(cleanSuggestionsList(currentSug, clean, topSongs));
          }
        })
        .catch(() => {});

      // 3. Pre-fetch quick artist only if typing actually matches the artist name
      fetch(`${backendUrl}/api/search?q=${encodeURIComponent(clean)}&filter=artists`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            const topArtist = data[0];
            const aName = topArtist.name || topArtist.title || '';
            if (aName && matchesArtistName(clean, aName)) {
              setQuickArtist(topArtist);
            } else {
              setQuickArtist(null);
            }
          } else {
            setQuickArtist(null);
          }
        })
        .catch(() => setQuickArtist(null));
    } else {
      setSuggestions([]);
      setQuickSongs([]);
      setQuickArtist(null);
    }
  }, [query, backendUrl, setSuggestions, setQuickSongs, setQuickArtist]);

  const handlePlaySong = (track: Track, trackList: Track[]) => {
    setShowDropdown(false);
    playTrack(track, trackList);
  };

  return (
    <div ref={searchContainerRef} className="relative w-full">
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          triggerSearch(query);
        }}
        autoComplete="off"
        className="flex items-center h-10 sm:h-11 bg-[#202024] rounded-2xl px-4 border border-white/5 shadow-md focus-within:border-white/20 transition-all w-full"
      >
        <SearchIcon className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 mr-3 flex-shrink-0" />
        <input
          id="main-search-input"
          name="vibemusic_search_query"
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full bg-transparent text-white placeholder-neutral-400 text-sm sm:text-base focus:outline-none"
          placeholder="Search songs, artists, or albums..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onClick={() => setShowDropdown(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowDropdown(false);
            }
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              clearSearch();
            }}
            className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
      </form>

      {/* FLOATING DROPDOWN: RECENT SEARCHES (WHEN EMPTY) OR LIVE MATCHES (WHEN TYPING) */}
      {showDropdown && (
        (query.trim().length === 0 && recentSearches.length > 0) ||
        (query.trim().length >= 2 && (Boolean(quickArtist) || quickSongs.length > 0 || suggestions.length > 0))
      ) && (
        <div className="absolute left-0 right-0 top-full mt-2.5 z-50 bg-[#16161a] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-2 space-y-1 max-h-[75vh] overflow-y-auto hide-scrollbar animate-in fade-in zoom-in-95 duration-150">
          {/* RECENT SEARCHES: Strictly shown ONLY when search bar has 0 characters typed */}
          {query.trim().length === 0 && recentSearches.length > 0 && (
            <div className="space-y-1">
              {recentSearches.slice(0, 5).map((term, i) => (
                <div
                  key={`recent-${term}-${i}`}
                  onClick={() => triggerSearch(term)}
                  className="group flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/10 text-white text-sm cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <History className="w-4 h-4 text-neutral-400 group-hover:text-teal-400 flex-shrink-0 transition-colors" />
                    <span className="font-normal text-neutral-200 group-hover:text-white truncate">
                      {term}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(term);
                      }}
                      className="p-1 rounded-md text-neutral-500 hover:text-red-400 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Remove from history"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <ArrowUpRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
                  </div>
                </div>
              ))}

              {/* Clear search history option below 5 search history in search bar */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearRecentSearches();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl hover:bg-red-500/10 text-neutral-400 hover:text-red-400 text-xs font-semibold transition-colors cursor-pointer"
                  title="Clear recent search history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Search History</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Artist Result (Only shown if typing matches artist name) */}
          {query.trim().length >= 2 && quickArtist && (
            <div className="space-y-1">
              <div
                onClick={() => {
                  setShowDropdown(false);
                  const aAvatar = quickArtist.avatar || quickArtist.originalAvatar || quickArtist.thumbnails?.[0]?.url;
                  openArtistModal({
                    name: quickArtist.name,
                    id: quickArtist.browseId,
                    avatar: aAvatar,
                    subscribers: quickArtist.subscribers
                  });
                }}
                className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="w-11 h-11 rounded-full overflow-hidden bg-neutral-900 flex-shrink-0 border border-white/10">
                  <img
                    src={quickArtist.avatar || quickArtist.originalAvatar || quickArtist.thumbnails?.[0]?.url || '/default_artist.png'}
                    alt={quickArtist.name}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate">
                    {quickArtist.name}
                  </h4>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">
                    {quickArtist.subscribers || 'Artist'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Song Results (Click to play directly) */}
          {query.trim().length >= 2 && quickSongs.length > 0 && (
            <div className="space-y-1">
              {quickSongs.map((song, i) => {
                const artistNames = song.artists?.map(a => typeof a === 'string' ? a : a.name).filter(Boolean) || [];
                const hasArtistMatch = artistNames.some(name => matchesArtistName(query, name));
                const formattedSong: Track = {
                  videoId: song.videoId,
                  title: song.title,
                  artists: song.artists || [{ name: 'Unknown Artist' }],
                  album: song.album,
                  duration: typeof song.duration === 'number' ? song.duration : 210,
                  durationFormatted: song.durationFormatted || '3:30',
                  thumbnails: song.thumbnails,
                  poster: song.poster || song.thumbnails?.[0]?.url,
                  fallbackPoster: song.fallbackPoster || (song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg` : undefined)
                };

                return (
                  <div
                    key={`quick-${song.videoId}-${i}`}
                    onClick={() => handlePlaySong(formattedSong, quickSongs)}
                    className="group flex items-center justify-between gap-3.5 p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0">
                        <MusicPoster
                          src={song.poster || song.thumbnails?.[0]?.url}
                          fallbackSrc={song.fallbackPoster}
                          videoId={song.videoId}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">
                          {song.title}
                        </h4>
                        {hasArtistMatch && artistNames.length > 0 && (
                          <p className="text-xs text-neutral-400 truncate mt-0.5">
                            {artistNames.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 3-Dots Options Menu on Hover */}
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                      <SongActionMenu
                        track={formattedSong}
                        buttonClassName="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        iconClassName="w-4 h-4"
                        title="Song Options"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Suggestions with Diagonal Arrow ↗ */}
          {query.trim().length >= 2 && suggestions.length > 0 && (
            <div className="space-y-1">
              {suggestions.map((sug, i) => (
                <div
                  key={`sug-${i}`}
                  onClick={() => triggerSearch(sug)}
                  className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/10 text-white text-sm cursor-pointer transition-colors"
                >
                  <span className="font-normal text-neutral-200">{sug}</span>
                  <ArrowUpRight className="w-4 h-4 text-neutral-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
