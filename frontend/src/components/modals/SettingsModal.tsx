"use client";

import { useEffect, useState, useRef } from 'react';
import { 
  ChevronLeft,
  Volume2, 
  Sparkles, 
  Check, 
  RotateCcw, 
  Wifi,
  Radio,
  FileText,
  Languages,
  Keyboard,
  Sliders,
  SlidersHorizontal
} from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore, AppSettings } from '@/store/settingsStore';
import { attachSmoothWheel } from '@/lib/smoothScroll';
import { EqualizerControl } from '@/components/player/EqualizerControl';

export default function SettingsModal() {
  const { isSettingsOpen, closeSettings, openShortcuts } = usePlayerStore();
  const {
    audioQuality,
    audioNormalization,
    autoplay,
    crossfade,
    dynamicTheming,
    autoScrollLyrics,
    preferEnglishLyrics,
    updateSetting,
    resetSettings
  } = useSettingsStore();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        if (showResetConfirm) {
          setShowResetConfirm(false);
        } else {
          closeSettings();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, showResetConfirm, closeSettings]);

  // Butter-Smooth High-FPS Hardware-Accelerated Momentum Scrolling
  useEffect(() => {
    if (!isSettingsOpen || !scrollContainerRef.current) return;
    const cleanup = attachSmoothWheel(scrollContainerRef.current);
    return cleanup;
  }, [isSettingsOpen]);

  if (!isSettingsOpen) return null;

  const handleResetSettings = () => {
    setShowResetConfirm(true);
  };

  const handleConfirmReset = () => {
    resetSettings();
    setShowResetConfirm(false);
    useAuthStore.getState().setToast('Settings restored to defaults.', 'info');
  };

  return (
    <div 
      className="fixed inset-0 z-[95] bg-black text-white flex flex-col select-none overflow-hidden animate-in fade-in duration-150"
      aria-modal="true"
      role="dialog"
    >
      {/* Top Header Bar: Clean < Settings back navigation */}
      <header className="sticky top-0 z-30 bg-black/95 border-b border-white/10 px-4 sm:px-8 py-4 flex items-center justify-between">
        <button
          onClick={closeSettings}
          className="flex items-center gap-2.5 text-white hover:text-neutral-300 transition-colors cursor-pointer group"
          title="Back to music"
          aria-label="Back to music"
        >
          <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Settings</h1>
        </button>
      </header>

      {/* Full-Screen Scrollable Settings Content Body */}
      <div 
        ref={scrollContainerRef}
        style={{
          overscrollBehavior: 'contain',
          willChange: 'scroll-position',
          WebkitOverflowScrolling: 'touch'
        }}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 hide-scrollbar"
      >
        <div className="max-w-4xl mx-auto space-y-10 pb-24">
          
          {/* SECTION 1: AUDIO & PLAYBACK */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Audio & Playback
            </h2>

            {/* Streaming Quality */}
            <div className="py-4 border-b border-white/5 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-teal-400" />
                  <h3 className="text-sm sm:text-base font-semibold text-white">Audio Streaming Quality</h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Select your default streaming bitrate for audio playback
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {[
                  { key: 'high', label: 'High (320kbps)', desc: 'Best clarity & dynamic range' },
                  { key: 'standard', label: 'Standard (160kbps)', desc: 'Balanced fidelity & speed' },
                  { key: 'saver', label: 'Data Saver (96kbps)', desc: 'Lower data & instant buffer' },
                ].map((opt) => {
                  const isSelected = audioQuality === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => updateSetting('audioQuality', opt.key as AppSettings['audioQuality'])}
                      className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-teal-500/10 border-teal-500/50 shadow-sm'
                          : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${isSelected ? 'text-teal-300' : 'text-white'}`}>
                          {opt.label}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-teal-400" />}
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-tight">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Audio Normalization */}
            <div className="flex items-start sm:items-center justify-between gap-4 py-4 border-b border-white/5">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-teal-400" />
                  <h3 className="text-sm sm:text-base font-semibold text-white">Audio Normalization</h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Maintain uniform loudness across different tracks and avoid sudden volume spikes
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={audioNormalization}
                onClick={() => updateSetting('audioNormalization', !audioNormalization)}
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 mt-1 sm:mt-0 ${
                  audioNormalization ? 'bg-teal-400 justify-end' : 'bg-neutral-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
              </button>
            </div>

            {/* Continuous Autoplay */}
            <div className="flex items-start sm:items-center justify-between gap-4 py-4 border-b border-white/5">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-teal-400" />
                  <h3 className="text-sm sm:text-base font-semibold text-white">Continuous Autoplay</h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Automatically queue similar songs when your current playlist or queue ends
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoplay}
                onClick={() => updateSetting('autoplay', !autoplay)}
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 mt-1 sm:mt-0 ${
                  autoplay ? 'bg-teal-400 justify-end' : 'bg-neutral-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
              </button>
            </div>

            {/* Crossfade Duration */}
            <div className="py-4 border-b border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-teal-400" />
                    <h3 className="text-sm sm:text-base font-semibold text-white">Crossfade Duration</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-400">
                    Seamlessly overlap the end of current song and beginning of next song
                  </p>
                </div>
                <span className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-md transition-colors ${
                  crossfade > 0 ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm shadow-teal-500/10' : 'bg-white/10 text-neutral-400'
                }`}>
                  {crossfade === 0 ? 'Off (0s)' : `${crossfade}s Active`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1 max-w-md">
                {[0, 3, 5, 8].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => updateSetting('crossfade', sec)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      crossfade === sec
                        ? 'bg-teal-500/20 border-teal-500/60 text-teal-300 shadow-sm shadow-teal-500/10 font-semibold'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {sec === 0 ? 'Off' : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 2: EQUALIZER */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Graphic Equalizer
            </h2>
            <EqualizerControl />
          </section>

          {/* SECTION 3: LYRICS & INTERFACE */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Lyrics & Interface
            </h2>

            {/* Auto-scroll Synced Lyrics */}
            <div className="flex items-start sm:items-center justify-between gap-4 py-4 border-b border-white/5">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm sm:text-base font-semibold text-white">Auto-scroll Synced Lyrics</h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Automatically follow and center the current active line in fullscreen and mini lyrics views
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoScrollLyrics}
                onClick={() => updateSetting('autoScrollLyrics', !autoScrollLyrics)}
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 mt-1 sm:mt-0 ${
                  autoScrollLyrics ? 'bg-teal-400 justify-end' : 'bg-neutral-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
              </button>
            </div>

            {/* English Lyrics from Provider */}
            <div className="flex items-start sm:items-center justify-between gap-4 py-4 border-b border-white/5">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm sm:text-base font-semibold text-white">Romanize Lyrics (English Letters)</h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Convert non-English song lyrics (Hindi, Korean, Japanese, Chinese, etc.) into English letters while preserving real-time audio sync
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferEnglishLyrics}
                onClick={() => updateSetting('preferEnglishLyrics', !preferEnglishLyrics)}
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 mt-1 sm:mt-0 ${
                  preferEnglishLyrics ? 'bg-teal-400 justify-end' : 'bg-neutral-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
              </button>
            </div>

            {/* Dynamic Artwork Tinting */}
            <div className="flex items-start sm:items-center justify-between gap-4 py-4 border-b border-white/5">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm sm:text-base font-semibold text-white">Dynamic Artwork Tinting</h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Adapt player UI glow subtly according to the album artwork of the currently playing track
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={dynamicTheming}
                onClick={() => updateSetting('dynamicTheming', !dynamicTheming)}
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 mt-1 sm:mt-0 ${
                  dynamicTheming ? 'bg-teal-400 justify-end' : 'bg-neutral-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
              </button>
            </div>
          </section>

          {/* SECTION 4: SYSTEM & SHORTCUTS */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
              System & Shortcuts
            </h2>

            {/* Keyboard Shortcuts */}
            <div className="flex items-center justify-between gap-4 py-4 border-b border-white/5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-teal-400" />
                  <h3 className="text-sm sm:text-base font-semibold text-white">Keyboard Shortcuts</h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400">View and learn all media and navigation keys</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeSettings();
                  openShortcuts();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-[0_0_12px_rgba(0,210,196,0.15)] shrink-0"
              >
                <Keyboard className="w-4 h-4" />
                <span>View Keys (?)</span>
              </button>
            </div>

            {/* Reset Preferences */}
            <div className="flex items-center justify-between gap-4 py-4 border-b border-white/5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-neutral-400" />
                  <h3 className="text-sm sm:text-base font-semibold text-white">Reset Preferences</h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400">Restore default audio and visual settings</p>
              </div>
              <button
                onClick={handleResetSettings}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restore Defaults</span>
              </button>
            </div>
          </section>

        </div>
      </div>

      {/* Restore Defaults Confirmation Popup Modal */}
      {showResetConfirm && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setShowResetConfirm(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#121214] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="space-y-2">
              <h4 className="text-base font-bold text-white tracking-tight">Restore Default Settings?</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                This will reset all your audio quality, crossfade, normalization, and equalizer preferences to standard defaults.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all cursor-pointer"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
