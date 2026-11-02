"use client";

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePlayerStore } from '@/store/playerStore';
import { useSettingsStore } from '@/store/settingsStore';

export default function AuthInitializer() {
  const { token, isAuthenticated, checkAuth, checkSpotifyStatus, toast, setToast } = useAuthStore();
  const { fetchUserLibrary, initPersistedState } = usePlayerStore();
  const { initSettings } = useSettingsStore();

  useEffect(() => {
    // 1. Initialize settings from localStorage on client mount (hydration-safe)
    initSettings();

    // 2. Initialize local library
    initPersistedState();

    // 3. Check Spotify API readiness
    checkSpotifyStatus();

    // 4. Check existing user authentication session
    checkAuth();
  }, [checkAuth, checkSpotifyStatus, initPersistedState, initSettings]);

  // When token or authentication status changes, sync user library
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchUserLibrary(token);
    }
  }, [isAuthenticated, token, fetchUserLibrary]);

  // Global protection: Prevent native dragging of any images, posters, logos, or media files
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    window.addEventListener('dragstart', handleDragStart, { capture: true });
    return () => {
      window.removeEventListener('dragstart', handleDragStart, { capture: true });
    };
  }, []);

  return (
    <>
      {/* Global Toast Notification - Black background, text only, no icons */}
      {toast && (
        <div 
          onClick={() => setToast(null)}
          className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-3 duration-150 cursor-pointer max-w-[90vw] select-none"
        >
          <div className="px-5 py-2.5 rounded-full bg-black border border-white/15 shadow-[0_10px_35px_rgba(0,0,0,0.9)] text-white text-xs sm:text-sm font-medium tracking-wide text-center whitespace-nowrap">
            {toast.message}
          </div>
        </div>
      )}
    </>
  );
}
