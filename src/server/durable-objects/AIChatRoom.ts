/**
 * AIChatRoom Durable Object
 * Handles real-time chat with message persistence using native WebSockets
 * Phase 2: WebSocket chat with SQL storage
 * Phase 3+: AI integration and RAG
 */

import { nanoid } from 'nanoid';
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

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();

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

    // Phase 3: AI response will be added here
    // For now, send a simple echo response
    await this.sendEchoResponse(conversationId, userMessage);
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
   * Temporary echo response (Phase 2)
   * Will be replaced with AI response in Phase 3
   */
  private async sendEchoResponse(conversationId: string, userMessage: ChatMessage) {
    const responseId = nanoid();
    const now = Date.now();

    // Create assistant message
    const assistantMessage: ChatMessage = {
      id: responseId,
      role: 'assistant',
      content: `Echo: ${userMessage.content} (AI integration coming in Phase 3!)`,
      timestamp: now,
      metadata: {
        isEcho: true
      }
    };

    // Save to database
    this.sql.exec(
      `INSERT INTO messages (id, conversation_id, role, content, created_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      assistantMessage.id,
      conversationId,
      assistantMessage.role,
      assistantMessage.content,
      assistantMessage.timestamp,
      JSON.stringify(assistantMessage.metadata || {})
    );

    // Broadcast assistant message
    this.broadcast(JSON.stringify({
      type: 'message.add',
      message: assistantMessage
    } satisfies WSMessageType));
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
