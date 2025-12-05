/**
 * Main Application Component
 * Phase 3: AI Integration with streaming
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
          <h3>⚙️ Phase 8: Polish & Optimization</h3>
          <ul>
            <li>Adaptive rate limiting across chat, calendar, and HTTP APIs</li>
            <li>Vectorize memoization + AI Gateway cache keys for faster replies</li>
            <li>Enhanced chat UX with loading states and reconnect flows</li>
          </ul>

          <h3>✅ Phase 7: Advanced Features Complete</h3>
          <ul>
            <li>Calendar scheduling with event management (WebSocket API)</li>
            <li>Enhanced semantic search with recommendations</li>
            <li>Browser rendering for web crawling and scraping</li>
            <li>React search components with real-time results</li>
            <li>3 new services: CalendarService, SearchService, BrowserService</li>
          </ul>

          <h3>✅ Previous Features:</h3>
          <ul>
            <li>Site integration with floating chat widget</li>
            <li>Retrieval-augmented generation with vector knowledge base</li>
            <li>Context-aware AI responses using Vectorize search</li>
            <li>Real AI responses with Workers AI (Llama 3.3-70b)</li>
            <li>Streaming responses with live updates</li>
            <li>Multi-model support (free Llama + premium GPT-4o/Claude)</li>
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
