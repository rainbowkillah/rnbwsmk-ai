/**
 * SearchResults Component
 * Display semantic search results with relevance scores
 * Phase 7: Advanced Features
 */

import React from 'react';

interface SearchResult {
  id: string;
  text: string;
  score: number;
  type: string;
  category?: string;
  url?: string;
  highlight?: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  loading?: boolean;
}

export default function SearchResults({
  results,
  query,
  loading = false
}: SearchResultsProps) {
  if (loading) {
    return (
      <div className="search-results">
        <div className="search-loading">
          <span className="loading-spinner">⏳</span>
          <p>Searching...</p>
        </div>
      </div>
    );
  }

  if (!query) {
    return null;
  }

  if (results.length === 0) {
    return (
      <div className="search-results">
        <div className="search-empty">
          <span className="empty-icon">🔍</span>
          <p>No results found for "{query}"</p>
          <p className="empty-hint">Try different keywords or browse the knowledge base</p>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results">
      <div className="search-header">
        <p>Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</p>
      </div>

      <div className="results-list">
        {results.map((result) => (
          <div key={result.id} className="result-item">
            <div className="result-header">
              <span className="result-type">{result.type}</span>
              {result.category && (
                <span className="result-category">{result.category}</span>
              )}
              <span className="result-score">
                {(result.score * 100).toFixed(0)}% match
              </span>
            </div>

            <div className="result-content">
              {result.highlight ? (
                <p className="result-highlight">{result.highlight}</p>
              ) : (
                <p className="result-text">
                  {result.text.substring(0, 300)}
                  {result.text.length > 300 && '...'}
                </p>
              )}
            </div>

            {result.url && (
              <div className="result-footer">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-link"
                >
                  View source →
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
