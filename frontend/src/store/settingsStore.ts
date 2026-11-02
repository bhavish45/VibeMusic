import { create } from 'zustand';

export interface EqualizerBands {
  60: number;
  230: number;
  910: number;
  3600: number;
  14000: number;
}

export type EqualizerPresetKey =
  | 'flat'
  | 'bass_boost'
  | 'hip_hop'
  | 'pop'
  | 'rock'
  | 'electronic'
  | 'vocal_clarity'
  | 'classical'
  | 'custom';

export interface EqualizerPresetInfo {
  name: string;
  description: string;
  bands: EqualizerBands;
}

export const EQUALIZER_PRESETS: Record<Exclude<EqualizerPresetKey, 'custom'>, EqualizerPresetInfo> = {
  flat: {
    name: 'Flat',
    description: 'Neutral reference sound — zero acoustic coloration',
    bands: { 60: 0, 230: 0, 910: 0, 3600: 0, 14000: 0 },
  },
  bass_boost: {
    name: 'Bass Boost',
    description: 'Heavy sub-bass thump & warm kick drum presence',
    bands: { 60: 6, 230: 3, 910: 0, 3600: 0, 14000: 1 },
  },
  hip_hop: {
    name: 'Hip-Hop',
    description: 'Deep 808 sub-rumble, tight snares & crisp hi-hats',
    bands: { 60: 5, 230: 2, 910: 0, 3600: 1.5, 14000: 3 },
  },
  pop: {
    name: 'Pop',
    description: 'Modern energetic V-shape with bright vocal sparkle',
    bands: { 60: 3, 230: 1.5, 910: -1, 3600: 2.5, 14000: 3.5 },
  },
  rock: {
    name: 'Rock',
    description: 'Punchy kick, guitar crunch bite & scooped boxy mids',
    bands: { 60: 4, 230: -1, 910: -2, 3600: 3.5, 14000: 2.5 },
  },
  electronic: {
    name: 'Electronic',
    description: 'Sub-bass drop impact, punchy transients & shimmer',
    bands: { 60: 6, 230: 2.5, 910: 0, 3600: 2, 14000: 4 },
  },
  vocal_clarity: {
    name: 'Vocal Clarity',
    description: 'Tamed low-end rumble with elevated dialogue presence',
    bands: { 60: -3, 230: -1.5, 910: 3, 3600: 4.5, 14000: 1 },
  },
  classical: {
    name: 'Classical',
    description: 'Natural acoustic warmth & concert hall spatial air',
    bands: { 60: 1.5, 230: 0, 910: 0, 3600: 1.5, 14000: 2.5 },
  },
};

export const DEFAULT_EQ_BANDS: EqualizerBands = {
  60: 0,
  230: 0,
  910: 0,
  3600: 0,
  14000: 0,
};

export interface AppSettings {
  audioQuality: 'high' | 'standard' | 'saver';
  audioNormalization: boolean;
  autoplay: boolean;
  crossfade: number; // in seconds: 0, 3, 5, 8
  dynamicTheming: boolean;
  autoScrollLyrics: boolean;
  preferEnglishLyrics: boolean;
  equalizerEnabled: boolean;
  equalizerPreset: EqualizerPresetKey;
  equalizerBands: EqualizerBands;
}

interface SettingsState extends AppSettings {
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setEqualizerEnabled: (enabled: boolean) => void;
  setEqualizerPreset: (preset: EqualizerPresetKey) => void;
  setEqualizerBand: (freq: keyof EqualizerBands, gain: number) => void;
  resetEqualizer: () => void;
  resetSettings: () => void;
  initSettings: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  audioQuality: 'high',
  audioNormalization: true,
  autoplay: true,
  crossfade: 0,
  dynamicTheming: true,
  autoScrollLyrics: true,
  preferEnglishLyrics: false,
  equalizerEnabled: false,
  equalizerPreset: 'flat',
  equalizerBands: { ...DEFAULT_EQ_BANDS },
};

const STORAGE_KEY = 'vibemusic_settings_v1';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,

  initSettings: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          ...DEFAULT_SETTINGS,
          ...parsed,
          equalizerBands: {
            ...DEFAULT_EQ_BANDS,
            ...(parsed.equalizerBands || {}),
          },
        });
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage:', e);
    }
  },

  updateSetting: (key, value) => {
    set({ [key]: value });
    if (typeof window !== 'undefined') {
      try {
        const current = get();
        const settingsToSave: AppSettings = {
          audioQuality: current.audioQuality,
          audioNormalization: current.audioNormalization,
          autoplay: current.autoplay,
          crossfade: current.crossfade,
          dynamicTheming: current.dynamicTheming,
          autoScrollLyrics: current.autoScrollLyrics,
          preferEnglishLyrics: current.preferEnglishLyrics,
          equalizerEnabled: current.equalizerEnabled,
          equalizerPreset: current.equalizerPreset,
          equalizerBands: current.equalizerBands,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
      } catch (e) {
        console.warn('Failed to save settings to localStorage:', e);
      }
    }
  },

  setEqualizerEnabled: (enabled: boolean) => {
    get().updateSetting('equalizerEnabled', enabled);
  },

  setEqualizerPreset: (preset: EqualizerPresetKey) => {
    if (preset === 'custom') {
      get().updateSetting('equalizerPreset', 'custom');
      return;
    }
    const presetInfo = EQUALIZER_PRESETS[preset];
    if (presetInfo) {
      set({
        equalizerPreset: preset,
        equalizerBands: { ...presetInfo.bands },
      });
      if (typeof window !== 'undefined') {
        try {
          const current = get();
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            audioQuality: current.audioQuality,
            audioNormalization: current.audioNormalization,
            autoplay: current.autoplay,
            crossfade: current.crossfade,
            dynamicTheming: current.dynamicTheming,
            autoScrollLyrics: current.autoScrollLyrics,
            preferEnglishLyrics: current.preferEnglishLyrics,
            equalizerEnabled: current.equalizerEnabled,
            equalizerPreset: preset,
            equalizerBands: presetInfo.bands,
          }));
        } catch (e) {
          console.warn('Failed to save EQ preset:', e);
        }
      }
    }
  },

  setEqualizerBand: (freq: keyof EqualizerBands, gain: number) => {
    const clampedGain = Math.max(-12, Math.min(12, Math.round(gain * 2) / 2)); // snap to 0.5dB
    const currentBands = { ...get().equalizerBands, [freq]: clampedGain };
    
    // Check if current bands match any preset
    let matchingPreset: EqualizerPresetKey = 'custom';
    for (const [key, preset] of Object.entries(EQUALIZER_PRESETS) as [Exclude<EqualizerPresetKey, 'custom'>, EqualizerPresetInfo][]) {
      const match = (Object.keys(DEFAULT_EQ_BANDS) as unknown as (keyof EqualizerBands)[]).every(
        (f) => currentBands[f] === preset.bands[f]
      );
      if (match) {
        matchingPreset = key;
        break;
      }
    }

    set({
      equalizerBands: currentBands,
      equalizerPreset: matchingPreset,
    });

    if (typeof window !== 'undefined') {
      try {
        const current = get();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          audioQuality: current.audioQuality,
          audioNormalization: current.audioNormalization,
          autoplay: current.autoplay,
          crossfade: current.crossfade,
          dynamicTheming: current.dynamicTheming,
          autoScrollLyrics: current.autoScrollLyrics,
          preferEnglishLyrics: current.preferEnglishLyrics,
          equalizerEnabled: current.equalizerEnabled,
          equalizerPreset: matchingPreset,
          equalizerBands: currentBands,
        }));
      } catch (e) {
        console.warn('Failed to save EQ band:', e);
      }
    }
  },

  resetEqualizer: () => {
    get().setEqualizerPreset('flat');
  },

  resetSettings: () => {
    set({ ...DEFAULT_SETTINGS });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      } catch (e) {
        console.warn('Failed to reset settings in localStorage:', e);
      }
    }
  }
}));
