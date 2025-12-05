import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitService } from '../RateLimitService';

describe('RateLimitService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    RateLimitService.clearGlobalMemory();
  });

  afterEach(() => {
    RateLimitService.clearGlobalMemory();
    vi.useRealTimers();
  });

  it('allows requests below the limit', async () => {
    const limiter = new RateLimitService();
    const options = { limit: 3, windowMs: 1000 };

    for (let i = 0; i < 3; i++) {
      const result = await limiter.consume('test-basic', options);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Math.max(options.limit - (i + 1), 0));
    }
  });

  it('blocks requests that exceed the limit and resets after the window', async () => {
    const limiter = new RateLimitService();
    const options = { limit: 2, windowMs: 1000 };

    await limiter.consume('test-window', options);
    await limiter.consume('test-window', options);
    const blocked = await limiter.consume('test-window', options);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);

    vi.advanceTimersByTime(1000);

    const afterReset = await limiter.consume('test-window', options);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(options.limit - 1);
  });

  it('applies block duration when configured', async () => {
    const limiter = new RateLimitService();
    const options = { limit: 1, windowMs: 1000, blockDurationMs: 5000 };

    await limiter.consume('test-block', options);
    const blocked = await limiter.consume('test-block', options);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(5);

    // Advance less than block duration – still blocked
    vi.advanceTimersByTime(2000);
    const stillBlocked = await limiter.consume('test-block', options);
    expect(stillBlocked.allowed).toBe(false);

    // After penalty expires allow again
    vi.advanceTimersByTime(4000);
    const allowed = await limiter.consume('test-block', options);
    expect(allowed.allowed).toBe(true);
  });
});
