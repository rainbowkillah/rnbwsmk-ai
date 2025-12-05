/**
 * VectorizeService
 * Handles vector embeddings and semantic search across multiple indexes
 * Phase 4: Vectorize Setup
 */

export interface VectorMetadata {
  id: string;
  text: string;
  type?: string;
  category?: string;
  url?: string;
  [key: string]: any;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: Record<string, any>;
}

export type IndexType = 'profile' | 'content' | 'products';

interface VectorCacheEntry<T> {
  data: T;
  expiresAt: number;
}

type VectorCacheGlobal = typeof globalThis & {
  __RNBWSMK_VECTOR_CACHE__?: Map<string, VectorCacheEntry<any>>;
};

const getVectorCache = () => {
  const target = globalThis as VectorCacheGlobal;
  if (!target.__RNBWSMK_VECTOR_CACHE__) {
    target.__RNBWSMK_VECTOR_CACHE__ = new Map();
  }
  return target.__RNBWSMK_VECTOR_CACHE__;
};

const vectorCache = getVectorCache();

interface VectorizeServiceOptions {
  enableCache?: boolean;
  cacheTtlMs?: number;
  maxCacheEntries?: number;
}

/**
 * VectorizeService manages vector operations across multiple indexes
 */
export class VectorizeService {
  private ai: Ai;
  private indexes: {
    profile: VectorizeIndex;
    content: VectorizeIndex;
    products: VectorizeIndex;
  };
  private embeddingModel: string;
  private cache: Map<string, VectorCacheEntry<any>>;
  private cacheEnabled: boolean;
  private cacheTtlMs: number;
  private maxCacheEntries: number;

  constructor(
    ai: Ai,
    profileIndex: VectorizeIndex,
    contentIndex: VectorizeIndex,
    productsIndex: VectorizeIndex,
    embeddingModel: string = '@cf/baai/bge-base-en-v1.5',
    options: VectorizeServiceOptions = {}
  ) {
    this.ai = ai;
    this.indexes = {
      profile: profileIndex,
      content: contentIndex,
      products: productsIndex
    };
    this.embeddingModel = embeddingModel;
    this.cache = vectorCache;
    this.cacheEnabled = options.enableCache ?? true;
    this.cacheTtlMs = options.cacheTtlMs ?? 45_000;
    this.maxCacheEntries = options.maxCacheEntries ?? 256;
  }

  /**
   * Generate embedding vector for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.ai.run(this.embeddingModel as any, {
        text: [text]
      });

      // Extract embedding from response
      const embedding = (response as any).data?.[0];

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from AI');
      }

      return embedding;
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error(`Failed to generate embedding: ${(error as Error).message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.ai.run(this.embeddingModel as any, {
        text: texts
      });

      const embeddings = (response as any).data;

      if (!embeddings || !Array.isArray(embeddings)) {
        throw new Error('Invalid embeddings response from AI');
      }

      return embeddings;
    } catch (error) {
      console.error('Batch embedding generation error:', error);
      throw new Error(`Failed to generate embeddings: ${(error as Error).message}`);
    }
  }

  /**
   * Upsert a single document to an index
   */
  async upsertDocument(
    indexType: IndexType,
    document: DocumentChunk
  ): Promise<void> {
    const embedding = await this.generateEmbedding(document.text);

    await this.indexes[indexType].upsert([
      {
        id: document.id,
        values: embedding,
        metadata: {
          ...document.metadata,
          text: document.text,
          id: document.id
        }
      }
    ]);
  }

  /**
   * Upsert multiple documents to an index in batch
   */
  async upsertDocuments(
    indexType: IndexType,
    documents: DocumentChunk[]
  ): Promise<void> {
    if (documents.length === 0) return;

    // Generate embeddings for all documents
    const texts = documents.map(doc => doc.text);
    const embeddings = await this.generateEmbeddings(texts);

    // Prepare vectors for upsert
    const vectors = documents.map((doc, i) => ({
      id: doc.id,
      values: embeddings[i],
      metadata: {
        ...doc.metadata,
        text: doc.text,
        id: doc.id
      }
    }));

    // Batch upsert (Vectorize handles batches efficiently)
    await this.indexes[indexType].upsert(vectors);
  }

  /**
   * Query an index for relevant documents
   */
  async query(
    indexType: IndexType,
    queryText: string,
    options: {
      topK?: number;
      filter?: Record<string, any>;
      minScore?: number;
    } = {}
  ): Promise<VectorSearchResult[]> {
    const {
      topK = 5,
      filter,
      minScore = 0.0
    } = options;

    const cacheKey = this.buildCacheKey('query', [
      indexType,
      queryText,
      String(topK),
      String(minScore),
      filter ? this.stableSerialize(filter) : ''
    ]);

    const cached = this.getCached<VectorSearchResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(queryText);

    // Query the index
    const results = await this.indexes[indexType].query(queryEmbedding, {
      topK,
      filter,
      returnMetadata: 'all'
    });

    // Transform and filter results
    const transformed = results.matches
      .filter(match => match.score >= minScore)
      .map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata as VectorMetadata
      }));

    this.setCached(cacheKey, transformed);
    return transformed;
  }

  /**
   * Query multiple indexes and merge results
   */
  async queryAll(
    queryText: string,
    options: {
      topK?: number;
      minScore?: number;
      indexes?: IndexType[];
    } = {}
  ): Promise<Record<IndexType, VectorSearchResult[]>> {
    const {
      topK = 5,
      minScore = 0.0,
      indexes = ['profile', 'content', 'products']
    } = options;

    // Query all specified indexes in parallel
    const results = await Promise.all(
      indexes.map(indexType =>
        this.query(indexType, queryText, { topK, minScore })
      )
    );

    // Map results back to index types
    return indexes.reduce((acc, indexType, i) => {
      acc[indexType] = results[i];
      return acc;
    }, {} as Record<IndexType, VectorSearchResult[]>);
  }

  /**
   * Get relevant context for AI chat from all indexes
   * Returns top-k most relevant chunks across all indexes
   */
  async getRelevantContext(
    query: string,
    options: {
      maxChunks?: number;
      minScore?: number;
    } = {}
  ): Promise<VectorSearchResult[]> {
    const {
      maxChunks = 5,
      minScore = 0.7
    } = options;

    const cacheKey = this.buildCacheKey('context', [query, String(maxChunks), String(minScore)]);
    const cached = this.getCached<VectorSearchResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Query all indexes
    const allResults = await this.queryAll(query, {
      topK: maxChunks,
      minScore
    });

    // Flatten and sort by score
    const flatResults = [
      ...allResults.profile,
      ...allResults.content,
      ...allResults.products
    ].sort((a, b) => b.score - a.score);

    // Return top results
    const topResults = flatResults.slice(0, maxChunks);
    this.setCached(cacheKey, topResults);
    return topResults;
  }

  /**
   * Delete a vector from an index
   */
  async deleteVector(indexType: IndexType, id: string): Promise<void> {
    await this.indexes[indexType].deleteByIds([id]);
  }

  /**
   * Delete multiple vectors from an index
   */
  async deleteVectors(indexType: IndexType, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.indexes[indexType].deleteByIds(ids);
  }

  /**
   * Get index statistics (requires metadata query)
   */
  async getIndexInfo(indexType: IndexType): Promise<{
    name: string;
    dimensions: number;
    metric: string;
  }> {
    // Vectorize doesn't expose stats directly, return config
    return {
      name: indexType,
      dimensions: 768, // BGE-base-en-v1.5
      metric: 'cosine'
    };
  }

  /**
   * Test index connectivity
   */
  async testConnection(indexType: IndexType): Promise<boolean> {
    try {
      // Try a simple query to test connectivity
      const testEmbedding = await this.generateEmbedding('test');
      const results = await this.indexes[indexType].query(testEmbedding, {
        topK: 1
      });
      return true;
    } catch (error) {
      console.error(`Connection test failed for ${indexType}:`, error);
      return false;
    }
  }

  /**
   * Bulk operations helper for large datasets
   */
  async bulkUpsert(
    indexType: IndexType,
    documents: DocumentChunk[],
    batchSize: number = 100
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);

      try {
        await this.upsertDocuments(indexType, batch);
        success += batch.length;
        console.log(`Upserted batch ${i / batchSize + 1}: ${batch.length} documents`);
      } catch (error) {
        console.error(`Batch ${i / batchSize + 1} failed:`, error);
        failed += batch.length;
      }
    }

    return { success, failed };
  }

  private buildCacheKey(kind: string, parts: Array<string | number>): string {
    return `${kind}:${parts.join('|')}`;
  }

  private stableSerialize(value: any): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map(item => this.stableSerialize(item)).join(',')}]`;
    }

    const entries = Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${this.stableSerialize(value[key])}`);

    return `{${entries.join(',')}}`;
  }

  private getCached<T>(key: string): T | null {
    if (!this.cacheEnabled) return null;

    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }

    if (entry) {
      this.cache.delete(key);
    }

    return null;
  }

  private setCached<T>(key: string, data: T): void {
    if (!this.cacheEnabled) return;

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTtlMs
    });

    if (this.cache.size > this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }
}
