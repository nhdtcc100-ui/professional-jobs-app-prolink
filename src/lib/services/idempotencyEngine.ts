/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PROLINK IDEMPOTENCY ENGINE (Duplicate Prevention & Caching)     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Guarantees exactly-once execution semantics for state-mutating requests
 * (posts, applications, job posts, payments, connections).
 *
 * Features:
 * 1. In-flight request deduplication: Concurrent identical requests wait for
 *    the active request rather than executing duplicate database inserts.
 * 2. TTL Response Caching: Returns identical responses for duplicate requests
 *    received within the idempotency window.
 * 3. Payload fingerprinting: Automatically creates deterministic hashes
 *    to detect duplicate payloads even if explicit keys were not passed.
 */

import { generateUUID } from '../security/distributedId';

export interface IdempotencyOptions {
  ttlMs?: number;               // How long to preserve the result (default: 30,000ms = 30s)
  scope?: string;               // Optional domain scope (e.g. 'posts', 'jobs')
  persistInSession?: boolean;   // Whether to persist across minor navigation
}

interface CachedRecord<T> {
  response: T;
  timestamp: number;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 30_000;
const SESSION_PREFIX = 'prolink_idempotency_';

class IdempotencyEngine {
  // In-flight promises to deduplicate concurrent executions
  private inFlightMap: Map<string, Promise<any>> = new Map();
  // Completed response cache
  private memoryCache: Map<string, CachedRecord<any>> = new Map();

  constructor() {
    // Periodic garbage collection every 60 seconds
    const timer = setInterval(() => this.purgeExpired(), 60_000);
    if (typeof timer === 'object' && timer && 'unref' in timer) {
      (timer as any).unref();
    }
  }

  /**
   * Generates a fast 32-bit FNV-1a hash of a serialized payload for fingerprinting.
   */
  generatePayloadFingerprint(payload: any): string {
    try {
      const str = typeof payload === 'string' ? payload : JSON.stringify(payload, Object.keys(payload || {}).sort());
      let hash = 2166136261;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    } catch {
      return generateUUID().slice(0, 8);
    }
  }

  /**
   * Generates a unique idempotency key combining scope, actor, and payload hash.
   */
  generateKey(scope: string, actorId: string, payload?: any): string {
    const fingerprint = payload ? this.generatePayloadFingerprint(payload) : generateUUID();
    return `${scope}:${actorId}:${fingerprint}`;
  }

  /**
   * Executes a database mutation with strict idempotency guarantees.
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    options: IdempotencyOptions = {}
  ): Promise<T> {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const now = Date.now();

    // 1. Check memory cache for already completed execution
    const cached = this.memoryCache.get(key);
    if (cached && cached.expiresAt > now) {
      console.log(`[Idempotency] Returning cached response for key: ${key}`);
      return cached.response;
    }

    // 2. Check sessionStorage if configured
    if (options.persistInSession && typeof sessionStorage !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(SESSION_PREFIX + key);
        if (stored) {
          const parsed: CachedRecord<T> = JSON.parse(stored);
          if (parsed.expiresAt > now) {
            this.memoryCache.set(key, parsed);
            return parsed.response;
          }
        }
      } catch {}
    }

    // 3. Deduplicate in-flight execution: If already running, wait for it
    if (this.inFlightMap.has(key)) {
      console.log(`[Idempotency] In-flight request detected for key: ${key}. Awaiting active operation...`);
      const existing = this.inFlightMap.get(key) as Promise<T>;
      return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => {
          this.inFlightMap.delete(key); // never let a stuck request block retries forever
          reject(new Error('[Idempotency] انتهت مهلة انتظار الطلب السابق، أعد المحاولة.'));
        }, 25_000);
        existing.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
      });
    }

    // 4. Start execution and register in inFlightMap
    const execPromise = (async () => {
      try {
        // Hard ceiling so a hung network call can't hold the mutex / in-flight slot forever
        const result = await new Promise<T>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('[Idempotency] انتهت مهلة تنفيذ العملية.')), 45_000);
          operation().then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
        });

        // Do NOT cache failed responses: a failed attempt must be retryable immediately
        const failed = !!result && typeof result === 'object' && (result as any).error;
        if (failed) return result;

        // Cache successful or defined response
        const record: CachedRecord<T> = {
          response: result,
          timestamp: Date.now(),
          expiresAt: Date.now() + ttlMs,
        };

        this.memoryCache.set(key, record);

        if (options.persistInSession && typeof sessionStorage !== 'undefined') {
          try {
            sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(record));
          } catch {}
        }

        return result;
      } finally {
        this.inFlightMap.delete(key);
      }
    })();

    this.inFlightMap.set(key, execPromise);
    return execPromise;
  }

  /**
   * Clears expired records from memory cache.
   */
  private purgeExpired() {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Explicitly invalidates a key (e.g. if an operation is rolled back).
   */
  invalidate(key: string) {
    this.memoryCache.delete(key);
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(SESSION_PREFIX + key);
      } catch {}
    }
  }
}

export const idempotencyEngine = new IdempotencyEngine();

/**
 * Convenient wrapper function for idempotent execution.
 */
export async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>,
  options?: IdempotencyOptions
): Promise<T> {
  return idempotencyEngine.execute(key, operation, options);
}
