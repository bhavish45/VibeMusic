"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { useAuthStore } from "@/store/authStore";
import { audioPlayer } from "@/lib/audioPlayer";

/**
 * Checks if the user is currently typing in an input, textarea, or editable element.
 */
function isUserTyping(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  if (target.getAttribute("role") === "textbox") return true;
  return false;
}

export default function KeyboardShortcutsHandler() {
  const lastVolumeRef = useRef<number>(0.8);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const typing = isUserTyping(e.target);

      // 1. ESCAPE - Always handled even when typing (blurs input or closes modals)
      if (e.key === "Escape") {
        if (typing && e.target instanceof HTMLElement) {
          e.target.blur();
          return;
        }

        const state = usePlayerStore.getState();
        if (state.isShortcutsOpen) {
          state.closeShortcuts();
          return;
        }
        if (state.isFullScreenLyricsOpen) {
          state.setIsFullScreenLyricsOpen(false);
          return;
        }
        if (state.isQueueOpen) {
          state.setIsQueueOpen(false);
          return;
        }
        if (state.isExpanded) {
          state.setIsExpanded(false);
          return;
        }
        if (state.isSettingsOpen) {
          state.closeSettings();
          return;
        }
        if (state.isRecentSongsOpen) {
          state.closeRecentSongs();
          return;
        }
        if (state.isUpdatesOpen) {
          state.closeUpdates();
          return;
        }
        if (state.activeArtistModal) {
          state.closeArtistModal();
          return;
        }
        if (state.addToPlaylistTrack) {
          state.closeAddToPlaylist();
          return;
        }
        if (state.isCreatePlaylistOpen) {
          state.closeCreatePlaylist();
          return;
        }
        return;
      }

      // 2. FOCUS SEARCH (Ctrl+K, Cmd+K, or '/')
      if (
        (e.key === "/" && !typing) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        const searchInput = document.getElementById("main-search-input") as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        } else {
          // If on another route, navigate to search page
          window.location.href = "/search";
        }
        return;
      }

      // 3. SHOW KEYBOARD SHORTCUTS HELP MODAL (? or Shift + /)
      if (e.key === "?" && !typing) {
        e.preventDefault();
        usePlayerStore.getState().toggleShortcuts();
        return;
      }

      // If user is currently typing in an input field, do not trigger single-key playback shortcuts
      if (typing) {
        return;
      }

      // Do not trigger shortcuts if Ctrl / Alt / Meta is held (unless explicitly handled above)
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const playerState = usePlayerStore.getState();
      const currentTrack = playerState.currentTrack;

      switch (e.code) {
        // PLAY / PAUSE TOGGLE (Space or K)
        case "Space":
        case "KeyK": {
          e.preventDefault();
          if (!currentTrack) return;
          if (playerState.isPlaying) {
            playerState.pause();
          } else {
            playerState.play();
          }
          break;
        }

        // SEEK FORWARD / BACKWARD or PREV / NEXT TRACK (Arrows)
        case "ArrowRight": {
          e.preventDefault();
          if (!currentTrack) return;
          if (e.shiftKey) {
            // Shift + Right -> Next Track
            playerState.nextTrack();
            useAuthStore.getState().setToast("Next Track");
          } else {
            // Right -> Seek Forward 5s
            const cur = audioPlayer.getCurrentTime();
            const dur = audioPlayer.getEffectiveDuration();
            const target = Math.min(dur > 0 ? dur : cur + 5, cur + 5);
            audioPlayer.seek(target);
          }
          break;
        }

        case "ArrowLeft": {
          e.preventDefault();
          if (!currentTrack) return;
          if (e.shiftKey) {
            // Shift + Left -> Previous Track
            playerState.prevTrack();
            useAuthStore.getState().setToast("Previous Track");
          } else {
            // Left -> Seek Backward 5s
            const cur = audioPlayer.getCurrentTime();
            const target = Math.max(0, cur - 5);
            audioPlayer.seek(target);
          }
          break;
        }

        // NEXT TRACK (N)
        case "KeyN": {
          e.preventDefault();
          if (!currentTrack) return;
          playerState.nextTrack();
          useAuthStore.getState().setToast("Next Track");
          break;
        }

        // PREVIOUS TRACK (P)
        case "KeyP": {
          e.preventDefault();
          if (!currentTrack) return;
          playerState.prevTrack();
          useAuthStore.getState().setToast("Previous Track");
          break;
        }

        // SEEK BACKWARD 10s (J)
        case "KeyJ": {
          e.preventDefault();
          if (!currentTrack) return;
          const cur = audioPlayer.getCurrentTime();
          audioPlayer.seek(Math.max(0, cur - 10));
          break;
        }

        // VOLUME UP (ArrowUp: +5%)
        case "ArrowUp": {
          e.preventDefault();
          const currentVol = playerState.volume ?? 1.0;
          const newVol = Math.min(1, Math.round((currentVol + 0.05) * 100) / 100);
          playerState.setVolume(newVol);
          audioPlayer.applyVolume(newVol);
          lastVolumeRef.current = newVol;
          useAuthStore.getState().setToast(`Volume: ${Math.round(newVol * 100)}%`);
          break;
        }

        // VOLUME DOWN (ArrowDown: -5%)
        case "ArrowDown": {
          e.preventDefault();
          const currentVol = playerState.volume ?? 1.0;
          const newVol = Math.max(0, Math.round((currentVol - 0.05) * 100) / 100);
          playerState.setVolume(newVol);
          audioPlayer.applyVolume(newVol);
          if (newVol > 0) {
            lastVolumeRef.current = newVol;
          }
          useAuthStore.getState().setToast(`Volume: ${Math.round(newVol * 100)}%`);
          break;
        }

        // MUTE / UNMUTE (M)
        case "KeyM": {
          e.preventDefault();
          const currentVol = playerState.volume ?? 1.0;
          if (currentVol > 0) {
            lastVolumeRef.current = currentVol;
            playerState.setVolume(0);
            audioPlayer.applyVolume(0);
            useAuthStore.getState().setToast("Muted");
          } else {
            const restored = lastVolumeRef.current > 0 ? lastVolumeRef.current : 0.8;
            playerState.setVolume(restored);
            audioPlayer.applyVolume(restored);
            useAuthStore.getState().setToast(`Unmuted (${Math.round(restored * 100)}%)`);
          }
          break;
        }

        // TOGGLE SHUFFLE (S)
        case "KeyS": {
          e.preventDefault();
          const wasShuffled = playerState.isShuffled;
          playerState.toggleShuffle();
          useAuthStore.getState().setToast(!wasShuffled ? "Shuffle: On" : "Shuffle: Off");
          break;
        }

        // CYCLE REPEAT (R)
        case "KeyR": {
          e.preventDefault();
          playerState.toggleRepeat();
          const nextMode = usePlayerStore.getState().repeatMode;
          const label =
            nextMode === "one"
              ? "Repeat: Current Track"
              : nextMode === "all"
              ? "Repeat: Entire Queue"
              : "Repeat: Off";
          useAuthStore.getState().setToast(label);
          break;
        }

        // TOGGLE QUEUE DRAWER (Q)
        case "KeyQ": {
          e.preventDefault();
          playerState.setIsQueueOpen(!playerState.isQueueOpen);
          break;
        }

        // TOGGLE FULLSCREEN LYRICS (L)
        case "KeyL": {
          e.preventDefault();
          playerState.setIsFullScreenLyricsOpen(!playerState.isFullScreenLyricsOpen);
          break;
        }

        // TOGGLE EXPANDED PLAYER (F)
        case "KeyF": {
          e.preventDefault();
          playerState.setIsExpanded(!playerState.isExpanded);
          break;
        }

        // LIKE / FAVORITE CURRENT TRACK (C)
        case "KeyC": {
          e.preventDefault();
          if (!currentTrack) return;
          playerState.toggleFavorite(currentTrack);
          const isFav = usePlayerStore.getState().isFavorite(currentTrack.videoId);
          useAuthStore.getState().setToast(isFav ? "Added to Favorites" : "Removed from Favorites");
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
