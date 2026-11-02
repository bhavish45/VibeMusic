"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useNavigationStore } from '@/store/navigationStore';
import HomePage from '@/app/page';
import SearchPage from '@/app/search/page';
import LibraryPage from '@/app/library/page';

export default function AppViewContainer({ children }: { children: React.ReactNode }) {
  const routerPathname = usePathname();
  const { currentPath, syncWithLocation } = useNavigationStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    syncWithLocation();
    const onPopState = () => syncWithLocation();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [syncWithLocation]);

  useEffect(() => {
    if (routerPathname) {
      useNavigationStore.setState({ currentPath: routerPathname });
    }
  }, [routerPathname]);

  // Before hydration, render children directly to guarantee SSR matching
  if (!mounted) {
    return <>{children}</>;
  }

  const activePath = currentPath || routerPathname || '/';
  const isSearch = activePath.startsWith('/search');
  const isLibrary = activePath.startsWith('/library');
  const isHome = !isSearch && !isLibrary;

  return (
    <>
      {/* Hidden SSR child element to satisfy Next.js layout requirements */}
      <div className="hidden" aria-hidden="true">
        {children}
      </div>

      {/* Instant 0ms Tab Views with State & Scroll Retention */}
      <div className={isHome ? 'block' : 'hidden'}>
        <HomePage />
      </div>

      <div className={isSearch ? 'block' : 'hidden'}>
        <SearchPage />
      </div>

      <div className={isLibrary ? 'block' : 'hidden'}>
        <LibraryPage />
      </div>
    </>
  );
}
