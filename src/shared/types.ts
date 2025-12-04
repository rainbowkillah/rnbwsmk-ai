/**
 * Shared types used across client and server
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  model?: string;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata: {
    text: string;
    type: string;
    category?: string;
    url?: string;
    [key: string]: any;
  };
}

export interface SearchOptions {
  useAutoRAG?: boolean;
  model?: string;
  maxResults?: number;
}

export interface SearchResult {
  answer: string;
  sources: Array<{
    text: string;
    metadata: any;
    score: number;
  }>;
}

export type WSMessageType =
  | { type: 'message.new'; id: string; content: string; userId?: string; useRAG?: boolean; usePremium?: boolean; model?: string }
  | { type: 'message.stream'; id: string; content: string }
  | { type: 'message.complete'; message: ChatMessage }
  | { type: 'message.add'; message: ChatMessage }
  | { type: 'context.update'; messageId: string; sources: Array<{ id: string; score: number; type: string; category: string }> }
  | { type: 'typing.start'; userId: string }
  | { type: 'typing.stop'; userId: string }
  | { type: 'error'; error: string }
  | { type: 'history'; messages: ChatMessage[] };
