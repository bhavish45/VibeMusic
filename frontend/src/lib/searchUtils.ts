import { Track } from '@/store/playerStore';

export const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'in', 'on', 'of', 'to', 'by', 'for', 'with', 'feat', 'ft', 'is', 'at']);

export function matchesArtistName(query: string, artistName?: string): boolean {
  if (!query || !artistName) return false;
  const q = query.trim().toLowerCase();
  const a = artistName.trim().toLowerCase();
  if (q.length < 2 || a.length < 2) return false;

  // Exact full match
  if (q === a) return true;

  // Substring match if query is at least 3 characters and not a generic stop word
  if (q.length >= 3 && !STOP_WORDS.has(q) && a.includes(q)) return true;
  if (a.length >= 3 && q.includes(a)) return true;

  // Word-level match excluding common stop words
  const qWords = q.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  const aWords = a.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));

  for (const qw of qWords) {
    for (const aw of aWords) {
      if (qw === aw || (qw.length >= 4 && aw.includes(qw)) || (aw.length >= 4 && qw.includes(aw))) {
        return true;
      }
    }
  }

  return false;
}

export function cleanSuggestionsList(rawSuggestions: string[], query: string, quickSongList: Track[] = []): string[] {
  const cleaned: string[] = [];
  const seen = new Set<string>();

  // Collect artist names from quickSongList
  const artistsInResults = new Set<string>();
  quickSongList.forEach(s => {
    s.artists?.forEach(a => {
      const name = typeof a === 'string' ? a : a.name;
      if (name && name.length >= 2) artistsInResults.add(name);
    });
  });

  for (const sug of rawSuggestions) {
    let s = sug.trim();
    // If typed query does not match the artist, strip any artist suffix/mention
    for (const artist of artistsInResults) {
      if (!matchesArtistName(query, artist)) {
        const escaped = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\s+(?:by\\s+|-|–|—)?\\s*${escaped}$`, 'i');
        s = s.replace(regex, '').trim();
      }
    }
    const sLower = s.toLowerCase();
    if (s && !seen.has(sLower)) {
      seen.add(sLower);
      cleaned.push(s);
    }
  }

  return cleaned.slice(0, 6);
}

export function cleanString(val: any, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (typeof val.name === 'string') return val.name;
    if (Array.isArray(val)) {
      const parts = val
        .map((x: any) => (typeof x === 'string' ? x : x?.name || ''))
        .filter(Boolean);
      return parts.join(', ') || fallback;
    }
  }
  return fallback;
}
