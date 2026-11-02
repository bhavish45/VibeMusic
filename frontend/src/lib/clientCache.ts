// Lightweight client-side cache with memory + sessionStorage fallback for instant page loads
const memoryCache = new Map<string, { data: any; expiry: number }>();

export function getClientCache<T = any>(key: string): T | null {
  const now = Date.now();
  
  // 1. Check RAM memory map
  const mem = memoryCache.get(key);
  if (mem) {
    if (mem.expiry > now) {
      return mem.data as T;
    }
    memoryCache.delete(key);
  }

  // 2. Check sessionStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`vibe_cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiry > now) {
          memoryCache.set(key, parsed);
          return parsed.data as T;
        }
        sessionStorage.removeItem(`vibe_cache_${key}`);
      }
    } catch {
      // Ignore storage errors
    }
  }

  return null;
}

export function setClientCache(key: string, data: any, ttlSeconds: number = 1800): void {
  const expiry = Date.now() + ttlSeconds * 1000;
  const payload = { data, expiry };

  // Set in RAM
  memoryCache.set(key, payload);

  // Set in sessionStorage
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`vibe_cache_${key}`, JSON.stringify(payload));
    } catch {
      // Quota exceeded or private browsing
    }
  }
}
