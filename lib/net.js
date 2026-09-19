// Resilience helpers for flaky campus wifi.

/** Wrap a promise with a timeout so a hung request doesn't stall the UI forever. */
export function withTimeout(promise, ms = 12000, label = 'request') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    ),
  ]);
}

/** Retry an async fn a couple of times with backoff. For idempotent reads only. */
export async function retry(fn, { tries = 3, base = 400 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, base * 2 ** i));
    }
  }
  throw lastErr;
}

/** Convenience for Supabase queries: retry the read, time it out, surface a clean flag. */
export async function safeRead(queryFn) {
  try {
    const res = await retry(() => withTimeout(queryFn(), 12000, 'load'));
    if (res?.error) return { data: null, failed: true };
    return { data: res?.data ?? res, failed: false };
  } catch {
    return { data: null, failed: true };
  }
}
