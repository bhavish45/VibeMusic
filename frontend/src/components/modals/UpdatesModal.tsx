"use client";

import { useEffect, useRef } from 'react';
import { 
  X, 
  Bell, 
  Sparkles, 
  Check, 
  Calendar, 
  Tag, 
  Music, 
  Mic2, 
  Search, 
  Download, 
  Sliders, 
  Cloud, 
  ShieldCheck,
  Rocket,
  Radio
} from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { UPDATES_HISTORY, CURRENT_VERSION, PatchUpdate } from '@/data/updates';
import { attachSmoothWheel } from '@/lib/smoothScroll';

export default function UpdatesModal() {
  const isUpdatesOpen = usePlayerStore(s => s.isUpdatesOpen);
  const closeUpdates = usePlayerStore(s => s.closeUpdates);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isUpdatesOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeUpdates();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUpdatesOpen, closeUpdates]);

  // Butter-smooth hardware-accelerated kinetic wheel scroll
  useEffect(() => {
    if (!isUpdatesOpen || !scrollContainerRef.current) return;
    return attachSmoothWheel(scrollContainerRef.current);
  }, [isUpdatesOpen]);

  // Mark latest version as seen in localStorage
  useEffect(() => {
    if (isUpdatesOpen) {
      try {
        localStorage.setItem('vibemusic_seen_update_version', CURRENT_VERSION);
      } catch (e) {
        // ignore localStorage failures
      }
    }
  }, [isUpdatesOpen]);

  if (!isUpdatesOpen) return null;

  const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
      case 'music':
        return <Music className="w-4 h-4 text-teal-400" />;
      case 'mic':
        return <Mic2 className="w-4 h-4 text-purple-400" />;
      case 'sparkles':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'search':
        return <Search className="w-4 h-4 text-blue-400" />;
      case 'download':
        return <Download className="w-4 h-4 text-emerald-400" />;
      case 'sliders':
        return <Sliders className="w-4 h-4 text-pink-400" />;
      case 'cloud':
        return <Cloud className="w-4 h-4 text-cyan-400" />;
      case 'shield':
        return <ShieldCheck className="w-4 h-4 text-teal-400" />;
      case 'radio':
        return <Radio className="w-4 h-4 text-sky-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-teal-400" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={closeUpdates}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[82vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
              <Bell className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  What's New
                </h2>
                <span className="text-[11px] font-semibold bg-white/10 text-neutral-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Rocket className="w-3 h-3 text-teal-400" />
                  v{CURRENT_VERSION}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Latest features and patch updates
              </p>
            </div>
          </div>

          <button
            onClick={closeUpdates}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer ml-1"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Updates Body with Butter-Smooth Hardware-Accelerated Scrolling */}
        <div 
          ref={scrollContainerRef}
          style={{
            overscrollBehavior: 'contain',
            willChange: 'scroll-position',
            WebkitOverflowScrolling: 'touch'
          }}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 hide-scrollbar"
        >
          {UPDATES_HISTORY.map((update: PatchUpdate, idx: number) => (
            <div 
              key={`update-${update.version}-${idx}`} 
              style={{
                contain: 'paint',
                contentVisibility: 'auto',
                containIntrinsicSize: '120px'
              }}
              className="space-y-3"
            >
              {/* Release Header Card - Unified single section */}
              <div className="p-4 sm:p-5 rounded-xl bg-white/[0.03] border border-white/5 space-y-3.5 relative overflow-hidden hover:border-white/10 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                      v{update.version}
                    </span>
                    {update.badge && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-neutral-300 border border-white/10">
                        <Tag className="w-3 h-3 text-teal-400" />
                        {update.badge}
                      </span>
                    )}
                    {update.isLatest && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        <Sparkles className="w-3 h-3 text-teal-400" />
                        Latest Release
                      </span>
                    )}
                  </div>

                  {/* Release Date */}
                  <div className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    <span className="font-medium text-neutral-300">{update.releaseDate || 'October 2026'}</span>
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {update.title}
                </h3>

                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  {update.description}
                </p>

                {/* Single Section Features List */}
                {update.features && update.features.length > 0 && (
                  <div className="pt-3.5 border-t border-white/5 space-y-2">
                    {update.features.map((feat, fIdx) => (
                      <div 
                        key={`feat-${fIdx}`}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                          {getCategoryIcon(feat.icon)}
                        </div>
                        <p className="text-xs text-neutral-300 leading-snug">
                          <strong className="text-white font-semibold mr-1.5">{feat.title}:</strong>
                          {feat.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Categorized Updates Breakdown (fallback only) */}
              {(!update.features || update.features.length === 0) && update.categories && (
                <div className="space-y-2">
                  {update.categories.map((cat, catIdx) => (
                    <div 
                      key={`cat-${catIdx}`}
                      style={{
                        contain: 'paint',
                        contentVisibility: 'auto',
                        containIntrinsicSize: '80px'
                      }}
                      className="p-3.5 sm:p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                        {getCategoryIcon(cat.icon)}
                        <span>{cat.category}</span>
                      </div>

                      <ul className="space-y-2 pl-1">
                        {cat.items.map((item, itemIdx) => (
                          <li key={`item-${itemIdx}`} className="flex items-start gap-2.5 text-xs text-neutral-300 leading-relaxed">
                            <span className="w-4 h-4 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                            <span className="flex-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-white/5 bg-black/30 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-neutral-400">VibeMusic is up to date (v{CURRENT_VERSION})</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-neutral-500">Press Esc to close</span>
            <button
              type="button"
              onClick={closeUpdates}
              className="px-3.5 py-1.5 rounded-full bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
