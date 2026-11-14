/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PROLINK ASYNC KEYED CONCURRENCY MUTEX                          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Provides application-level synchronization to serialize concurrent
 * database writes to the same resource or by the same actor.
 *
 * Prevents race conditions, double-writes, and out-of-order execution
 * in distributed/unstable network environments.
 */

type MutexTask<T> = () => Promise<T>;

class KeyedAsyncMutex {
  private queue: Map<string, Promise<void>> = new Map();
  private activeLocks: Set<string> = new Set();

  /**
   * Acquires a lock for the given resource key.
   * Resolves to a release function that MUST be called when finished.
   */
  async acquire(key: string, timeoutMs = 15000): Promise<() => void> {
    let releaseCurrent: () => void = () => {};
    const nextLock = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    // Synchronously chain to the tail of the queue
    const prevLock = this.queue.get(key) || Promise.resolve();
    this.queue.set(key, nextLock);

    let timeoutTimer: any = null;
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        reject(new Error(`[Mutex] Lock acquisition timed out for key: ${key} (${timeoutMs}ms)`));
      }, timeoutMs);
    });

    try {
      await Promise.race([prevLock, timeoutPromise]);
    } catch (err) {
      releaseCurrent();
      if (this.queue.get(key) === nextLock) {
        this.queue.delete(key);
      }
      throw err;
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }

    this.activeLocks.add(key);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeLocks.delete(key);

      if (this.queue.get(key) === nextLock) {
        this.queue.delete(key);
      }
      releaseCurrent();
    };
  }

  /**
   * Checks if a resource key is currently locked.
   */
  isLocked(key: string): boolean {
    return this.activeLocks.has(key);
  }

  /**
   * Forcibly clears any active lock or queue for a key (used for recovering from stuck/failed operations).
   */
  clearKey(key: string): void {
    this.activeLocks.delete(key);
    this.queue.delete(key);
  }

  /**
   * Executes an asynchronous task inside a critical section locked by key.
   * Guarantees the lock is released even if the task throws.
   */
  async runExclusive<T>(key: string, task: MutexTask<T>, timeoutMs = 15000): Promise<T> {
    const release = await this.acquire(key, timeoutMs);
    try {
      return await task();
    } finally {
      release();
    }
  }
}

export const concurrencyMutex = new KeyedAsyncMutex();

/**
 * Convenient wrapper function to run a task within a mutex lock.
 */
export async function withMutex<T>(key: string, task: () => Promise<T>, timeoutMs = 15000): Promise<T> {
  return concurrencyMutex.runExclusive(key, task, timeoutMs);
}
