/** Rejects if the promise does not settle within `ms`. Prevents endless "loading" states. */
export function withTimeout<T>(p: PromiseLike<T>, ms: number, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`TIMEOUT: ${label} (${ms}ms)`)), ms);
    Promise.resolve(p).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}
