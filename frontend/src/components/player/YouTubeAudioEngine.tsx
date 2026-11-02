"use client";

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { audioPlayer } from '@/lib/audioPlayer';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function YouTubeAudioEngine() {
  const playerRef = useRef<any>(null);
  const isReadyRef = useRef<boolean>(false);
  const currentVideoIdRef = useRef<string | null>(null);

  const { 
    currentTrack, 
    isPlaying, 
    volume,
    setProgress, 
    setTrackDuration, 
    setIsLoading, 
    play, 
    pause, 
    nextTrack, 
    setError 
  } = usePlayerStore();

  // Load YouTube IFrame API script and create player
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initPlayer = () => {
      if (playerRef.current) return;
      if (!window.YT || !window.YT.Player) return;

      playerRef.current = new window.YT.Player('vibe-yt-player', {
        height: '10',
        width: '10',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            isReadyRef.current = true;
            event.target.setVolume(Math.round(volume * 100));

            // Register with the audioPlayer singleton
            audioPlayer.setYtPlayer(event.target);
            audioPlayer.setupMediaSession();

            // If a track was already queued before the player was ready, play it
            const state = usePlayerStore.getState();
            if (state.currentTrack?.videoId) {
              currentVideoIdRef.current = state.currentTrack.videoId;
              event.target.loadVideoById(state.currentTrack.videoId);
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
            const data = event.data;

            if (data === 1) { // PLAYING
              setIsLoading(false);
              play();
              setError(null);
              const dur = event.target.getDuration();
              if (dur && dur > 0) {
                setTrackDuration(Math.round(dur));
              }
            } else if (data === 2) { // PAUSED
              pause();
            } else if (data === 3) { // BUFFERING
              setIsLoading(true);
            } else if (data === 0) { // ENDED
              const currentMode = usePlayerStore.getState().repeatMode;
              if (currentMode === 'one') {
                event.target.seekTo(0);
                event.target.playVideo();
              } else {
                nextTrack();
              }
            }
          },
          onError: (event: any) => {
            console.warn('YouTube Player error code:', event.data);
            setIsLoading(false);

            // Error codes: 2 (bad param), 5 (HTML5 issue), 100 (not found/private),
            // 101/150 (embedding restricted)
            if (event.data === 101 || event.data === 150) {
              setError('Playback restricted. Skipping…');
            } else if (event.data === 100) {
              setError('Track unavailable. Skipping…');
            } else {
              setError('Playback issue. Skipping…');
            }

            setTimeout(() => {
              usePlayerStore.getState().nextTrack();
            }, 2000);
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Only add the script tag if it hasn't been added yet
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      // Keep player alive for the lifetime of the layout
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync track changes — when currentTrack.videoId changes, load the new video
  useEffect(() => {
    if (!currentTrack?.videoId) return;

    if (currentVideoIdRef.current !== currentTrack.videoId) {
      currentVideoIdRef.current = currentTrack.videoId;

      if (isReadyRef.current && playerRef.current?.loadVideoById) {
        setIsLoading(true);
        playerRef.current.loadVideoById(currentTrack.videoId);
      }
      // If not ready yet, the onReady handler above will pick it up
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.videoId]);

  // Sync play/pause state
  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current) return;

    try {
      const playerState = playerRef.current.getPlayerState?.();
      if (isPlaying && playerState !== 1 && playerState !== 3) {
        playerRef.current.playVideo?.();
      } else if (!isPlaying && playerState === 1) {
        playerRef.current.pauseVideo?.();
      }
    } catch {
      // Player may not be in a valid state
    }
  }, [isPlaying]);

  // Sync volume
  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current) return;
    try {
      playerRef.current.setVolume?.(Math.round(volume * 100));
    } catch {}
  }, [volume]);

  return (
    <div 
      aria-hidden="true" 
      style={{
        position: 'fixed',
        bottom: '-200px',
        right: '-200px',
        width: '10px',
        height: '10px',
        opacity: 0.001,
        pointerEvents: 'none',
        zIndex: -9999
      }}
    >
      <div id="vibe-yt-player" />
    </div>
  );
}
