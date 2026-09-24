import { describe, it, expect, vi } from 'vitest';
import { withTimeout, retry, safeRead } from '@/lib/net';

describe('withTimeout', () => {
  it('resolves with the promise value when it settles before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  it('rejects when the promise takes longer than the timeout', async () => {
    vi.useFakeTimers();
    const hung = new Promise(() => {}); // never resolves
    const raced = withTimeout(hung, 50, 'load');
    const assertion = expect(raced).rejects.toThrow('load timed out');
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
    vi.useRealTimers();
  });

  it('propagates the original rejection reason when the promise rejects first', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
  });
});

describe('retry', () => {
  it('returns the result on the first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('done');
    await expect(retry(fn, { tries: 3, base: 1 })).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('recovered');
    await expect(retry(fn, { tries: 3, base: 1 })).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error once all tries are exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(retry(fn, { tries: 2, base: 1 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not sleep after the final attempt (no wasted delay)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'));
    const start = Date.now();
    await expect(retry(fn, { tries: 1, base: 10000 })).rejects.toThrow();
    // With tries=1 there should be no backoff wait at all.
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

describe('safeRead', () => {
  it('returns { data, failed: false } on a clean Supabase-style response', async () => {
    const out = await safeRead(() => Promise.resolve({ data: [{ id: 1 }], error: null }));
    expect(out).toEqual({ data: [{ id: 1 }], failed: false });
  });

  it('returns { data: null, failed: true } when the response carries a Supabase error', async () => {
    const out = await safeRead(() => Promise.resolve({ data: null, error: { message: 'RLS denied' } }));
    expect(out).toEqual({ data: null, failed: true });
  });

  it('returns { data: null, failed: true } when the query function throws (after retries)', async () => {
    // safeRead retries 3x with backoff (400ms, 800ms) by default — fake timers
    // keep this test instant instead of eating >1s of real wall-clock time.
    vi.useFakeTimers();
    const resultPromise = safeRead(() => Promise.reject(new Error('network down')));
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(800);
    await expect(resultPromise).resolves.toEqual({ data: null, failed: true });
    vi.useRealTimers();
  });

  it('falls back to the raw resolved value when it is not a Supabase-shaped {data,error} object', async () => {
    const out = await safeRead(() => Promise.resolve(['a', 'b']));
    expect(out).toEqual({ data: ['a', 'b'], failed: false });
  });
});
