/**
 * rnbwsmk-ai: AI Assistant Worker for RainbowSmoke Official
 *
 * This Cloudflare Worker provides AI-powered chat, semantic search,
 * and knowledge base management for rainbowsmokeofficial.com
 */

export { AIChatRoom } from './durable-objects/AIChatRoom';
export { UserSession } from './durable-objects/UserSession';

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
        version: '0.1.0'
      });
    }

    // API status endpoint
    if (path === '/api/status') {
      return Response.json({
        service: 'rnbwsmk-ai',
        version: '0.1.0',
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

    // PartyKit WebSocket routes (handled by Durable Objects)
    if (path.startsWith('/party/chat/')) {
      const roomId = path.split('/').pop() || 'default';
      const durableObjectId = env.AI_CHAT_ROOM.idFromName(roomId);
      const durableObject = env.AI_CHAT_ROOM.get(durableObjectId);
      return durableObject.fetch(request);
    }

    // API routes (will be implemented in phases)
    if (path.startsWith('/api/')) {
      // TODO: Implement API handlers in Phase 3+
      return Response.json({
        error: 'Not implemented yet',
        path,
        phase: 'Coming in Phase 3+'
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
