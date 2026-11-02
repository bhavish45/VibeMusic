"use client";

import { usePathname } from 'next/navigation';
import { 
  Bell, 
  History, 
  Settings 
} from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { useNavigationStore } from '@/store/navigationStore';
import { usePlayerStore } from '@/store/playerStore';
import { CURRENT_VERSION } from '@/data/updates';
import UserButton from '@/components/layout/UserButton';
import SearchBarHeader from '@/components/layout/SearchBarHeader';

export default function Header() {
  const routerPathname = usePathname();
  const { currentPath } = useNavigationStore();
  const pathname = currentPath || routerPathname || '/';
  const [greeting, setGreeting] = useState('');
  const [hasUnreadUpdates, setHasUnreadUpdates] = useState(false);

  const { openRecentSongs, openSettings, openUpdates, playHistory } = usePlayerStore();

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) setGreeting('Good Morning');
      else if (hour >= 12 && hour < 17) setGreeting('Good Afternoon');
      else if (hour >= 17 && hour < 22) setGreeting('Good Evening');
      else setGreeting('Good Night');
    };

    updateGreeting();
    const timer = setInterval(updateGreeting, 30000);

    try {
      const seen = localStorage.getItem('vibemusic_seen_update_version');
      if (seen !== CURRENT_VERSION) {
        setHasUnreadUpdates(true);
      }
    } catch (e) {}

    return () => clearInterval(timer);
  }, []);

  const handleOpenUpdates = () => {
    setHasUnreadUpdates(false);
    openUpdates();
  };

  // Search Page Header
  if (pathname.startsWith('/search')) {
    return (
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 md:px-8 pt-6 pb-2 bg-black/40 backdrop-blur-md transition-colors duration-300 h-[76px]">
        <div className="flex-1 mr-4 sm:mr-6 relative min-w-0">
          <Suspense fallback={<div className="h-10 sm:h-11 bg-[#202024] rounded-2xl w-full" />}>
            <SearchBarHeader />
          </Suspense>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 relative flex-shrink-0">
          <UserButton />
        </div>
      </header>
    );
  }

  // Library Page Header
  if (pathname.startsWith('/library')) {
    return (
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 md:px-8 pt-6 pb-2 bg-black/40 backdrop-blur-md transition-colors duration-300 h-[76px]">
        <div className="flex flex-col justify-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-none">
            Library
          </h1>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 relative flex-shrink-0">
          <button
            onClick={handleOpenUpdates}
            className="w-10 h-10 rounded-full hover:bg-neutral-800/80 active:scale-95 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer relative"
            title="What's New & Updates"
            aria-label="What's New & Updates"
          >
            <Bell className="w-5 h-5" />
            {hasUnreadUpdates && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#00d2c4] ring-2 ring-black animate-pulse" />
            )}
          </button>

          <button
            onClick={openRecentSongs}
            className="w-10 h-10 rounded-full hover:bg-neutral-800/80 active:scale-95 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer relative"
            title="Recent Songs"
            aria-label="Recent Songs"
          >
            <History className="w-5 h-5" />
            {playHistory.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal-400 ring-2 ring-black" />
            )}
          </button>

          <button
            onClick={openSettings}
            className="w-10 h-10 rounded-full hover:bg-neutral-800/80 active:scale-95 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <UserButton />
        </div>
      </header>
    );
  }

  // Home Page Header
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-6 md:px-8 pt-6 pb-2 bg-black/40 backdrop-blur-md transition-colors duration-300 h-[76px]">
      {/* Brand Title & Dynamic Greeting */}
      <div className="flex flex-col justify-center">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-none">
          VibeMusic
        </h1>
        <span className="text-xs text-[#8e8e93] font-medium min-h-[16px] mt-1" suppressHydrationWarning>
          {greeting || 'Good Morning'}
        </span>
      </div>

      {/* Action Icons: Bell, History, Settings & User Account */}
      <div className="flex items-center gap-1 sm:gap-2 relative flex-shrink-0">
        <button
          onClick={handleOpenUpdates}
          className="w-10 h-10 rounded-full hover:bg-neutral-800/80 active:scale-95 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer relative"
          title="What's New & Updates"
          aria-label="What's New & Updates"
        >
          <Bell className="w-5 h-5" />
          {hasUnreadUpdates && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#00d2c4] ring-2 ring-black animate-pulse" />
          )}
        </button>

        <button
          onClick={openRecentSongs}
          className="w-10 h-10 rounded-full hover:bg-neutral-800/80 active:scale-95 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer relative"
          title="Recent Songs"
          aria-label="Recent Songs"
        >
          <History className="w-5 h-5" />
          {playHistory.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal-400 ring-2 ring-black" />
          )}
        </button>

        <button
          onClick={openSettings}
          className="w-10 h-10 rounded-full hover:bg-neutral-800/80 active:scale-95 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        <UserButton />
      </div>
    </header>
  );
}
