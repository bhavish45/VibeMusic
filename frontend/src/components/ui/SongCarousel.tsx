"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SongCarouselProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Butter-smooth horizontal scroll carousel:
 * - Downward wheel scrolling scrolls the page vertically naturally (NO horizontal hijack).
 * - Horizontal scrolling triggers via chevron buttons, mouse horizontal drag, or touch swipe.
 * - Reactive button state: left/right chevrons update immediately and accurately on scroll.
 */
export default function SongCarousel({
  title,
  subtitle,
  children,
  className = ''
}: SongCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  // Precise scroll boundary checker
  const checkScrollBounds = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;

    // If scrolled past 2px, left button MUST be active
    const newCanLeft = scrollLeft > 2;
    // If not at the right end within 2px tolerance, right button is active
    const newCanRight = scrollLeft < scrollWidth - clientWidth - 2;

    setCanScrollLeft(newCanLeft);
    setCanScrollRight(newCanRight);
  }, []);

  // Update bounds when children load, on mount, and on window resize
  useEffect(() => {
    checkScrollBounds();
    const t1 = setTimeout(checkScrollBounds, 80);
    const t2 = setTimeout(checkScrollBounds, 300);
    const t3 = setTimeout(checkScrollBounds, 800);

    window.addEventListener('resize', checkScrollBounds);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', checkScrollBounds);
    };
  }, [checkScrollBounds, children]);

  // Click-to-scroll handler with immediate optimistic state update & smooth animation polling
  const scrollByDirection = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(320, el.clientWidth * 0.75);

    // Optimistically activate left button immediately when scrolling right
    if (direction === 'right') {
      setCanScrollLeft(true);
    } else {
      if (el.scrollLeft - amount <= 2) {
        setCanScrollLeft(false);
      }
    }

    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    });

    // Verify actual positions during and after the smooth scroll completes
    setTimeout(checkScrollBounds, 60);
    setTimeout(checkScrollBounds, 150);
    setTimeout(checkScrollBounds, 300);
    setTimeout(checkScrollBounds, 500);
    setTimeout(checkScrollBounds, 750);
  };

  // Mouse Press-and-Hold Drag-to-Scroll (Horizontal only)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !scrollRef.current) return;

    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startScrollLeftRef.current = scrollRef.current.scrollLeft;
    hasMovedRef.current = false;

    const el = scrollRef.current;
    el.style.scrollBehavior = 'auto'; // Immediate 1:1 response during drag
    el.style.cursor = 'grabbing';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !scrollRef.current) return;
      const deltaX = moveEvent.clientX - startXRef.current;

      if (Math.abs(deltaX) > 6) {
        hasMovedRef.current = true;
      }

      scrollRef.current.scrollLeft = startScrollLeftRef.current - deltaX;
      checkScrollBounds();
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      if (scrollRef.current) {
        scrollRef.current.style.scrollBehavior = 'smooth';
        scrollRef.current.style.cursor = '';
        checkScrollBounds();
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Capture click events during drag to prevent accidentally triggering track play
  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasMovedRef.current = false;
    }
  };

  return (
    <section className={`space-y-3 relative group/carousel ${className}`}>
      {/* Category Header with Title and Smooth Scroll Chevrons */}
      <div className="flex items-end justify-between">
        <div className="space-y-0.5 min-w-0 pr-4">
          {subtitle && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9e9ea7] block truncate">
              {subtitle}
            </span>
          )}
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
            {title}
          </h2>
        </div>

        {/* Scroll Chevrons for desktop */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => scrollByDirection('left')}
            disabled={!canScrollLeft}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              canScrollLeft
                ? 'bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer active:scale-95 shadow-md'
                : 'bg-neutral-900/40 text-neutral-600 cursor-not-allowed opacity-50'
            }`}
            title="Scroll Left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollByDirection('right')}
            disabled={!canScrollRight}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              canScrollRight
                ? 'bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer active:scale-95 shadow-md'
                : 'bg-neutral-900/40 text-neutral-600 cursor-not-allowed opacity-50'
            }`}
            title="Scroll Right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div
        ref={scrollRef}
        onScroll={checkScrollBounds}
        onMouseDown={handleMouseDown}
        onClickCapture={handleClickCapture}
        className="flex gap-4 overflow-x-auto pb-4 pt-1 hide-scrollbar -mx-1 px-1 select-none cursor-grab"
        style={{
          scrollBehavior: 'smooth',
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {children}
      </div>
    </section>
  );
}
