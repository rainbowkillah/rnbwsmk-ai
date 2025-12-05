/**
 * AIService
 * Multi-model AI orchestration with Workers AI and AI Gateway
 * Phase 3: AI Integration
 */

import type { ChatMessage } from '../../shared/types';

export interface ChatOptions {
  model?: string;
  usePremium?: boolean;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  gateway?: {
    id: string;
    cacheTtl?: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

/**
 * AIService handles all AI model interactions
 * Supports both Workers AI (free) and AI Gateway (premium)
 */
export class AIService {
  private ai: Ai;
  private gatewayId: string;

  // Model tier configuration
  private readonly MODEL_TIERS = {
    free: [
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/mistral/mistral-7b-instruct-v0.1'
    ],
    premium: [
      'openai/gpt-4o',
      'anthropic/claude-sonnet-4-5'
    ]
  } as const;

  constructor(ai: Ai, gatewayId: string) {
    this.ai = ai;
    this.gatewayId = gatewayId;
  }

  /**
   * Send a chat request with optional streaming
   */
  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<ReadableStream<StreamChunk> | string> {
    const selectedModel = this.selectModel(messages, options);
    const isPremium = this.isPremiumModel(selectedModel);

    // Convert to AI format
    const aiMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));

    if (options.stream) {
      return this.streamChat(selectedModel, aiMessages, options, isPremium);
    } else {
      return this.nonStreamChat(selectedModel, aiMessages, options, isPremium);
    }
  }

  /**
   * Streaming chat response
   */
  private async streamChat(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options: ChatOptions,
    isPremium: boolean
  ): Promise<ReadableStream<StreamChunk>> {
    if (isPremium) {
      // Use AI Gateway for premium models
      return this.streamViaGateway(model, messages, options);
    } else {
      // Use Workers AI for free models
      return this.streamViaWorkersAI(model, messages, options);
    }
  }

  /**
   * Non-streaming chat response
   */
  private async nonStreamChat(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options: ChatOptions,
    isPremium: boolean
  ): Promise<string> {
    if (isPremium) {
      const stream = await this.streamViaGateway(model, messages, options);
      return this.consumeStream(stream);
    } else {
      const response = await this.ai.run(model as any, {
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024
      });

      return (response as any).response || '';
    }
  }

  /**
   * Stream via Workers AI (free models)
   */
  private async streamViaWorkersAI(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options: ChatOptions
  ): Promise<ReadableStream<StreamChunk>> {
    const response = await this.ai.run(model as any, {
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
      stream: true
    });

    // Transform Workers AI stream to our format
    const aiStream = (response as any) as ReadableStream;

    return new ReadableStream<StreamChunk>({
      async start(controller) {
        const reader = aiStream.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.enqueue({ content: '', done: true });
              controller.close();
              break;
            }

            // Parse SSE format from Workers AI
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.response) {
                    controller.enqueue({
                      content: data.response,
                      done: false
                    });
                  }
                } catch (e) {
                  // Skip invalid JSON
                  console.warn('Failed to parse AI chunk:', e);
                }
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  /**
   * Stream via AI Gateway (premium models)
   */
  private async streamViaGateway(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options: ChatOptions
  ): Promise<ReadableStream<StreamChunk>> {
    // Determine provider from model string
    const provider = model.includes('openai') ? 'openai'
                   : model.includes('anthropic') ? 'anthropic'
                   : 'openai';

    const actualModel = model.split('/').pop() || model;

    // Construct AI Gateway URL
    const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${this.gatewayId}/${provider}/chat/completions`;

    const cacheKey = await this.buildGatewayCacheKey(model, messages);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'cf-aig-cache-ttl': String(options.gateway?.cacheTtl ?? 3600)
    };

    if (cacheKey) {
      headers['cf-aig-cache-key'] = cacheKey;
    }

    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: actualModel,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.status} ${response.statusText}`);
    }

    const stream = response.body;
    if (!stream) {
      throw new Error('No response body from AI Gateway');
    }

    // Transform AI Gateway stream to our format
    return new ReadableStream<StreamChunk>({
      async start(controller) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.enqueue({ content: '', done: true });
              controller.close();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);

                if (data === '[DONE]') {
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;

                  if (content) {
                    controller.enqueue({
                      content,
                      done: false
                    });
                  }
                } catch (e) {
                  // Skip invalid JSON
                  console.warn('Failed to parse gateway chunk:', e);
                }
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  /**
   * Select appropriate model based on query complexity and options
   */
  private selectModel(messages: ChatMessage[], options: ChatOptions): string {
    // Explicit model specified
    if (options.model) {
      return options.model;
    }

    // Explicit premium requested
    if (options.usePremium) {
      return this.MODEL_TIERS.premium[0];
    }

    // Analyze last message for complexity
    const lastMessage = messages[messages.length - 1]?.content || '';
    const isComplex = this.isComplexQuery(lastMessage);

    // Use premium for complex queries, free for simple ones
    return isComplex
      ? this.MODEL_TIERS.premium[0]
      : this.MODEL_TIERS.free[0];
  }

  /**
   * Determine if a query is complex enough to warrant premium model
   */
  private isComplexQuery(query: string): boolean {
    const complexIndicators = [
      'analyze',
      'explain in detail',
      'write code',
      'generate',
      'create a',
      'design',
      'implement',
      'compare',
      'evaluate'
    ];

    const lowerQuery = query.toLowerCase();

    // Long queries are often complex
    if (query.length > 500) return true;

    // Check for complex keywords
    return complexIndicators.some(indicator => lowerQuery.includes(indicator));
  }

  /**
   * Check if a model is premium
   */
  private isPremiumModel(model: string): boolean {
    return this.MODEL_TIERS.premium.some(m => model.includes(m));
  }

  /**
   * Consume entire stream into a string (for non-streaming mode)
   */
  private async consumeStream(stream: ReadableStream<StreamChunk>): Promise<string> {
    const reader = stream.getReader();
    let result = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done || value.done) break;

        result += value.content;
      }
    } finally {
      reader.releaseLock();
    }

    return result;
  }

  /**
   * Get list of available models
   */
  getAvailableModels(): { free: readonly string[]; premium: readonly string[] } {
    return {
      free: this.MODEL_TIERS.free,
      premium: this.MODEL_TIERS.premium
    };
  }

  private async buildGatewayCacheKey(
    model: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    try {
      const payload = JSON.stringify({ model, messages });
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
      return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      console.warn('Failed to build AI Gateway cache key:', error);
      return '';
    }
  }
}
