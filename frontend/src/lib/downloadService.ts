import { create } from 'zustand';
import { Track, usePlayerStore } from '@/store/playerStore';
import { useAuthStore } from '@/store/authStore';

interface DownloadState {
  downloadingMap: Record<string, boolean>;
  setDownloading: (videoId: string, isDownloading: boolean) => void;
  isDownloading: (videoId: string) => boolean;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloadingMap: {},
  setDownloading: (videoId, isDownloading) =>
    set((state) => ({
      downloadingMap: {
        ...state.downloadingMap,
        [videoId]: isDownloading
      }
    })),
  isDownloading: (videoId) => Boolean(get().downloadingMap[videoId])
}));

/**
 * Sanitizes a title string into a legal, safe filesystem filename.
 * Strips invalid filesystem characters: \ / ? % * : | " < > ; and control chars.
 */
export function sanitizeFilename(name: string): string {
  if (!name) return 'song';
  return name
    .replace(/[\/\\?%*:|"<>;\r\n]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');
}

/**
 * Downloads a song audio file to the user's computer/drive with filename: `songname.extension`.
 * Persists the song into `downloadedTracks` in local storage (never in the database).
 */
export async function downloadSong(track: Track): Promise<boolean> {
  if (!track || !track.videoId) {
    return false;
  }

  const videoId = track.videoId;
  const downloadStore = useDownloadStore.getState();
  const playerStore = usePlayerStore.getState();
  const { setToast } = useAuthStore.getState();

  // Prevent multiple concurrent downloads for the same track
  if (downloadStore.isDownloading(videoId)) {
    setToast?.(`"${track.title}" is already downloading...`, 'info');
    return false;
  }

  downloadStore.setDownloading(videoId, true);
  setToast?.(`Downloading "${track.title}" to your drive...`, 'info');

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const cleanTitle = sanitizeFilename(track.title) || `song_${videoId}`;
  const downloadUrl = `${backendUrl}/api/download/${encodeURIComponent(videoId)}?filename=${encodeURIComponent(cleanTitle)}`;

  try {
    // 1. Fetch audio stream as a blob
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    // 2. Extract final filename from Content-Disposition header if provided, or fallback to cleanTitle.m4a
    let finalFilename = `${cleanTitle}.m4a`;
    const disposition = response.headers.get('Content-Disposition');
    if (disposition) {
      // Check RFC 5987 / RFC 6266 UTF-8 encoded filename
      const matchUtf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (matchUtf8) {
        try {
          finalFilename = decodeURIComponent(matchUtf8[1]);
        } catch {
          finalFilename = matchUtf8[1];
        }
      } else {
        const matchPlain = disposition.match(/filename="?([^";]+)"?/i);
        if (matchPlain) {
          finalFilename = matchPlain[1];
        }
      }
    }

    // Ensure valid audio extension
    if (!/\.(m4a|mp3|webm|wav|ogg|mp4)$/i.test(finalFilename)) {
      finalFilename = `${finalFilename}.m4a`;
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    // 3. Trigger browser file save dialog / download shelf
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up blob URL after delay
    setTimeout(() => {
      try {
        window.URL.revokeObjectURL(objectUrl);
      } catch {}
    }, 30000);

    // 4. Save track in local storage only (never saved to database)
    playerStore.addDownloadedTrack(track);

    downloadStore.setDownloading(videoId, false);
    setToast?.(`Saved "${finalFilename}" to your drive!`, 'success');
    return true;
  } catch (err: any) {
    console.warn('[downloadService] Blob fetch failed, falling back to direct anchor download:', err);
    try {
      // Fallback: Trigger direct browser download through standard anchor
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${cleanTitle}.m4a`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Save to local storage list
      playerStore.addDownloadedTrack(track);

      downloadStore.setDownloading(videoId, false);
      setToast?.(`Starting download for "${track.title}"...`, 'success');
      return true;
    } catch (fallbackErr: any) {
      console.error('[downloadService] Download completely failed:', fallbackErr);
      downloadStore.setDownloading(videoId, false);
      setToast?.(`Failed to download "${track.title}"`, 'error');
      return false;
    }
  }
}
