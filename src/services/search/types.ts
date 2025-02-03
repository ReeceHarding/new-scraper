export interface SearchQuery {
  text: string;
  filters?: Record<string, any>;
}

export interface SearchResult {
  id: string;
  name: string;
  description: string;
  industry: string;
  location: string;
  score: number;
  metadata: Record<string, any>;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

export interface SearchServiceConfig {
  maxResults: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  timeout: number;
}

export interface SearchServiceOptions {
  config: SearchServiceConfig;
  logger?: any;
}

export interface SearchSuggestion {
  text: string;
  type: string;
  score: number;
}

export interface FilterOptions {
  industry?: string[];
  location?: string;
  companySize?: string[];
  [key: string]: any;
}

export interface RankingConfig {
  relevanceFactors: Array<{
    name: string;
    weight: number;
  }>;
  boostFactors: {
    hasWebsite: number;
    hasContactInfo: number;
    isVerifiedBusiness: number;
  };
} 