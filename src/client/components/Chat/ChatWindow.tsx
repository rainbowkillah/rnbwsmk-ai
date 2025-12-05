/**
 * ChatWindow Component
 * Main chat interface container with RAG context display
 * Phase 5: RAG Integration
 */

import React, { useState, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { ChatMessage } from '../../../shared/types';

interface ChatWindowProps {
  roomId?: string;
}

interface RAGContext {
  messageId: string;
  sources: Array<{
    id: string;
    score: number;
    type: string;
    category: string;
  }>;
}

export default function ChatWindow({ roomId = 'default' }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [ragContext, setRagContext] = useState<RAGContext | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sendMessage, connectionState } = useWebSocket({
    roomId,
    onMessage: (message) => {
      // Handle incoming messages from WebSocket
      if (message.type === 'history') {
        setMessages(message.messages);
        setStreamingMessage(null);
      } else if (message.type === 'message.add') {
        setMessages(prev => [...prev, message.message]);
      } else if (message.type === 'message.stream') {
        // Accumulate streaming content
        setStreamingMessage(prev => {
          if (!prev || prev.id !== message.id) {
            // New streaming message
            return {
              id: message.id,
              role: 'assistant',
              content: message.content,
              timestamp: Date.now()
            };
          } else {
            // Append to existing streaming message
            return {
              ...prev,
              content: prev.content + message.content
            };
          }
        });
      } else if (message.type === 'message.complete') {
        // Finalize streaming message
        setMessages(prev => [...prev, message.message]);
        setStreamingMessage(null);
        // Clear RAG context after message is complete
        setTimeout(() => setRagContext(null), 5000);
      } else if (message.type === 'context.update') {
        // Update RAG context
        setRagContext({
          messageId: message.messageId,
          sources: message.sources
        });
      } else if (message.type === 'error') {
        setError(message.error);
        setTimeout(() => setError(null), 5000);
      }
    },
    onConnectionChange: (connected) => {
      setIsConnected(connected);
    }
  });

  const handleSendMessage = (content: string) => {
    if (!content.trim() || !isConnected) return;

    sendMessage({
      type: 'message.new',
      id: `msg-${Date.now()}`,
      content: content.trim()
    });
  };

  const handleReconnect = () => {
    window.location.reload();
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h2>💬 AI Chat</h2>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className="status-text">
            {connectionState === 'connecting' && 'Connecting...'}
            {connectionState === 'open' && 'Connected'}
            {connectionState === 'closed' && 'Disconnected'}
            {connectionState === 'error' && 'Connection Error'}
          </span>
        </div>
      </div>

      {connectionState === 'connecting' && (
        <div className="chat-loading" role="status">
          <span className="chat-spinner" aria-hidden="true" />
          <span>Connecting to RainbowSmoke AI…</span>
        </div>
      )}

      {connectionState === 'error' && (
        <div className="chat-error persistent">
          <span className="error-icon">⚠️</span>
          Connection lost. Please retry.
          <button className="retry-button" onClick={handleReconnect}>
            Reconnect
          </button>
        </div>
      )}

      {connectionState === 'closed' && (
        <div className="chat-info-banner">
          <span role="img" aria-hidden="true">📡</span>
          You are offline. Messages will resume once the connection is restored.
        </div>
      )}

      {error && (
        <div className="chat-error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {ragContext && ragContext.sources.length > 0 && (
        <div className="rag-context">
          <div className="context-header">
            🔍 Using context from {ragContext.sources.length} source{ragContext.sources.length > 1 ? 's' : ''}
          </div>
          <div className="context-sources">
            {ragContext.sources.slice(0, 3).map((source, index) => (
              <span key={source.id} className="context-badge">
                {source.type} ({(source.score * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      <MessageList messages={messages} streamingMessage={streamingMessage} />

      <MessageInput
        onSend={handleSendMessage}
        disabled={!isConnected}
        placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
      />
    </div>
  );
}
