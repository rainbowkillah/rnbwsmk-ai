/**
 * Main Application Component
 * Phase 2: Real-time WebSocket chat
 */

import React from 'react';
import ChatWindow from './components/Chat/ChatWindow';
import './styles/main.css';
import './styles/chat.css';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>🤖 rnbwsmk-ai</h1>
        <p>AI Assistant for RainbowSmoke Official</p>
      </header>

      <main className="main">
        <ChatWindow roomId="default" />

        <div className="info-card">
          <h3>✅ Phase 2: WebSocket Chat Complete</h3>
          <ul>
            <li>Real-time messaging with message persistence</li>
            <li>Conversation history saved to Durable Objects SQL</li>
            <li>Echo responses (AI integration coming in Phase 3)</li>
          </ul>

          <h3>📋 Test Endpoints:</h3>
          <ul>
            <li><a href="/health" target="_blank">/health</a> - Health check</li>
            <li><a href="/api/status" target="_blank">/api/status</a> - Service status</li>
          </ul>
        </div>
      </main>

      <footer className="footer">
        <p>Built with ❤️ by RainbowSmoke using Cloudflare Workers</p>
      </footer>
    </div>
  );
}
