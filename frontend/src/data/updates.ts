export interface UpdateFeature {
  icon?: 'music' | 'search' | 'mic' | 'download' | 'sparkles' | 'sliders' | 'cloud' | 'shield' | 'radio';
  title: string;
  description: string;
}

export interface UpdateCategory {
  category: string;
  icon?: 'music' | 'search' | 'mic' | 'download' | 'sparkles' | 'sliders' | 'cloud' | 'shield' | 'radio';
  items: string[];
}

export interface PatchUpdate {
  version: string;
  releaseDate?: string;
  isLatest?: boolean;
  type: 'major' | 'minor' | 'patch';
  badge?: string;
  title: string;
  description: string;
  features?: UpdateFeature[];
  categories?: UpdateCategory[];
}

export const CURRENT_VERSION = "1.0.0";

/**
 * VibeMusic Release Notes
 * Designed for listeners with clean, concise, user-focused highlights in a single unified section.
 */
export const UPDATES_HISTORY: PatchUpdate[] = [
  {
    version: "1.0.0",
    releaseDate: "October 24, 2026",
    isLatest: true,
    type: "major",
    badge: "Official Release",
    title: "Welcome to VibeMusic",
    description: "Stream millions of songs with crystal-clear audio, live synced lyrics, and personalized playlists.",
    features: [
      {
        icon: "music",
        title: "High-Fidelity Audio",
        description: "Instant playback with High (320kbps), Standard, and Data Saver audio quality options."
      },
      {
        icon: "mic",
        title: "Live Synced Lyrics",
        description: "Follow along real-time word-by-word synchronized lyrics with full-screen ambient view."
      },
      {
        icon: "sparkles",
        title: "Spotify Playlist Import",
        description: "Paste any Spotify playlist link to instantly bring your favorite tracklists and album art."
      },
      {
        icon: "download",
        title: "Offline Downloads",
        description: "Download your favorite tracks directly to your device for non-stop listening on the go."
      },
      {
        icon: "cloud",
        title: "Cloud Library Sync",
        description: "Safely sync your favorites, playlists, and followed artists across all your devices."
      },
      {
        icon: "radio",
        title: "Endless Smart Radio",
        description: "Continuous auto-generated music queues and recommendations tuned to your unique vibe."
      }
    ]
  }
];
