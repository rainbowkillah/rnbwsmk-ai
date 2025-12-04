/**
 * MessageList Component
 * Displays chat messages with auto-scroll
 */

import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../../shared/types';

interface MessageListProps {
  messages: ChatMessage[];
  streamingMessage?: ChatMessage | null;
}

export default function MessageList({ messages, streamingMessage }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages or streaming content arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💭</div>
          <p>No messages yet. Start a conversation!</p>
        </div>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            className={`message message-${message.role}`}
          >
            <div className="message-header">
              <span className="message-role">
                {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
              </span>
              <span className="message-timestamp">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            <div className="message-content">
              {message.content}
            </div>
            {message.model && (
              <div className="message-meta">
                <span className="message-model">Model: {message.model}</span>
              </div>
            )}
          </div>
        ))
      )}

      {/* Streaming message (AI is typing) */}
      {streamingMessage && (
        <div className="message message-assistant message-streaming">
          <div className="message-header">
            <span className="message-role">🤖 Assistant</span>
            <span className="message-timestamp">
              {formatTimestamp(streamingMessage.timestamp)}
            </span>
          </div>
          <div className="message-content">
            {streamingMessage.content}
            <span className="streaming-cursor">▊</span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
