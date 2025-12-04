/**
 * AIChatRoom Durable Object
 * Handles real-time chat with message persistence using native WebSockets
 * Phase 2: WebSocket chat with SQL storage
 * Phase 3: AI integration with streaming
 * Phase 5: RAG integration with vector knowledge base
 */

import { nanoid } from 'nanoid';
import { AIService } from '../services/AIService';
import { VectorizeService } from '../services/VectorizeService';
import { RAGService } from '../services/RAGService';
import type { ChatMessage, WSMessageType } from '../../shared/types';

interface WebSocketSession {
  webSocket: WebSocket;
  connectionId: string;
}

export class AIChatRoom implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Set<WebSocketSession>;
  private sql!: SqlStorage;
  private aiService: AIService;
  private vectorService: VectorizeService;
  private ragService: RAGService;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();

    // Initialize AI service
    this.aiService = new AIService(env.AI, env.AI_GATEWAY_ID);

    // Initialize Vectorize service
    this.vectorService = new VectorizeService(
      env.AI,
      env.VECTORIZE_PROFILE,
      env.VECTORIZE_CONTENT,
      env.VECTORIZE_PRODUCTS,
      env.EMBEDDING_MODEL
    );

    // Initialize RAG service
    this.ragService = new RAGService(this.vectorService, this.aiService);

    // Block all CORS requests for now (we'll enable later for production)
    this.state.blockConcurrencyWhile(async () => {
      this.sql = this.state.storage.sql;
      await this.initializeDatabase();
    });
  }

  /**
   * Initialize SQL schema for conversations and messages
   */
  private async initializeDatabase() {
    // Conversations table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata TEXT
      )
    `);

    // Messages table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        model TEXT,
        tokens_used INTEGER,
        created_at INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      )
    `);

    // Indexes for performance
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_user
      ON conversations(user_id, updated_at DESC)
    `);

    // Ensure default conversation exists for this room
    const conversationId = this.state.id.toString();
    const existing = this.sql.exec(
      `SELECT id FROM conversations WHERE id = ?`,
      conversationId
    ).toArray();

    if (existing.length === 0) {
      const now = Date.now();
      this.sql.exec(
        `INSERT INTO conversations (id, user_id, title, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        conversationId,
        'anonymous',
        `Chat Room: ${conversationId}`,
        now,
        now,
        JSON.stringify({})
      );
    }
  }

  /**
   * Handle HTTP fetch requests
   */
  async fetch(request: Request): Promise<Response> {
    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // Handle HTTP API requests
    const url = new URL(request.url);
    if (url.pathname.endsWith('/history')) {
      return this.handleGetHistory();
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Handle WebSocket upgrade
   */
  private handleWebSocketUpgrade(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    this.state.acceptWebSocket(server);

    const connectionId = nanoid();
    const session: WebSocketSession = {
      webSocket: server,
      connectionId
    };

    this.sessions.add(session);

    // Send connection success and history
    this.sendHistory(server, connectionId);

    // Broadcast join message to other sessions
    this.broadcast(
      JSON.stringify({
        type: 'system',
        content: `User ${connectionId} joined the chat`,
        timestamp: Date.now()
      }),
      session
    );

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer) {
    try {
      const messageStr = typeof rawMessage === 'string'
        ? rawMessage
        : new TextDecoder().decode(rawMessage);

      const data = JSON.parse(messageStr) as WSMessageType;

      // Find the session for this WebSocket
      const session = Array.from(this.sessions).find(s => s.webSocket === ws);
      if (!session) {
        console.error('Session not found for WebSocket');
        return;
      }

      switch (data.type) {
        case 'message.new':
          await this.handleNewMessage(session, data);
          break;

        case 'typing.start':
        case 'typing.stop':
          // Broadcast typing indicators to other sessions
          this.broadcast(messageStr, session);
          break;

        default:
          console.warn('Unknown message type:', (data as any).type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to process message'
      } satisfies WSMessageType));
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const session = Array.from(this.sessions).find(s => s.webSocket === ws);
    if (session) {
      this.sessions.delete(session);
      console.log(`Client disconnected: ${session.connectionId}`);

      // Broadcast leave message
      this.broadcast(
        JSON.stringify({
          type: 'system',
          content: `User ${session.connectionId} left the chat`,
          timestamp: Date.now()
        })
      );
    }

    // Close the WebSocket
    ws.close(code, reason);
  }

  /**
   * Handle WebSocket error
   */
  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('WebSocket error:', error);
  }

  /**
   * Handle new user message
   */
  private async handleNewMessage(session: WebSocketSession, data: WSMessageType & { type: 'message.new' }) {
    const conversationId = this.state.id.toString();
    const messageId = data.id || nanoid();
    const now = Date.now();

    // Create user message
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: data.content,
      timestamp: now,
      metadata: {
        userId: data.userId || session.connectionId,
        connectionId: session.connectionId
      }
    };

    // Save to database
    this.sql.exec(
      `INSERT INTO messages (id, conversation_id, role, content, created_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      userMessage.id,
      conversationId,
      userMessage.role,
      userMessage.content,
      userMessage.timestamp,
      JSON.stringify(userMessage.metadata || {})
    );

    // Update conversation updated_at
    this.sql.exec(
      `UPDATE conversations SET updated_at = ? WHERE id = ?`,
      now,
      conversationId
    );

    // Broadcast user message to all sessions
    this.broadcast(JSON.stringify({
      type: 'message.add',
      message: userMessage
    } satisfies WSMessageType));

    // Generate AI response with streaming
    await this.sendAIResponse(conversationId, data);
  }

  /**
   * Send conversation history to a WebSocket
   */
  private sendHistory(ws: WebSocket, connectionId: string) {
    const conversationId = this.state.id.toString();

    const rows = this.sql.exec(
      `SELECT id, role, content, model, tokens_used, created_at, metadata
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC
       LIMIT 100`,
      conversationId
    ).toArray();

    const messages: ChatMessage[] = rows.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      model: row.model,
      timestamp: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));

    ws.send(JSON.stringify({
      type: 'history',
      messages
    } satisfies WSMessageType));
  }

  /**
   * Handle GET /history API
   */
  private handleGetHistory(): Response {
    const conversationId = this.state.id.toString();

    const rows = this.sql.exec(
      `SELECT id, role, content, model, tokens_used, created_at, metadata
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      conversationId
    ).toArray();

    const messages: ChatMessage[] = rows.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      model: row.model,
      timestamp: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));

    return Response.json({ messages });
  }

  /**
   * Generate AI response with streaming and RAG context (Phase 3 + Phase 5)
   */
  private async sendAIResponse(
    conversationId: string,
    requestData: WSMessageType & { type: 'message.new' }
  ) {
    const responseId = nanoid();
    const now = Date.now();

    try {
      // Get conversation history for context
      const history = this.getConversationHistory(conversationId);

      // Generate AI response with RAG and streaming
      const { stream, context } = await this.ragService.chatWithContext(history, {
        model: requestData.model,
        usePremium: requestData.usePremium,
        stream: true,
        temperature: 0.7,
        maxTokens: 1024,
        enableRAG: true,
        maxContext: 5,
        minRelevance: 0.7,
        gateway: {
          id: this.env.AI_GATEWAY_ID,
          cacheTtl: 3600
        }
      });

      // Broadcast context information if available
      if (context && context.sources.length > 0) {
        this.broadcast(JSON.stringify({
          type: 'context.update',
          messageId: responseId,
          sources: context.sources.map(s => ({
            id: s.id,
            score: s.score,
            type: s.metadata.type,
            category: s.metadata.category
          }))
        } satisfies WSMessageType));
      }

      if (typeof stream === 'string') {
        // Non-streaming response (shouldn't happen, but handle it)
        await this.saveAndBroadcastMessage(conversationId, responseId, stream, now);
        return;
      }

      // Stream the response
      const reader = stream.getReader();
      let fullContent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done || value.done) {
            // Save complete message to database
            await this.saveAndBroadcastMessage(conversationId, responseId, fullContent, now);
            break;
          }

          // Accumulate content
          fullContent += value.content;

          // Broadcast stream chunk to all sessions
          this.broadcast(JSON.stringify({
            type: 'message.stream',
            id: responseId,
            content: value.content
          } satisfies WSMessageType));
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('AI response error:', error);

      // Send error message
      const errorMessage = `Sorry, I encountered an error: ${(error as Error).message}`;
      await this.saveAndBroadcastMessage(conversationId, responseId, errorMessage, now, {
        error: true
      });
    }
  }

  /**
   * Save message to database and broadcast to all sessions
   */
  private async saveAndBroadcastMessage(
    conversationId: string,
    messageId: string,
    content: string,
    timestamp: number,
    metadata: Record<string, any> = {}
  ) {
    const assistantMessage: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content,
      timestamp,
      model: this.env.DEFAULT_MODEL,
      metadata
    };

    // Save to database
    this.sql.exec(
      `INSERT INTO messages (id, conversation_id, role, content, model, created_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      assistantMessage.id,
      conversationId,
      assistantMessage.role,
      assistantMessage.content,
      assistantMessage.model,
      assistantMessage.timestamp,
      JSON.stringify(assistantMessage.metadata || {})
    );

    // Broadcast complete message
    this.broadcast(JSON.stringify({
      type: 'message.complete',
      message: assistantMessage
    } satisfies WSMessageType));
  }

  /**
   * Get conversation history for AI context
   */
  private getConversationHistory(conversationId: string, limit: number = 10): ChatMessage[] {
    const rows = this.sql.exec(
      `SELECT id, role, content, model, tokens_used, created_at, metadata
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      conversationId,
      limit
    ).toArray();

    // Reverse to get chronological order
    return rows.reverse().map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      model: row.model,
      timestamp: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));
  }

  /**
   * Broadcast message to all sessions except the excluded one
   */
  private broadcast(message: string, excludeSession?: WebSocketSession) {
    for (const session of this.sessions) {
      if (session !== excludeSession) {
        try {
          session.webSocket.send(message);
        } catch (error) {
          console.error('Error sending to session:', error);
        }
      }
    }
  }
}
