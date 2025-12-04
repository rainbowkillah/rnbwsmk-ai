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
          <h3>✅ Phase 6: Site Integration Complete</h3>
          <ul>
            <li>Floating chat widget on rainbowsmokeofficial.com</li>
            <li>Full-page /chat route with iframe embed</li>
            <li>API proxy endpoints for seamless communication</li>
            <li>Service binding between main site and AI worker</li>
            <li>Mobile-responsive design with smooth animations</li>
          </ul>

          <h3>✅ Previous Features:</h3>
          <ul>
            <li>Retrieval-augmented generation with vector knowledge base</li>
            <li>Context-aware AI responses using Vectorize search</li>
            <li>Real-time context display showing relevant sources</li>
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
