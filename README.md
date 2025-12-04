# rnbwsmk-ai

<div align="center">

**AI Assistant for RainbowSmoke Official**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)

A sophisticated AI assistant combining real-time chat, semantic search, and retrieval-augmented generation for rainbowsmokeofficial.com

</div>

---

## Features

- 🤖 **Multi-Model AI Chat** - Llama 3.3 (free) with GPT-4o/Claude fallback
- 💬 **Real-Time Communication** - WebSockets via PartyKit with Durable Objects
- 🧠 **Knowledge Base** - Cloudflare Vectorize for semantic search
- 🔍 **AI Search (AutoRAG)** - Automatic retrieval-augmented generation
- 🌐 **AI Gateway** - Unified multi-model orchestration
- 📅 **Calendar Assistant** - Scheduling and agenda management
- 🎨 **Browser Rendering** - Web scraping and screenshots
- ⚡ **Edge Computing** - Global deployment on Cloudflare's network

## Architecture

```
rnbwsmk-ai Worker (Cloudflare Workers)
├── WebSocket Chat (Durable Objects + PartyKit)
├── AI Services (Workers AI + AI Gateway)
├── Vector Knowledge Base (Vectorize - 3 indexes)
├── AI Search/AutoRAG (Automatic retrieval)
└── React Frontend (ESBuild)
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Cloudflare Workers |
| Frontend | React 18 + TypeScript |
| Build | ESBuild |
| WebSockets | PartyKit |
| Persistence | Durable Objects SQL |
| AI Models | Workers AI (Llama 3.3) + AI Gateway (GPT-4o, Claude) |
| Vector DB | Cloudflare Vectorize |
| RAG | Cloudflare AI Search (AutoRAG) |
| Browser | Cloudflare Browser Rendering |
| Storage | R2 Object Storage |

## Getting Started

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers Paid plan
- Wrangler CLI: `npm install -g wrangler`

### Installation

1. **Clone the repository**
   ```bash
   cd ~/projects/ai/rnbwsmk-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Cloudflare resources**
   ```bash
   # Create Vectorize indexes
   npm run setup:vectorize

   # Or manually:
   wrangler vectorize create rnbwsmk-profile-data --dimensions=768 --metric=cosine
   wrangler vectorize create rnbwsmk-site-content --dimensions=768 --metric=cosine
   wrangler vectorize create rnbwsmk-products --dimensions=768 --metric=cosine

   # Create R2 bucket
   wrangler r2 bucket create rnbwsmk-knowledge-base
   ```

4. **Configure AI Gateway**
   - Navigate to [Cloudflare Dashboard → AI Gateway](https://dash.cloudflare.com/)
   - Create new gateway: `rnbwsmk-ai-gateway`
   - Enable caching (TTL: 3600s)
   - Enable rate limiting

5. **Set up AI Search**
   - Navigate to Cloudflare Dashboard → AI → AI Search
   - Create AI Search instance: `rnbwsmk-search`
   - Connect to R2 bucket: `rnbwsmk-knowledge-base`
   - Link to AI Gateway: `rnbwsmk-ai-gateway`

6. **Configure secrets**
   ```bash
   wrangler secret put OPENAI_API_KEY
   wrangler secret put ANTHROPIC_API_KEY
   ```

7. **Seed initial data**
   ```bash
   npm run seed
   ```

8. **Start development server**
   ```bash
   npm run dev
   ```

   Visit: http://localhost:8787

## Development

### Available Scripts

```bash
npm run dev              # Start local development server
npm run dev:remote       # Dev server with remote resources
npm run build:client     # Build React frontend
npm run cf-typegen       # Generate TypeScript types
npm run check            # Type check + dry-run deploy
npm run test             # Run tests
npm run test:watch       # Watch mode
npm run deploy           # Deploy to production
npm run deploy:staging   # Deploy to staging
```

### Project Structure

```
rnbwsmk-ai/
├── src/
│   ├── server/          # Worker backend
│   │   ├── index.ts     # Entry point
│   │   ├── durable-objects/
│   │   ├── api/         # API handlers
│   │   ├── services/    # AI, Vectorize, AutoRAG services
│   │   └── utils/       # Utilities
│   ├── client/          # React frontend
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom hooks
│   │   └── styles/      # CSS
│   └── shared/          # Shared types & constants
├── scripts/             # Setup & seeding scripts
├── public/              # Static assets
└── wrangler.jsonc       # Cloudflare configuration
```

## API Endpoints

### Public Endpoints

```
GET  /health                        → Health check
GET  /api/status                    → Service status
WS   /party/chat/:room_id           → WebSocket chat
POST /api/chat                      → Send message (SSE streaming)
GET  /api/conversations             → List conversations
POST /api/search                    → Search knowledge base
GET  /api/calendar                  → Get events
POST /api/vectorize/upsert          → Add documents
```

See [full API documentation](#) for more details.

## Integration with rainbowsmokeofficial.com

This worker integrates with the main site via:

1. **Floating chat widget** - Embedded on all pages
2. **Dedicated /chat page** - Full-featured chat interface
3. **Service binding** - Direct worker-to-worker communication

## Cost Optimization

- **Tiered Model Strategy**: Free Llama 3.3 for basic queries, premium models only when needed
- **WebSocket Hibernation**: Automatic hibernation reduces Duration (GB-s) costs
- **Caching**: AI Gateway (1h), Vectorize queries (30m), static assets (24h)
- **Rate Limiting**: Industry-standard limits prevent abuse

## Deployment

### Production Deployment

```bash
npm run deploy
```

This will:
1. Build the React frontend
2. Deploy worker to Cloudflare
3. Update bindings and environment variables

### Custom Domain

Configure custom domain in Cloudflare Dashboard:
- Recommended: `ai.rainbowsmokeofficial.com`

## Monitoring

View logs in real-time:
```bash
wrangler tail
```

Access metrics in Cloudflare Dashboard:
- Analytics → Workers & Pages → rnbwsmk-ai

## Contributing

This is a personal project for rainbowsmokeofficial.com.

## License

MIT © De Havilland Fox (RainbowSmoke)

---

## Development Status

### Current Phase: Phase 1 - Foundation ✅

- [x] Project structure created
- [x] Package.json with dependencies
- [x] Wrangler configuration
- [x] TypeScript configuration
- [x] Basic worker entry point
- [x] Git repository initialized
- [x] Initial documentation

### Next Phase: Phase 2 - WebSocket Chat

- [ ] AIChatRoom Durable Object implementation
- [ ] SQL schema for conversations and messages
- [ ] PartyKit WebSocket handlers
- [ ] Basic React frontend
- [ ] Message persistence

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

---

**Built with ❤️ by RainbowSmoke using Cloudflare Workers**
