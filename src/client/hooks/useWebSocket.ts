/**
 * useWebSocket Hook
 * Manages WebSocket connection with auto-reconnect logic
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WSMessageType } from '../../shared/types';

interface UseWebSocketOptions {
  roomId: string;
  onMessage?: (message: WSMessageType) => void;
  onConnectionChange?: (connected: boolean) => void;
}

type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

export function useWebSocket({ roomId, onMessage, onConnectionChange }: UseWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');

  const sendMessage = useCallback((message: WSMessageType) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${window.location.host}/party/chat/${encodeURIComponent(roomId)}`;

    let retryAttempts = 0;
    let reconnectTimer: number | null = null;
    let isUnmounted = false;

    const connect = () => {
      setConnectionState('connecting');
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        if (isUnmounted) return;
        retryAttempts = 0;
        console.log('WebSocket connected');
        setConnectionState('open');
        onConnectionChange?.(true);
      });

      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data) as WSMessageType;
          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      socket.addEventListener('close', () => {
        if (isUnmounted) return;
        console.log('WebSocket disconnected');
        setConnectionState('closed');
        onConnectionChange?.(false);

        retryAttempts = Math.min(retryAttempts + 1, 5);
        const delay = Math.min(1000 * 2 ** retryAttempts, 10000);
        reconnectTimer = window.setTimeout(connect, delay);
      });

      socket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        setConnectionState('error');
        onConnectionChange?.(false);
        socket.close();
      });
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      socketRef.current = null;
    };
  }, [roomId, onMessage, onConnectionChange]);

  return {
    sendMessage,
    connectionState,
    isConnected: connectionState === 'open'
  };
}
