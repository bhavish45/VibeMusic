"use client";
import { useState, useEffect } from 'react';

// In-memory cache for resolved Spotify track posters
const spPosterCache = new Map<string, string>();

interface MusicPosterProps {
  src?: string;
  fallbackSrc?: string;
  videoId?: string;
  alt: string;
  className?: string;
  glow?: boolean;
  zoomSquare?: boolean;
}

export default function MusicPoster({
  src,
  fallbackSrc,
  videoId,
  alt,
  className = "w-full h-full object-cover object-center",
  glow = false
}: MusicPosterProps) {
  const [errorCount, setErrorCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [spotifyPoster, setSpotifyPoster] = useState<string | null>(() => {
    if (videoId?.startsWith('sp_')) {
      const spId = videoId.replace('sp_', '').trim();
      return spPosterCache.get(spId) || null;
    }
    return null;
  });

  // Automatically fetch individual track artwork via Spotify oEmbed if src is missing and track is a Spotify track
  useEffect(() => {
    const hasValidSrc = Boolean(src && !src.endsWith('/logo.png'));
    if (!hasValidSrc && videoId?.startsWith('sp_')) {
      const spId = videoId.replace('sp_', '').trim();
      if (!spId || spId.startsWith('track_')) return;

      if (spPosterCache.has(spId)) {
        setSpotifyPoster(spPosterCache.get(spId)!);
        return;
      }

      // Check browser sessionStorage
      try {
        const stored = typeof window !== 'undefined' ? sessionStorage.getItem(`sp_art_${spId}`) : null;
        if (stored) {
          spPosterCache.set(spId, stored);
          setSpotifyPoster(stored);
          return;
        }
      } catch {}

      // Fetch from public Spotify oEmbed
      let isMounted = true;
      fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${spId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!isMounted || !data?.thumbnail_url) return;
          const hd = data.thumbnail_url.replace("ab67616d00001e02", "ab67616d0000b273");
          spPosterCache.set(spId, hd);
          try {
            if (typeof window !== 'undefined') sessionStorage.setItem(`sp_art_${spId}`, hd);
          } catch {}
          setSpotifyPoster(hd);
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }
  }, [src, videoId]);

  // Normalize YouTube thumbnail URLs: convert letterboxed hqdefault to clean 16:9 mqdefault
  const normalizeThumb = (url?: string) => {
    if (!url) return '';
    if (url.includes('i.ytimg.com/vi/') && url.includes('/hqdefault.jpg')) {
      return url.replace('/hqdefault.jpg', '/mqdefault.jpg');
    }
    return url;
  };

  const getSource = (errCount: number) => {
    const cleanSrc = normalizeThumb(src);
    const cleanFallback = normalizeThumb(fallbackSrc);
    if (errCount === 0 && cleanSrc && !cleanSrc.endsWith('/logo.png')) return cleanSrc;
    if (spotifyPoster) return spotifyPoster;
    if (errCount <= 1 && cleanFallback && cleanFallback !== cleanSrc && !cleanFallback.endsWith('/logo.png')) return cleanFallback;
    if (errCount <= 2 && videoId && !videoId.startsWith('sp_')) return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    if (errCount <= 3 && videoId && !videoId.startsWith('sp_')) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return '/logo.png';
  };

  // Track key to identify when the song / track changes
  const currentTrackKey = `${videoId || ''}_${src || ''}`;
  const [prevTrackKey, setPrevTrackKey] = useState(currentTrackKey);

  if (prevTrackKey !== currentTrackKey) {
    setPrevTrackKey(currentTrackKey);
    setErrorCount(0);
    setIsLoaded(false);
    if (loadedSrc) {
      setPrevSrc(loadedSrc);
    }
  }

  const currentSrc = getSource(errorCount);
  const isLogoFallback = currentSrc.endsWith('/logo.png');

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#121216] flex items-center justify-center select-none">
      {glow && (
        <div
          className="absolute -inset-4 bg-gradient-to-r from-purple-600/30 via-pink-600/30 to-blue-600/30 blur-2xl opacity-60 pointer-events-none"
        />
      )}

      {/* Previous poster layer: stays completely visible while new poster loads over network */}
      {prevSrc && (
        <img
          src={prevSrc}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={`absolute inset-0 w-full h-full select-none ${prevSrc.endsWith('/logo.png')
              ? "object-contain p-3.5"
              : `${className} ${!className.includes('object-') ? 'object-cover object-center' : ''}`
            } pointer-events-none`}
        />
      )}

      {/* Subtle Instant Placeholder - Only shown on initial boot if no poster was loaded yet */}
      {!isLoaded && !prevSrc && (
        <div className="absolute inset-0 bg-[#141418] flex items-center justify-center pointer-events-none">
          <img
            src="/logo.png"
            alt=""
            draggable={false}
            className="w-7 h-7 sm:w-9 sm:h-9 object-contain opacity-25 filter grayscale select-none pointer-events-none"
          />
        </div>
      )}

      {/* Active incoming poster: smoothly fades in over previous poster on load */}
      <img
        key={currentTrackKey}
        src={currentSrc}
        alt={alt || "Music poster"}
        draggable={false}
        loading="eager"
        decoding="async"
        onLoad={() => {
          setIsLoaded(true);
          setLoadedSrc(currentSrc);
        }}
        className={`absolute inset-0 w-full h-full select-none ${isLogoFallback
            ? "object-contain p-3.5 scale-100"
            : `${className} ${!className.includes('object-') ? 'object-cover object-center' : ''}`
          } ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 ease-out`}
        onError={() => {
          setErrorCount(prev => prev + 1);
        }}
      />
    </div>
  );
}
