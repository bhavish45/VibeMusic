"use client";

import React from 'react';
import { Play, Pause } from 'lucide-react';
import MusicPoster from '@/components/ui/MusicPoster';
import SongActionMenu from '@/components/ui/SongActionMenu';
import { usePlayerStore, Track } from '@/store/playerStore';

interface SongCardProps {
  track: Track;
  sectionTracks: Track[];
  onPlay: (track: Track, tracks: Track[]) => void;
  isDragging?: boolean;
}

const SongCard = React.memo(function SongCard({
  track,
  sectionTracks,
  onPlay,
  isDragging = false
}: SongCardProps) {
  const { currentTrack, isPlaying, openArtistModal } = usePlayerStore();

  const isThisPlaying = currentTrack?.videoId === track.videoId && isPlaying;

  const handleCardClick = () => {
    if (isDragging) return;
    onPlay(track, sectionTracks);
  };

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDragging) return;
    const firstA = track.artists?.[0];
    const aName = firstA ? (typeof firstA === 'string' ? firstA : firstA.name) : 'Artist';
    const aId = typeof firstA === 'object' ? firstA.id : undefined;
    openArtistModal({
      name: aName,
      id: aId,
      avatar: track.poster || track.thumbnails?.[0]?.url
    });
  };

  return (
    <div
      onClick={handleCardClick}
      className="group flex-shrink-0 w-36 sm:w-44 flex flex-col cursor-pointer select-none"
    >
      {/* Square Artwork */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-900 shadow-md group-hover:shadow-xl transition-shadow duration-300">
        <MusicPoster
          src={track.poster || track.thumbnails?.[track.thumbnails.length - 1]?.url}
          fallbackSrc={track.fallbackPoster}
          videoId={track.videoId}
          alt={track.title}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300 ease-out pointer-events-none"
        />

        {/* Floating Play Button Overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isDragging) return;
            onPlay(track, sectionTracks);
          }}
          className={`absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transition-all duration-200 cursor-pointer ${
            isThisPlaying
              ? 'opacity-100 scale-100'
              : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100'
          }`}
          title={isThisPlaying ? "Pause" : "Play"}
        >
          {isThisPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        {/* 3-Dots Options Menu */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <SongActionMenu
            track={track}
            buttonClassName="w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-sm cursor-pointer transition-all hover:scale-105 shadow-md"
            iconClassName="w-3.5 h-3.5"
            title="Song Options"
          />
        </div>
      </div>

      {/* Title & Artist */}
      <div className="mt-2 space-y-0.5">
        <h3 className="text-sm font-bold text-white truncate leading-snug group-hover:text-[#00d2c4] transition-colors">
          {track.title}
        </h3>
        <p
          onClick={handleArtistClick}
          className="text-xs text-[#8e8e93] hover:text-white truncate leading-normal cursor-pointer transition-colors"
          title="View Artist Profile"
        >
          {track.artists?.map((a: any) => typeof a === 'string' ? a : a.name).join(', ') || 'Various Artists'}
        </p>
      </div>
    </div>
  );
});

export default SongCard;
