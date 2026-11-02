export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsResult {
  lines: LyricLine[];
  source: string;
}

// In-memory cache by videoId and preference
const lyricsCache = new Map<string, LyricsResult>();

const LRCLIB_HEADERS = {
  'User-Agent': 'VibeMusic/1.0 (https://github.com/bhavin/vibemusic)'
};

// Regex for non-Latin writing systems (CJK, Hangul, Cyrillic, Devanagari, Bengali, Tamil, Telugu, Arabic, Hebrew, Thai, Greek, etc.)
// Matches any Unicode letter character that does NOT belong to the Latin script.
export const NON_LATIN_REGEX = /[^\P{L}\p{Script=Latin}]/u;

export function hasNonLatinScript(text: string): boolean {
  if (!text) return false;
  return NON_LATIN_REGEX.test(text);
}

/**
 * Strips phonetic diacritical marks and macrons (e.g. ō -> o, ā -> a, ī -> i, ū -> u, ē -> e, ś -> s, ḍ -> d, ` -> ')
 * to produce clean, natural standard English alphabet letters (A-Z, a-z) without pronunciation styling.
 */
export function cleanRomanizedText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove all combining diacritical marks (macrons, accents, dots)
    .replace(/[`´‘’‛]/g, "'") // convert backticks and curly apostrophes to standard apostrophe
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Clean song title for lyrics search (strip extra tags like "(Official Video)", "[MV]", soundtrack notes, etc.)
export function cleanTrackTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/(\(\s*|\[)(official\s*(music\s*)?video|video|audio|lyric\s*(video)?|visualizer|hq|4k|hd|mv|m\/v|remastered|lyrics)(\s*\)|\])/gi, '')
    .replace(/(\(\s*|\[)(slowed\s*\+?\s*reverb|sped\s*up|nightcore|remix|acoustic\s*version|live\s*version|prod\..*?)(\s*\)|\])/gi, '')
    .replace(/(\(\s*|\[)(from\s*["'].*?["']|from\s*.*?|ost|original\s*soundtrack)(\s*\)|\])/gi, '')
    .replace(/(\(\s*|\[)(feat\.|ft\.|with\s).*?(\s*\)|\])/gi, '')
    .replace(/[「」『』]/g, '')
    .replace(/\|.*$/g, '')
    .replace(/\s*-\s*(official|lyric|audio|video).*$/gi, '')
    .trim();
}

// Parse standard and non-standard LRC timestamp lines, supporting [offset:+/-###], multiple timestamps, and various millisecond separators
export function parseLRC(lrcText: string): LyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];

  // Parse global offset tag if present [offset:+/-###] (in milliseconds)
  let offsetSec = 0;
  const offsetMatch = lrcText.match(/\[offset:\s*([+-]?\d+)\]/i);
  if (offsetMatch && offsetMatch[1]) {
    offsetSec = parseInt(offsetMatch[1], 10) / 1000;
  }

  const timeRegex = /\[(\d{1,3}):(\d{2})(?:[.:,](\d{2,3}))?\]/g;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip metadata headers like [ar:Singer], [ti:Title], [al:Album], [length:03:45]
    if (/^\[(ar|ti|al|by|length|re|ve):/i.test(line)) continue;

    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    timeRegex.lastIndex = 0;

    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millisStr = match[3] || '0';
      const millis = parseInt(millisStr.padEnd(3, '0').slice(0, 3), 10) / 1000;
      const totalTime = Math.max(0, minutes * 60 + seconds + millis + offsetSec);
      timestamps.push(Number(totalTime.toFixed(2)));
    }

    if (timestamps.length > 0) {
      // Remove timestamps to retrieve the lyric text
      const text = line.replace(timeRegex, '').trim();
      if (text) {
        for (const time of timestamps) {
          result.push({ time, text });
        }
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

// Convert plain text into synced lines across track duration
function parsePlainLyrics(plain: string, duration: number = 180): LyricLine[] {
  const sectionHeaderRegex = /^\[(verse|chorus|bridge|outro|intro|hook|refrain|pre-chorus|breakdown|interlude|solo)/i;
  const lines = plain
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !sectionHeaderRegex.test(l));
  
  if (lines.length === 0) return [];
  const introDelay = Math.min(10, duration * 0.07);
  const vocalDuration = Math.max(10, duration - introDelay - 5);
  const step = vocalDuration / Math.max(1, lines.length);

  return lines.map((text, i) => ({
    time: Number((introDelay + i * step).toFixed(2)),
    text
  }));
}

export function alignLinesToTimestamps(
  rawLines: (string | LyricLine)[],
  baseSyncedLines: LyricLine[],
  trackDuration: number = 180
): LyricLine[] {
  const cleanTexts: string[] = rawLines
    .map(l => (typeof l === 'string' ? l : l.text).trim())
    .filter(t => t.length > 0 && !/^\[(verse|chorus|bridge|outro|intro|hook|refrain)/i.test(t));

  if (cleanTexts.length === 0) return [];

  if (baseSyncedLines && baseSyncedLines.length > 0) {
    const M = baseSyncedLines.length;
    const N = cleanTexts.length;

    if (N === M) {
      return cleanTexts.map((text, i) => ({
        time: baseSyncedLines[i].time,
        text
      }));
    }

    return cleanTexts.map((text, i) => {
      const ratio = N > 1 ? i / (N - 1) : 0;
      const baseIdx = ratio * (M - 1);
      const floorIdx = Math.floor(baseIdx);
      const ceilIdx = Math.min(M - 1, Math.ceil(baseIdx));
      const frac = baseIdx - floorIdx;
      const time = baseSyncedLines[floorIdx].time + frac * (baseSyncedLines[ceilIdx].time - baseSyncedLines[floorIdx].time);
      return {
        time: Number(time.toFixed(2)),
        text
      };
    });
  }

  return parsePlainLyrics(cleanTexts.join('\n'), trackDuration);
}

function normalizeText(text: string): string {
  return (text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isMatchingTitle(rawTitle: string, candidateTitle: string): boolean {
  const norm1 = normalizeText(cleanTrackTitle(rawTitle));
  const norm2 = normalizeText(candidateTitle);
  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;
  
  const words1 = norm1.split(' ').filter(w => w.length > 1);
  const words2 = norm2.split(' ').filter(w => w.length > 1);
  if (words1.length === 0 || words2.length === 0) return false;

  const common = words1.filter(w => words2.includes(w)).length;
  const ratio1 = common / words1.length;
  const ratio2 = common / words2.length;
  return ratio1 >= 0.5 || ratio2 >= 0.5 || norm1.includes(norm2) || norm2.includes(norm1);
}

function isMatchingArtist(rawArtist: string, candidateArtist: string): boolean {
  const norm1 = normalizeText(rawArtist);
  const norm2 = normalizeText(candidateArtist);
  if (!norm1 || !norm2) return true;
  if (norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1)) return true;

  const words1 = norm1.split(' ').filter(w => w.length > 2);
  const words2 = norm2.split(' ').filter(w => w.length > 2);
  return words1.some(w => words2.includes(w));
}

export function isNonEnglishText(text: string): boolean {
  if (!text || text.length < 5) return false;
  return hasNonLatinScript(text);
}

export function isEnglishLyricsText(text: string): boolean {
  if (!text || text.length < 10) return false;
  return !hasNonLatinScript(text);
}

/**
 * Transliterates (romanizes) non-Latin lyrics into clean standard English letters (Latin alphabet)
 * preserving 100% exact 1:1 timestamps and line count, with diacritics and macrons removed.
 */
export async function romanizeToEnglishLetters(
  baseLines: LyricLine[],
  signal?: AbortSignal
): Promise<LyricLine[] | null> {
  if (!baseLines || baseLines.length === 0) return null;

  const hasAnyNonLatin = baseLines.some(l => hasNonLatinScript(l.text));
  if (!hasAnyNonLatin) {
    return baseLines;
  }

  try {
    const DELIM = ' [|] ';
    const CHUNK_SIZE = 25;
    const romanizedTexts: string[] = [];

    for (let i = 0; i < baseLines.length; i += CHUNK_SIZE) {
      if (signal?.aborted) return null;

      const chunk = baseLines.slice(i, i + CHUNK_SIZE);
      const chunkNeedsRomanize = chunk.some(l => hasNonLatinScript(l.text));

      if (!chunkNeedsRomanize) {
        romanizedTexts.push(...chunk.map(l => l.text));
        continue;
      }

      // Safe placeholder for empty lines to maintain 1:1 delimiter splitting
      const placeholder = '___BLANK___';
      const chunkPrepared = chunk.map(l => {
        const trimmed = l.text.trim();
        return trimmed.length === 0 ? placeholder : trimmed;
      });

      const body = new URLSearchParams();
      body.append('client', 'gtx');
      body.append('sl', 'auto');
      body.append('tl', 'en');
      body.append('dt', 'rm');
      body.append('q', chunkPrepared.join(DELIM));

      const timeoutCtrl = new AbortController();
      const timer = setTimeout(() => timeoutCtrl.abort(), 6000);
      const onAbort = () => timeoutCtrl.abort();
      if (signal) signal.addEventListener('abort', onAbort);

      try {
        const res = await fetch('https://translate.googleapis.com/translate_a/single', {
          method: 'POST',
          body,
          signal: timeoutCtrl.signal
        }).finally(() => {
          clearTimeout(timer);
          if (signal) signal.removeEventListener('abort', onAbort);
        });

        if (!res.ok) {
          romanizedTexts.push(...chunk.map(l => l.text));
          continue;
        }

        const data = await res.json();
        let combined = '';
        if (Array.isArray(data[0])) {
          for (const c of data[0]) {
            if (c && c[3]) combined += c[3];
          }
        }

        const parts = combined.split(/\[\s*\|\s*\]/).map(s => s.trim());

        if (parts.length === chunk.length) {
          for (let j = 0; j < chunk.length; j++) {
            const part = parts[j];
            if (
              chunk[j].text.trim() === '' || 
              part === placeholder || 
              part.toLowerCase() === '___blank___'
            ) {
              romanizedTexts.push('');
            } else if (part) {
              romanizedTexts.push(cleanRomanizedText(part));
            } else {
              romanizedTexts.push(chunk[j].text);
            }
          }
        } else {
          // Fallback: transliterate line-by-line for this chunk to guarantee 100% 1:1 preservation
          const fallbackChunk = await Promise.all(
            chunk.map(async line => {
              if (!hasNonLatinScript(line.text)) return line.text;
              try {
                const singleBody = new URLSearchParams();
                singleBody.append('client', 'gtx');
                singleBody.append('sl', 'auto');
                singleBody.append('tl', 'en');
                singleBody.append('dt', 'rm');
                singleBody.append('q', line.text);
                const sRes = await fetch('https://translate.googleapis.com/translate_a/single', {
                  method: 'POST',
                  body: singleBody,
                  signal: timeoutCtrl.signal
                });
                if (!sRes.ok) return line.text;
                const sData = await sRes.json();
                if (Array.isArray(sData[0])) {
                  let sRom = '';
                  for (const sc of sData[0]) {
                    if (sc && sc[3]) sRom += sc[3];
                  }
                  if (sRom.trim()) return cleanRomanizedText(sRom.trim());
                }
              } catch {}
              return line.text;
            })
          );
          romanizedTexts.push(...fallbackChunk);
        }
      } catch {
        romanizedTexts.push(...chunk.map(l => l.text));
      }
    }

    if (romanizedTexts.length === baseLines.length) {
      return baseLines.map((line, idx) => ({
        time: line.time,
        text: romanizedTexts[idx] || line.text
      }));
    }
  } catch {
    // Graceful fallback
  }

  return baseLines;
}

/**
 * Fetch lyrics for a track with multi-tier fallback:
 * 1. Memory Cache (differentiated by original vs English-letter preference)
 * 2. If preferEnglish is toggled and original is already in memory, convert immediately!
 * 3. LRCLIB exact match (/api/get)
 * 4. LRCLIB search query (/api/search)
 * 5. Backend YouTube Music lyrics (/api/lyrics/{videoId})
 * 6. Romanization preserves 100% of line count and exact audio timestamps.
 */
export async function fetchLyricsForTrack(
  videoId: string,
  rawTitle: string,
  rawArtist: string,
  duration?: number,
  signal?: AbortSignal,
  preferEnglish: boolean = false
): Promise<LyricsResult> {
  const cacheKey = preferEnglish ? `${videoId}:en` : `${videoId}:orig`;

  // 1. Check in-memory cache for exact preference
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey)!;
  }

  // 2. Instant Romanization if base is already cached in memory
  if (preferEnglish && lyricsCache.has(`${videoId}:orig`)) {
    const orig = lyricsCache.get(`${videoId}:orig`)!;
    if (orig.lines.length > 0) {
      const hasNonLatin = orig.lines.some(l => hasNonLatinScript(l.text));
      if (hasNonLatin) {
        const romanized = await romanizeToEnglishLetters(orig.lines, signal);
        if (romanized && romanized.length > 0) {
          const result = { lines: romanized, source: `${orig.source} (Romanized)` };
          lyricsCache.set(cacheKey, result);
          return result;
        }
      } else {
        lyricsCache.set(cacheKey, orig);
        return orig;
      }
    }
  }

  const cleanTitle = cleanTrackTitle(rawTitle);
  const cleanArtist = (rawArtist || '').replace(/,\s*.*$/, '').trim();
  const trackDuration = duration && duration > 0 ? duration : 180;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  let baseResult: LyricsResult | null = null;

  // 3. Try LRCLIB exact match (/api/get)
  try {
    const durationParam = duration && duration > 0 ? `&duration=${Math.round(duration)}` : '';
    const lrclibUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}${durationParam}`;
    const res = await fetch(lrclibUrl, { signal, headers: LRCLIB_HEADERS });

    if (res.ok) {
      const data = await res.json();
      const rTitle = data.trackName || data.name || '';
      const rArtist = data.artistName || '';

      if (isMatchingTitle(cleanTitle, rTitle) && isMatchingArtist(cleanArtist, rArtist)) {
        if (data.syncedLyrics) {
          const parsed = parseLRC(data.syncedLyrics);
          if (parsed.length > 0) {
            baseResult = { lines: parsed, source: 'LRCLIB Synced' };
          }
        } else if (data.plainLyrics) {
          const parsed = parsePlainLyrics(data.plainLyrics, trackDuration);
          if (parsed.length > 0) {
            baseResult = { lines: parsed, source: 'LRCLIB Plain' };
          }
        }
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
  }

  // 4. Try LRCLIB search if baseResult not found or not synced
  if (!baseResult || baseResult.source.includes('Plain')) {
    try {
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`)}`;
      const searchRes = await fetch(searchUrl, { signal, headers: LRCLIB_HEADERS });
      if (searchRes.ok) {
        const results = await searchRes.json();
        if (Array.isArray(results) && results.length > 0) {
          const matchingResults = results.filter((r: any) => {
            const rTitle = r.trackName || r.name || '';
            const rArtist = r.artistName || '';
            if (!isMatchingTitle(cleanTitle, rTitle)) return false;
            if (!isMatchingArtist(cleanArtist, rArtist)) return false;
            if (duration && duration > 0 && r.duration && r.duration > 0) {
              if (Math.abs(r.duration - duration) > 25) return false;
            }
            return true;
          });

          // Prioritize synced lyrics
          const withSynced = matchingResults.find((r: any) => r.syncedLyrics);
          if (withSynced && withSynced.syncedLyrics) {
            const parsed = parseLRC(withSynced.syncedLyrics);
            if (parsed.length > 0) {
              baseResult = { lines: parsed, source: 'LRCLIB Synced' };
            }
          } else if (!baseResult) {
            const withPlain = matchingResults.find((r: any) => r.plainLyrics);
            if (withPlain && withPlain.plainLyrics) {
              const parsed = parsePlainLyrics(withPlain.plainLyrics, trackDuration);
              if (parsed.length > 0) {
                baseResult = { lines: parsed, source: 'LRCLIB Plain' };
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  // 5. If still no lyrics, try Backend YouTube Music (/api/lyrics/{videoId})
  if (!baseResult) {
    try {
      const backendRes = await fetch(`${backendUrl}/api/lyrics/${videoId}`, { signal });
      if (backendRes.ok) {
        const data = await backendRes.json();
        if (data && data.lyrics) {
          const raw = typeof data.lyrics === 'string' ? data.lyrics : (data.lyrics.lyrics || '');
          if (raw && raw.trim().length > 0) {
            let lines: LyricLine[] = [];
            if (raw.includes('[00:') || raw.includes('[01:')) {
              lines = parseLRC(raw);
            } else {
              lines = parsePlainLyrics(raw, trackDuration);
            }

            if (lines.length > 0) {
              baseResult = { lines, source: data.lyrics.source || 'YouTube Music' };
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  // If no lyrics found anywhere
  if (!baseResult || baseResult.lines.length === 0) {
    const emptyResult = { lines: [], source: 'None' };
    lyricsCache.set(cacheKey, emptyResult);
    return emptyResult;
  }

  // Cache base result
  lyricsCache.set(`${videoId}:orig`, baseResult);

  // If preferEnglish is requested:
  if (preferEnglish) {
    const hasNonLatin = baseResult.lines.some(l => hasNonLatinScript(l.text));
    if (hasNonLatin) {
      const romanizedLines = await romanizeToEnglishLetters(baseResult.lines, signal);
      if (romanizedLines && romanizedLines.length > 0) {
        const romanizedResult = {
          lines: romanizedLines,
          source: `${baseResult.source} (Romanized)`
        };
        lyricsCache.set(cacheKey, romanizedResult);
        return romanizedResult;
      }
    }

    lyricsCache.set(cacheKey, baseResult);
    return baseResult;
  }

  return baseResult;
}

export function getCachedLyrics(videoId: string, preferEnglish: boolean = false): LyricsResult | null {
  const key = preferEnglish ? `${videoId}:en` : `${videoId}:orig`;
  return lyricsCache.get(key) || null;
}
