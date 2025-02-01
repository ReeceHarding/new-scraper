import { SearchError } from '@/lib/errors';
import { QueryGenerator } from './QueryGenerator';

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  rank: number;
  relevanceScore: number;
  metadata: Record<string, any>;
}

export interface SearchOptions {
  targetIndustry?: string;
  serviceOffering?: string;
  location?: string;
  maxResults?: number;
}

export interface SearchService {
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
  saveQuery(query: string, options: SearchOptions): Promise<void>;
  saveResults(results: SearchResult[]): Promise<void>;
}

export interface QueryGeneratorOptions {
  location?: string;
  maxQueries?: number;
  prioritizeLocal?: boolean;
  excludeKeywords?: string[];
  includeKeywords?: string[];
}

export interface QueryGeneratorResult {
  queries: string[];
  targetIndustry: string;
  serviceOffering: string;
  location?: string;
  metadata: {
    industryConfidence: number;
    serviceConfidence: number;
    suggestedKeywords: string[];
    locationSpecific: boolean;
  };
}

export class SearchServiceError extends SearchError {
  constructor(message: string) {
    super(message);
    this.name = 'SearchServiceError';
  }
}

// Export the QueryGenerator class and create a singleton instance
export { QueryGenerator };
export const queryGenerator = new QueryGenerator(); 