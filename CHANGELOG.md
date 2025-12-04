# Changelog

All notable changes to rnbwsmk-ai will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features

#### Phase 2: WebSocket Chat
- AIChatRoom Durable Object with SQL storage
- PartyKit WebSocket integration
- Message persistence
- React frontend with chat UI

#### Phase 3: AI Integration
- AIService with Workers AI (Llama 3.3)
- Streaming response handling
- AI Gateway configuration
- Multi-model support (Llama, GPT-4o, Claude)

#### Phase 4: Vectorize Setup
- Three Vectorize indexes (profile, content, products)
- VectorizeService implementation
- Text chunking and embedding generation
- Initial data seeding from profile

#### Phase 5: AutoRAG Integration
- R2 bucket for document storage
- AI Search (AutoRAG) setup
- AutoRAGService implementation
- Context-aware responses

#### Phase 6: Site Integration
- Service binding with rainbowsmokeofficial.com
- Floating chat widget
- Dedicated /chat page
- API proxy

#### Phase 7: Advanced Features
- Calendar scheduling API
- Browser rendering for site crawling
- Search UI components
- Recommendations

#### Phase 8: Polish & Optimization
- Rate limiting service
- Caching layers
- Error handling improvements
- Performance optimization
- Comprehensive testing

#### Phase 9: Deployment
- Production deployment
- Custom domain configuration
- Monitoring and analytics

#### Future Enhancements (Post-Launch)
- Voice transcription (Whisper model)
- Google Calendar sync
- Advanced recommendation engine
- User analytics dashboard
- Mobile app (React Native)
- Multi-language support

---

## [0.1.0] - 2025-12-04

### Added - Phase 1: Foundation

#### Project Structure
- Complete directory structure for server, client, and shared code
- Organized folders for Durable Objects, API handlers, services, and utilities
- React component structure with Chat, Search, and Calendar sections

#### Configuration
- `package.json` with all required dependencies:
  - Runtime: `@cloudflare/ai`, `partyserver`, `partysocket`
  - Frontend: `react@18`, `react-dom@18`, `react-router@7`
  - Build: `esbuild`, `typescript@5.9`, `wrangler@4.52`
  - Testing: `vitest`, `@cloudflare/vitest-pool-workers`
- `wrangler.jsonc` with complete Cloudflare configuration:
  - Durable Objects bindings (AIChatRoom, UserSession)
  - Workers AI binding
  - Vectorize indexes (3): profile-data, site-content, products
  - Browser Rendering binding
  - R2 bucket binding for document storage
  - Environment variables for models and gateway
- `tsconfig.json` with strict TypeScript configuration

#### Worker Implementation
- Main entry point (`src/server/index.ts`) with routing:
  - Health check endpoint (`/health`)
  - Status endpoint (`/api/status`)
  - PartyKit WebSocket routing (`/party/chat/:room_id`)
  - Static asset serving
- Stub Durable Objects:
  - `AIChatRoom` with hibernation enabled
  - `UserSession` for session management
- Shared types and constants:
  - `ChatMessage`, `Conversation`, `VectorMatch` types
  - `WSMessageType` union for WebSocket messages
  - Rate limiting and caching constants
  - Model tier definitions (free vs premium)

#### Documentation
- Comprehensive `README.md` with:
  - Feature list
  - Architecture overview
  - Tech stack details
  - Installation instructions
  - Development guide
  - API endpoint documentation
  - Integration strategy
  - Cost optimization notes
  - Current phase status
- `CHANGELOG.md` following Keep a Changelog format
- `.gitignore` for Node.js, TypeScript, and Cloudflare Workers

#### Version Control
- Git repository initialized
- Initial commit with all foundation files

### Technical Details

#### Bindings Configured
- **AI**: Workers AI for Llama, Mistral models
- **Vectorize**: Three indexes for specialized content
- **Durable Objects**: AIChatRoom, UserSession with SQL storage
- **Browser**: For web scraping and screenshots
- **R2**: Document storage bucket (rnbwsmk-knowledge-base)

#### Models Configured
- Default: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (free)
- Premium: `openai/gpt-4o` (paid, via AI Gateway)
- Embedding: `@cf/baai/bge-base-en-v1.5`

#### Development Setup
- ES2021+ target
- Strict TypeScript with isolatedModules
- React JSX transform
- ESBuild for frontend bundling
- Source maps enabled for debugging

### Notes

This initial release establishes the project foundation and prepares for Phase 2 implementation (WebSocket Chat). The worker can be deployed but most features are not yet implemented.

---

## Development Timeline

- **2025-12-04**: Phase 1 (Foundation) - ✅ Complete
- **Next**: Phase 2 (WebSocket Chat)
- **Future**: Phases 3-9 (See Unreleased section above)

---

**Project**: rnbwsmk-ai
**Author**: De Havilland Fox (RainbowSmoke)
**Platform**: Cloudflare Workers
