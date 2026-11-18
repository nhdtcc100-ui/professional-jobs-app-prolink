/**
 * ⚡ Lightweight In-Memory Query Cache
 * Reduces repetitive database queries for predictable, read-heavy endpoints.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class QueryCache {
  private store = new Map<string, CacheEntry<any>>();

  /**
   * Store item in cache with a TTL (Time To Live) in milliseconds.
   */
  set<T>(key: string, data: T, ttlMs = 60_000): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Retrieve item if present and not expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Invalidate specific key or keys starting with a prefix.
   */
  invalidate(keyOrPrefix: string): void {
    for (const key of this.store.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all cached data.
   */
  clear(): void {
    this.store.clear();
  }
}

export const queryCache = new QueryCache();
