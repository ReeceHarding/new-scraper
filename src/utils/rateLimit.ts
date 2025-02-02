import { LRUCache } from 'lru-cache';

interface RateLimitOptions {
  interval: number;
  uniqueTokenPerInterval: number;
}

interface RateLimitResponse {
  check: (key: string, limit: number) => Promise<void>;
}

export default function rateLimit({ interval, uniqueTokenPerInterval }: RateLimitOptions): RateLimitResponse {
  const tokenCache = new LRUCache<string, number>({
    max: uniqueTokenPerInterval,
    ttl: interval,
    allowStale: false,
    updateAgeOnGet: true,
  });

  return {
    check: async (key: string, limit: number) => {
      const tokenCount = tokenCache.get(key) || 0;
      
      if (tokenCount >= limit) {
        throw new Error('Rate limit exceeded');
      }

      tokenCache.set(key, tokenCount + 1);
    },
  };
} 