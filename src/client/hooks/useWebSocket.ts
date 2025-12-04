/**
 * useWebSocket Hook
 * Manages WebSocket connection with PartySocket
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import PartySocket from 'partysocket';
import type { WSMessageType } from '../../shared/types';

interface UseWebSocketOptions {
  roomId: string;
  onMessage?: (message: WSMessageType) => void;
  onConnectionChange?: (connected: boolean) => void;
}

type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

export function useWebSocket({ roomId, onMessage, onConnectionChange }: UseWebSocketOptions) {
  const socketRef = useRef<PartySocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');

  const sendMessage = useCallback((message: WSMessageType) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }, []);

  useEffect(() => {
    // Determine WebSocket URL based on environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    // Create PartySocket connection
    const socket = new PartySocket({
      host,
      room: roomId,
      path: '/party/chat',
      protocol
    });

    socketRef.current = socket;

    // Connection opened
    socket.addEventListener('open', () => {
      console.log('WebSocket connected');
      setConnectionState('open');
      onConnectionChange?.(true);
    });

    // Handle incoming messages
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessageType;
        onMessage?.(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    // Connection closed
    socket.addEventListener('close', () => {
      console.log('WebSocket disconnected');
      setConnectionState('closed');
      onConnectionChange?.(false);
    });

    // Connection error
    socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      setConnectionState('error');
      onConnectionChange?.(false);
    });

    // Cleanup on unmount
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [roomId, onMessage, onConnectionChange]);

  return {
    sendMessage,
    connectionState,
    isConnected: connectionState === 'open'
  };
}
