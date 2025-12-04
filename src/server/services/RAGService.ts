/**
 * RAGService
 * Retrieval-Augmented Generation service combining VectorizeService and AIService
 * Phase 5: AutoRAG Integration
 */

import { VectorizeService, type VectorSearchResult } from './VectorizeService';
import { AIService, type ChatOptions } from './AIService';
import type { ChatMessage } from '../../shared/types';

export interface RAGContext {
  sources: VectorSearchResult[];
  contextText: string;
  relevanceScores: number[];
}

export interface RAGResponse {
  content: string;
  context: RAGContext;
  model: string;
  tokensUsed?: number;
}

export interface RAGOptions extends ChatOptions {
  enableRAG?: boolean;
  maxContext?: number;
  minRelevance?: number;
  includeContext?: boolean;
}

/**
 * RAGService provides retrieval-augmented generation
 * Combines semantic search (Vectorize) with AI generation
 */
export class RAGService {
  private vectorService: VectorizeService;
  private aiService: AIService;

  constructor(
    vectorService: VectorizeService,
    aiService: AIService
  ) {
    this.vectorService = vectorService;
    this.aiService = aiService;
  }

  /**
   * Generate AI response with retrieval-augmented context
   */
  async chat(
    messages: ChatMessage[],
    options: RAGOptions = {}
  ): Promise<ReadableStream | string> {
    const {
      enableRAG = true,
      maxContext = 5,
      minRelevance = 0.7,
      includeContext = true,
      ...aiOptions
    } = options;

    // If RAG is disabled, use AI service directly
    if (!enableRAG) {
      return this.aiService.chat(messages, aiOptions);
    }

    // Get last user message for context retrieval
    const lastUserMessage = this.getLastUserMessage(messages);
    if (!lastUserMessage) {
      // No user message, proceed without RAG
      return this.aiService.chat(messages, aiOptions);
    }

    // Retrieve relevant context from Vectorize
    const context = await this.retrieveContext(
      lastUserMessage.content,
      maxContext,
      minRelevance
    );

    // If no relevant context found, proceed without RAG
    if (context.sources.length === 0) {
      console.log('No relevant context found, proceeding without RAG');
      return this.aiService.chat(messages, aiOptions);
    }

    // Augment messages with retrieved context
    const augmentedMessages = this.augmentMessagesWithContext(
      messages,
      context,
      includeContext
    );

    // Generate response with context
    return this.aiService.chat(augmentedMessages, aiOptions);
  }

  /**
   * Retrieve relevant context from Vectorize indexes
   */
  async retrieveContext(
    query: string,
    maxChunks: number = 5,
    minScore: number = 0.7
  ): Promise<RAGContext> {
    const results = await this.vectorService.getRelevantContext(query, {
      maxChunks,
      minScore
    });

    // Build context text from results
    const contextText = results
      .map((result, index) => {
        const source = result.metadata.type || 'unknown';
        const text = result.metadata.text || '';
        return `[Source ${index + 1}: ${source}, relevance: ${result.score.toFixed(2)}]\n${text}`;
      })
      .join('\n\n');

    return {
      sources: results,
      contextText,
      relevanceScores: results.map(r => r.score)
    };
  }

  /**
   * Augment conversation messages with retrieved context
   */
  private augmentMessagesWithContext(
    messages: ChatMessage[],
    context: RAGContext,
    includeContext: boolean
  ): ChatMessage[] {
    // Create system message with context
    const systemMessage: ChatMessage = {
      id: 'system-context',
      role: 'system',
      content: this.buildSystemPrompt(context, includeContext),
      timestamp: Date.now()
    };

    // Check if there's already a system message
    const hasSystemMessage = messages.some(m => m.role === 'system');

    if (hasSystemMessage) {
      // Replace existing system message
      return [
        systemMessage,
        ...messages.filter(m => m.role !== 'system')
      ];
    } else {
      // Add system message at the beginning
      return [systemMessage, ...messages];
    }
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(context: RAGContext, includeContext: boolean): string {
    let prompt = `You are RainbowSmoke's AI assistant. You help users learn about RainbowSmoke (De Havilland Fox), answer questions about streaming, gaming, tech projects, and services.

IMPORTANT INSTRUCTIONS:
- Use the context below to provide accurate, relevant answers
- If the context doesn't contain relevant information, say so and provide a general answer
- Be helpful, friendly, and conversational
- Reference specific details from the context when applicable
- If asked about streaming schedules, gaming, or tech expertise, use the context`;

    if (includeContext && context.contextText) {
      prompt += `\n\n=== RELEVANT CONTEXT ===\n${context.contextText}\n=== END CONTEXT ===`;
    }

    return prompt;
  }

  /**
   * Get last user message from conversation
   */
  private getLastUserMessage(messages: ChatMessage[]): ChatMessage | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i];
      }
    }
    return null;
  }

  /**
   * Chat with streaming and context tracking
   * Returns stream with context information
   */
  async chatWithContext(
    messages: ChatMessage[],
    options: RAGOptions = {}
  ): Promise<{
    stream: ReadableStream | string;
    context: RAGContext | null;
  }> {
    const {
      enableRAG = true,
      maxContext = 5,
      minRelevance = 0.7,
      ...aiOptions
    } = options;

    // Retrieve context if RAG is enabled
    let context: RAGContext | null = null;
    if (enableRAG) {
      const lastUserMessage = this.getLastUserMessage(messages);
      if (lastUserMessage) {
        context = await this.retrieveContext(
          lastUserMessage.content,
          maxContext,
          minRelevance
        );
      }
    }

    // Augment messages if context was found
    const finalMessages = context && context.sources.length > 0
      ? this.augmentMessagesWithContext(messages, context, true)
      : messages;

    // Generate response
    const stream = await this.aiService.chat(finalMessages, aiOptions);

    return { stream, context };
  }

  /**
   * Hybrid RAG: Combine Vectorize search with optional AI Search/AutoRAG
   * This allows using Cloudflare's managed AutoRAG when available
   */
  async hybridChat(
    messages: ChatMessage[],
    options: RAGOptions & {
      useAutoRAG?: boolean;
      autoRAGName?: string;
    } = {}
  ): Promise<ReadableStream | string> {
    const {
      useAutoRAG = false,
      autoRAGName,
      enableRAG = true,
      ...ragOptions
    } = options;

    // If AutoRAG is not available or disabled, use regular RAG
    if (!useAutoRAG || !autoRAGName) {
      return this.chat(messages, { enableRAG, ...ragOptions });
    }

    // TODO: Implement AI Search/AutoRAG integration when available
    // For now, fall back to regular RAG
    console.log('AutoRAG requested but not yet implemented, using Vectorize RAG');
    return this.chat(messages, { enableRAG, ...ragOptions });
  }

  /**
   * Search knowledge base and return formatted results
   */
  async search(
    query: string,
    options: {
      maxResults?: number;
      minScore?: number;
      indexes?: Array<'profile' | 'content' | 'products'>;
    } = {}
  ): Promise<VectorSearchResult[]> {
    const {
      maxResults = 10,
      minScore = 0.6,
      indexes = ['profile', 'content', 'products']
    } = options;

    // Query all specified indexes
    const allResults = await this.vectorService.queryAll(query, {
      topK: maxResults,
      minScore,
      indexes
    });

    // Flatten and sort by score
    const flatResults = [
      ...allResults.profile || [],
      ...allResults.content || [],
      ...allResults.products || []
    ].sort((a, b) => b.score - a.score);

    return flatResults.slice(0, maxResults);
  }

  /**
   * Get suggested questions based on context
   */
  async getSuggestedQuestions(
    conversationHistory: ChatMessage[],
    count: number = 3
  ): Promise<string[]> {
    // Get last user message
    const lastMessage = this.getLastUserMessage(conversationHistory);
    if (!lastMessage) {
      return this.getDefaultSuggestions();
    }

    // Search for related content
    const results = await this.search(lastMessage.content, {
      maxResults: 5,
      minScore: 0.6
    });

    if (results.length === 0) {
      return this.getDefaultSuggestions();
    }

    // Generate questions based on metadata types
    const suggestions: string[] = [];
    const seenTypes = new Set<string>();

    for (const result of results) {
      const type = result.metadata.type;
      if (type && !seenTypes.has(type) && suggestions.length < count) {
        seenTypes.add(type);

        switch (type) {
          case 'gaming':
            suggestions.push('What games does RainbowSmoke play?');
            break;
          case 'streaming':
            suggestions.push('When does RainbowSmoke stream?');
            break;
          case 'tech':
            suggestions.push('What technologies does RainbowSmoke work with?');
            break;
          case 'social':
            suggestions.push('How can I follow RainbowSmoke on social media?');
            break;
          case 'service':
            suggestions.push('What services does RainbowSmoke offer?');
            break;
          case 'faq':
            suggestions.push('How can I contact RainbowSmoke?');
            break;
        }
      }
    }

    // Fill remaining with defaults if needed
    while (suggestions.length < count) {
      const defaults = this.getDefaultSuggestions();
      const newSuggestion = defaults.find(s => !suggestions.includes(s));
      if (newSuggestion) {
        suggestions.push(newSuggestion);
      } else {
        break;
      }
    }

    return suggestions.slice(0, count);
  }

  /**
   * Get default question suggestions
   */
  private getDefaultSuggestions(): string[] {
    return [
      'Who is RainbowSmoke?',
      'What does RainbowSmoke stream?',
      'How can I contact RainbowSmoke?',
      'What tech projects is RainbowSmoke working on?',
      'Where can I find RainbowSmoke on social media?'
    ];
  }

  /**
   * Analyze query intent to determine best retrieval strategy
   */
  private analyzeQueryIntent(query: string): {
    intent: 'factual' | 'conversational' | 'complex';
    needsContext: boolean;
  } {
    const lowerQuery = query.toLowerCase();

    // Factual queries (who, what, where, when)
    const factualKeywords = ['who', 'what', 'where', 'when', 'which', 'how many'];
    const isFactual = factualKeywords.some(kw => lowerQuery.startsWith(kw));

    // Complex queries (explain, analyze, compare)
    const complexKeywords = ['explain', 'why', 'analyze', 'compare', 'evaluate', 'discuss'];
    const isComplex = complexKeywords.some(kw => lowerQuery.includes(kw));

    // Short conversational queries
    const isShort = query.length < 30;
    const conversationalWords = ['hi', 'hello', 'hey', 'thanks', 'ok', 'cool', 'nice'];
    const isConversational = conversationalWords.some(word => lowerQuery.includes(word));

    if (isFactual) {
      return { intent: 'factual', needsContext: true };
    } else if (isComplex) {
      return { intent: 'complex', needsContext: true };
    } else if (isConversational && isShort) {
      return { intent: 'conversational', needsContext: false };
    } else {
      return { intent: 'conversational', needsContext: true };
    }
  }
}
