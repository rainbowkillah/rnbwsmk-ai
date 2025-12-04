/**
 * ChatWindow Component
 * Main chat interface container
 */

import React, { useState, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { ChatMessage } from '../../../shared/types';

interface ChatWindowProps {
  roomId?: string;
}

export default function ChatWindow({ roomId = 'default' }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sendMessage, connectionState } = useWebSocket({
    roomId,
    onMessage: (message) => {
      // Handle incoming messages from WebSocket
      if (message.type === 'history') {
        setMessages(message.messages);
      } else if (message.type === 'message.add') {
        setMessages(prev => [...prev, message.message]);
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

      {error && (
        <div className="chat-error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <MessageList messages={messages} />

      <MessageInput
        onSend={handleSendMessage}
        disabled={!isConnected}
        placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
      />
    </div>
  );
}
