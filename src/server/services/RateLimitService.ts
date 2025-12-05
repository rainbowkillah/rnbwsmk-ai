/**
 * RateLimitService
 * Simple token-bucket style limiter with optional Durable Object storage.
 * Phase 8: Polish & Optimization
 */

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  blockDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
  blocked?: boolean;
}

interface RateLimitEntry {
  count: number;
  reset: number;
  blockUntil?: number;
}

type RateLimitGlobal = typeof globalThis & {
  __RNBWSMK_RATE_LIMIT__?: Map<string, RateLimitEntry>;
};

const getGlobalCache = (): Map<string, RateLimitEntry> => {
  const globalTarget = globalThis as RateLimitGlobal;
  if (!globalTarget.__RNBWSMK_RATE_LIMIT__) {
    globalTarget.__RNBWSMK_RATE_LIMIT__ = new Map();
  }
  return globalTarget.__RNBWSMK_RATE_LIMIT__;
};

const memoryCache = getGlobalCache();

export class RateLimitService {
  private storage?: DurableObjectStorage;

  constructor(storage?: DurableObjectStorage) {
    this.storage = storage;
  }

  static clearGlobalMemory() {
    memoryCache.clear();
  }

  async consume(identifier: string, options: RateLimitOptions): Promise<RateLimitResult> {
    const key = `rl:${identifier}`;
    const now = Date.now();

    let entry = await this.getEntry(key);

    if (entry && entry.blockUntil && now < entry.blockUntil) {
      const retryAfter = Math.ceil((entry.blockUntil - now) / 1000);
      return {
        allowed: false,
        blocked: true,
        limit: options.limit,
        remaining: 0,
        reset: entry.reset,
        retryAfter
      };
    }

    if (!entry || now >= entry.reset) {
      entry = {
        count: 0,
        reset: now + options.windowMs
      };
    }

    entry.count += 1;

    if (entry.count > options.limit) {
      entry.count = options.limit;
      const penalty = options.blockDurationMs ?? Math.ceil(options.windowMs * 0.5);
      entry.blockUntil = now + penalty;
      await this.setEntry(key, entry);

      return {
        allowed: false,
        blocked: true,
        limit: options.limit,
        remaining: 0,
        reset: entry.reset,
        retryAfter: Math.ceil(penalty / 1000)
      };
    }

    await this.setEntry(key, entry);

    return {
      allowed: true,
      limit: options.limit,
      remaining: Math.max(options.limit - entry.count, 0),
      reset: entry.reset
    };
  }

  private async getEntry(key: string): Promise<RateLimitEntry | null> {
    if (this.storage) {
      const stored = await this.storage.get<RateLimitEntry>(key);
      if (!stored) return null;
      if (stored.reset < Date.now() && !(stored.blockUntil && stored.blockUntil > Date.now())) {
        return null;
      }
      return stored;
    }

    const entry = memoryCache.get(key) || null;
    if (entry && entry.reset < Date.now()) {
      if (entry.blockUntil && entry.blockUntil > Date.now()) {
        return entry;
      }
      memoryCache.delete(key);
      return null;
    }
    return entry;
  }

  private async setEntry(key: string, entry: RateLimitEntry): Promise<void> {
    if (this.storage) {
      await this.storage.put(key, entry);
      return;
    }

    memoryCache.set(key, entry);

    // Basic cap to avoid unbounded memory use
    if (memoryCache.size > 512) {
      const firstKey = memoryCache.keys().next().value;
      if (firstKey) {
        memoryCache.delete(firstKey);
      }
    }
  }
}
