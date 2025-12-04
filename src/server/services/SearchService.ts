/**
 * SearchService
 * Enhanced semantic search with filtering and ranking
 * Phase 7: Advanced Features
 */

import { VectorizeService, type VectorSearchResult } from './VectorizeService';

export interface SearchQuery {
  query: string;
  filters?: {
    type?: string;
    category?: string;
    minScore?: number;
    indexTypes?: Array<'profile' | 'content' | 'products'>;
  };
  limit?: number;
  includeMetadata?: boolean;
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  type: string;
  category?: string;
  url?: string;
  metadata?: Record<string, any>;
  highlight?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  took: number;
}

export class SearchService {
  private vectorService: VectorizeService;

  constructor(vectorService: VectorizeService) {
    this.vectorService = vectorService;
  }

  /**
   * Perform semantic search across all indexes
   */
  async search(searchQuery: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    const {
      query,
      filters = {},
      limit = 10,
      includeMetadata = true
    } = searchQuery;

    // Determine which indexes to search
    const indexTypes = filters.indexTypes || ['profile', 'content', 'products'];

    // Perform vector search
    const vectorResults = await this.vectorService.getRelevantContext(query, {
      maxChunks: limit * 2, // Get extra results for filtering
      minScore: filters.minScore || 0.5
    });

    // Apply filters
    let filteredResults = vectorResults;

    if (filters.type) {
      filteredResults = filteredResults.filter(r =>
        r.metadata.type === filters.type
      );
    }

    if (filters.category) {
      filteredResults = filteredResults.filter(r =>
        r.metadata.category === filters.category
      );
    }

    // Limit results
    const limitedResults = filteredResults.slice(0, limit);

    // Format results
    const searchResults: SearchResult[] = limitedResults.map(result => ({
      id: result.id,
      text: result.metadata.text,
      score: result.score,
      type: result.metadata.type,
      category: result.metadata.category,
      url: result.metadata.url,
      metadata: includeMetadata ? result.metadata : undefined,
      highlight: this.generateHighlight(result.metadata.text, query)
    }));

    const took = Date.now() - startTime;

    return {
      query,
      results: searchResults,
      total: searchResults.length,
      took
    };
  }

  /**
   * Search specific content types
   */
  async searchByType(
    query: string,
    type: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    const response = await this.search({
      query,
      filters: { type },
      limit
    });

    return response.results;
  }

  /**
   * Get recommendations based on a query
   */
  async getRecommendations(
    query: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    // Search across all content for recommendations
    const response = await this.search({
      query,
      filters: {
        minScore: 0.65, // Higher threshold for recommendations
        indexTypes: ['content', 'products']
      },
      limit
    });

    return response.results;
  }

  /**
   * Search for similar content to a given text
   */
  async findSimilar(
    text: string,
    limit: number = 5,
    excludeId?: string
  ): Promise<SearchResult[]> {
    const response = await this.search({
      query: text,
      limit: limit + (excludeId ? 1 : 0)
    });

    // Filter out the excluded ID
    let results = response.results;
    if (excludeId) {
      results = results.filter(r => r.id !== excludeId);
    }

    return results.slice(0, limit);
  }

  /**
   * Search with faceted results (grouped by type)
   */
  async searchWithFacets(query: string, limit: number = 10): Promise<{
    all: SearchResult[];
    facets: Record<string, SearchResult[]>;
  }> {
    const response = await this.search({ query, limit: limit * 2 });

    // Group results by type
    const facets: Record<string, SearchResult[]> = {};

    for (const result of response.results) {
      if (!facets[result.type]) {
        facets[result.type] = [];
      }
      facets[result.type].push(result);
    }

    return {
      all: response.results.slice(0, limit),
      facets
    };
  }

  /**
   * Generate highlighted snippet for search result
   */
  private generateHighlight(text: string, query: string, maxLength: number = 200): string {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Find query position
    const queryIndex = lowerText.indexOf(lowerQuery);

    if (queryIndex === -1) {
      // Query not found exactly, return beginning
      return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
    }

    // Calculate snippet boundaries
    const snippetStart = Math.max(0, queryIndex - 50);
    const snippetEnd = Math.min(text.length, queryIndex + query.length + 150);

    let snippet = text.substring(snippetStart, snippetEnd);

    // Add ellipsis if truncated
    if (snippetStart > 0) snippet = '...' + snippet;
    if (snippetEnd < text.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Get search suggestions/autocomplete
   */
  async getSuggestions(prefix: string, limit: number = 5): Promise<string[]> {
    // For now, return empty - would need a separate suggestions index
    // This could be implemented with common queries or document titles
    return [];
  }

  /**
   * Get popular searches (placeholder for analytics)
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    // Placeholder - would track searches in analytics
    return [
      'RainbowSmoke gaming',
      'streaming schedule',
      'tech tutorials',
      'contact information',
      'social media links'
    ].slice(0, limit);
  }
}
