"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { attachSmoothWheel } from "@/lib/smoothScroll";
import {
  Keyboard,
  X,
  Play,
  Volume2,
  Repeat,
  SlidersHorizontal,
  Compass,
} from "lucide-react";

interface ShortcutItem {
  keys: string[];
  label: string;
}

interface ShortcutCategory {
  title: string;
  icon: any;
  items: ShortcutItem[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "Playback & Navigation",
    icon: Play,
    items: [
      { keys: ["Space", "K"], label: "Play or pause current song" },
      { keys: ["Shift", "→"], label: "Next track in queue" },
      { keys: ["Shift", "←"], label: "Previous track in queue" },
      { keys: ["N"], label: "Skip to next track" },
      { keys: ["P"], label: "Return to previous track" },
      { keys: ["←", "→"], label: "Seek backward / forward 5s" },
      { keys: ["J"], label: "Seek backward 10s" },
    ],
  },
  {
    title: "Volume & Modes",
    icon: Volume2,
    items: [
      { keys: ["↑"], label: "Increase volume (+5%)" },
      { keys: ["↓"], label: "Decrease volume (-5%)" },
      { keys: ["M"], label: "Mute or unmute audio" },
      { keys: ["S"], label: "Toggle shuffle mode" },
      { keys: ["R"], label: "Cycle repeat (Off / All / One)" },
      { keys: ["C"], label: "Save or remove from Favorites" },
    ],
  },
  {
    title: "Views & Overlays",
    icon: SlidersHorizontal,
    items: [
      { keys: ["L"], label: "Toggle synced live lyrics" },
      { keys: ["Q"], label: "Toggle queue drawer" },
      { keys: ["F"], label: "Toggle expanded player" },
      { keys: ["/", "Ctrl + K"], label: "Focus search bar" },
      { keys: ["?"], label: "Open keyboard shortcuts" },
      { keys: ["Esc"], label: "Close active modal or blur search" },
    ],
  },
];

export default function KeyboardShortcutsModal() {
  const { isShortcutsOpen, closeShortcuts } = usePlayerStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // High-FPS Smooth Momentum Scrolling
  useEffect(() => {
    if (!isShortcutsOpen) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    return attachSmoothWheel(el);
  }, [isShortcutsOpen]);

  if (!isShortcutsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Blurred Backdrop */}
      <div
        onClick={closeShortcuts}
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-2xl bg-[#0e0e11] border border-white/10 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/5 flex items-center justify-between flex-shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00d2c4]/15 border border-[#00d2c4]/30 flex items-center justify-center text-[#00d2c4] shadow-[0_0_15px_rgba(0,210,196,0.25)]">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-neutral-400">
                Speed up playback, volume, and navigation
              </p>
            </div>
          </div>

          <button
            onClick={closeShortcuts}
            className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 hide-scrollbar"
          style={{ willChange: "scroll-position", overscrollBehavior: "contain" }}
        >
          {SHORTCUT_CATEGORIES.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div key={idx} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400 px-1">
                  <Icon className="w-3.5 h-3.5 text-[#00d2c4]" />
                  <span>{cat.title}</span>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-2 sm:p-2.5 divide-y divide-white/[0.03]">
                  {cat.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-2.5 sm:px-3 text-sm"
                    >
                      <span className="text-neutral-300 text-xs sm:text-sm">
                        {item.label}
                      </span>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {item.keys.map((k, ki) => (
                          <kbd
                            key={ki}
                            className="px-2 py-1 text-[11px] sm:text-xs font-mono font-medium bg-[#1d1d23] text-neutral-200 border border-white/10 rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.5)] min-w-[24px] text-center"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/5 bg-black/40 flex items-center justify-between text-xs text-neutral-500 flex-shrink-0">
          <span className="text-neutral-400 hidden sm:inline">
            Press <kbd className="px-1.5 py-0.5 font-mono text-[11px] bg-white/10 text-neutral-300 rounded border border-white/10">?</kbd> anywhere to toggle
          </span>
          <span className="text-neutral-500 sm:hidden">Changes saved automatically</span>

          <div className="flex items-center gap-3">
            <span className="text-neutral-500 hidden sm:inline">Press Esc to close</span>
            <button
              onClick={closeShortcuts}
              className="px-4 py-1.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
