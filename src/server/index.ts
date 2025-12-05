/**
 * rnbwsmk-ai: AI Assistant Worker for RainbowSmoke Official
 *
 * This Cloudflare Worker provides AI-powered chat, semantic search,
 * and knowledge base management for rainbowsmokeofficial.com
 */

export { AIChatRoom } from './durable-objects/AIChatRoom';
export { UserSession } from './durable-objects/UserSession';

import { VectorizeService } from './services/VectorizeService';
import { seedVectorize } from '../../scripts/seed-vectorize';
import { RateLimitService } from './services/RateLimitService';

const httpRateLimiter = new RateLimitService();

/**
 * Main worker entry point
 * Handles routing for HTTP and WebSocket connections
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Health check endpoint
    if (path === '/health') {
      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.7.0'
      });
    }

    // API status endpoint
    if (path === '/api/status') {
      return Response.json({
        service: 'rnbwsmk-ai',
        version: '0.7.0',
        features: {
          chat: 'enabled',
          vectorize: 'enabled',
          autorag: 'enabled',
          calendar: 'enabled'
        },
        models: {
          default: env.DEFAULT_MODEL,
          premium: env.PREMIUM_MODEL,
          embedding: env.EMBEDDING_MODEL
        }
      });
    }

    // WebSocket chat routes (handled by Durable Objects)
    if (path.startsWith('/party/chat/')) {
      const roomId = path.split('/').pop() || 'default';
      const durableObjectId = env.AI_CHAT_ROOM.idFromName(roomId);
      const durableObject = env.AI_CHAT_ROOM.get(durableObjectId);
      return durableObject.fetch(request);
    }

    // Vectorize seeding endpoint (Phase 4)
    if (path === '/api/vectorize/seed' && request.method === 'POST') {
      const rateLimited = await enforceHttpRateLimit(request, 'vectorize-seed', 2, 3600_000);
      if (rateLimited) return rateLimited;
      try {
        await seedVectorize(env);
        return Response.json({
          success: true,
          message: 'Vectorize indexes seeded successfully'
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: (error as Error).message
        }, { status: 500 });
      }
    }

    // Vectorize query endpoint (Phase 4)
    if (path === '/api/vectorize/query' && request.method === 'POST') {
      const rateLimited = await enforceHttpRateLimit(request, 'vectorize-query', 60, 60_000);
      if (rateLimited) return rateLimited;
      try {
        const { query, indexType = 'profile', topK = 5 } = await request.json() as any;

        const vectorService = new VectorizeService(
          env.AI,
          env.VECTORIZE_PROFILE,
          env.VECTORIZE_CONTENT,
          env.VECTORIZE_PRODUCTS,
          env.EMBEDDING_MODEL
        );

        const results = await vectorService.query(indexType, query, { topK });

        return Response.json({
          success: true,
          query,
          indexType,
          results
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: (error as Error).message
        }, { status: 500 });
      }
    }

    // Vectorize search all indexes (Phase 4)
    if (path === '/api/vectorize/search' && request.method === 'POST') {
      const rateLimited = await enforceHttpRateLimit(request, 'vectorize-search', 60, 60_000);
      if (rateLimited) return rateLimited;
      try {
        const { query, topK = 5, minScore = 0.7 } = await request.json() as any;

        const vectorService = new VectorizeService(
          env.AI,
          env.VECTORIZE_PROFILE,
          env.VECTORIZE_CONTENT,
          env.VECTORIZE_PRODUCTS,
          env.EMBEDDING_MODEL
        );

        const context = await vectorService.getRelevantContext(query, {
          maxChunks: topK,
          minScore
        });

        return Response.json({
          success: true,
          query,
          context
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: (error as Error).message
        }, { status: 500 });
      }
    }

    // Calendar routes (Phase 7) - WebSocket via UserSession DO
    if (path.startsWith('/party/calendar/')) {
      const userId = path.split('/').pop() || 'default';
      const durableObjectId = env.USER_SESSION.idFromName(userId);
      const durableObject = env.USER_SESSION.get(durableObjectId);
      return durableObject.fetch(request);
    }

    // Search API (Phase 7)
    if (path === '/api/search' && request.method === 'POST') {
      const rateLimited = await enforceHttpRateLimit(request, 'search', 45, 60_000);
      if (rateLimited) return rateLimited;
      try {
        const { SearchService } = await import('./services/SearchService');
        const vectorService = new VectorizeService(
          env.AI,
          env.VECTORIZE_PROFILE,
          env.VECTORIZE_CONTENT,
          env.VECTORIZE_PRODUCTS,
          env.EMBEDDING_MODEL
        );
        const searchService = new SearchService(vectorService);

        const query = await request.json() as any;
        const results = await searchService.search(query);

        return Response.json(results);
      } catch (error) {
        return Response.json({
          error: (error as Error).message
        }, { status: 500 });
      }
    }

    // Recommendations API (Phase 7)
    if (path === '/api/recommendations' && request.method === 'POST') {
      const rateLimited = await enforceHttpRateLimit(request, 'recommendations', 45, 60_000);
      if (rateLimited) return rateLimited;
      try {
        const { SearchService } = await import('./services/SearchService');
        const vectorService = new VectorizeService(
          env.AI,
          env.VECTORIZE_PROFILE,
          env.VECTORIZE_CONTENT,
          env.VECTORIZE_PRODUCTS,
          env.EMBEDDING_MODEL
        );
        const searchService = new SearchService(vectorService);

        const { query, limit = 5 } = await request.json() as any;
        const recommendations = await searchService.getRecommendations(query, limit);

        return Response.json({
          success: true,
          query,
          recommendations
        });
      } catch (error) {
        return Response.json({
          error: (error as Error).message
        }, { status: 500 });
      }
    }

    // Browser crawl API (Phase 7)
    if (path === '/api/crawl' && request.method === 'POST') {
      const rateLimited = await enforceHttpRateLimit(request, 'crawl', 10, 60_000);
      if (rateLimited) return rateLimited;
      try {
        const { BrowserService } = await import('./services/BrowserService');
        const browserService = new BrowserService(env.BROWSER);

        const { url, options } = await request.json() as any;
        const result = await browserService.crawlWebsite(url, options);

        return Response.json({
          success: true,
          result
        });
      } catch (error) {
        return Response.json({
          error: (error as Error).message
        }, { status: 500 });
      }
    }

    // Other API routes (will be implemented in future phases)
    if (path.startsWith('/api/')) {
      return Response.json({
        error: 'Not implemented yet',
        path,
        phase: 'Coming in Phase 8+'
      }, { status: 501 });
    }

    // Serve static assets (React SPA)
    try {
      return await env.ASSETS.fetch(request);
    } catch (error) {
      return new Response('Asset not found', { status: 404 });
    }
  },
};

async function enforceHttpRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number
): Promise<Response | null> {
  const clientId = getClientIdentifier(request);
  const rateResult = await httpRateLimiter.consume(`${bucket}:${clientId}`, {
    limit,
    windowMs,
    blockDurationMs: windowMs
  });

  if (rateResult.allowed) {
    return null;
  }

  const retryAfter = rateResult.retryAfter ?? Math.ceil((rateResult.reset - Date.now()) / 1000);

  return Response.json({
    error: 'Rate limit exceeded',
    bucket,
    retryAfter
  }, {
    status: 429,
    headers: {
      'Retry-After': String(retryAfter)
    }
  });
}

function getClientIdentifier(request: Request): string {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return 'anonymous';
}
