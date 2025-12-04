/**
 * MessageList Component
 * Displays chat messages with auto-scroll
 */

import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../../shared/types';

interface MessageListProps {
  messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      <div ref={messagesEndRef} />
    </div>
  );
}
