/**
 * Shared constants
 */

export const APP_NAME = 'rnbwsmk-ai';
export const APP_VERSION = '0.1.0';

export const RATE_LIMITS = {
  chat: {
    maxRequests: 50,
    windowSeconds: 3600  // 50 requests/hour
  },
  search: {
    maxRequests: 100,
    windowSeconds: 3600  // 100 requests/hour
  },
  api: {
    maxRequests: 200,
    windowSeconds: 3600  // 200 requests/hour
  }
} as const;

export const CACHE_STRATEGY = {
  aiGateway: { ttl: 3600 },       // 1 hour
  vectorizeQueries: { ttl: 1800 }, // 30 minutes
  staticAssets: { ttl: 86400 },    // 24 hours
  apiResponses: { ttl: 300 }       // 5 minutes
} as const;

export const MODEL_TIERS = {
  free: [
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/mistral/mistral-7b-instruct-v0.1'
  ],
  premium: [
    'openai/gpt-4o',
    'anthropic/claude-sonnet-4-5'
  ]
} as const;
