/**
 * Search and Query Management Types
 */

// Query History Types
export interface QueryHistory {
  id: string
  org_id: string
  user_id?: string
  business_goal: string
  target_industry: string
  service_offering: string
  location?: string
  query_text: string
  query_type: 'generated' | 'expanded' | 'optimized'
  query_score?: number
  query_feedback?: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

// Query Analytics Types
export interface QueryAnalytics {
  id: string
  org_id: string
  target_industry: string
  service_offering: string
  total_queries: number
  avg_score: number
  success_patterns?: Record<string, any>
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

// Query Cache Types
export interface QueryCache {
  id: string
  org_id: string
  cache_key: string
  queries: Record<string, any>
  context: Record<string, any>
  expires_at: string
  last_used: string
  use_count: number
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

// Query Generation Types
export interface QueryGenerationRequest {
  business_goal: string
  target_industry: string
  service_offering: string
  location?: string
  metadata?: Record<string, any>
}

export interface QueryGenerationResponse {
  queries: string[]
  metadata: {
    industry_confidence: number
    service_confidence: number
    location_confidence?: number
    query_quality_scores: number[]
  }
}

// Query Validation Types
export interface QueryValidationResult {
  isValid: boolean
  score: number
  feedback: string[]
  metadata: Record<string, any>
}

// Query Optimization Types
export interface QueryOptimizationResult {
  original_query: string
  optimized_query: string
  improvement_score: number
  changes: string[]
  metadata: Record<string, any>
}

// Search Result Types
export interface SearchResult {
  url: string
  title: string
  description: string
  relevance_score: number
  metadata: Record<string, any>
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  total_results: number
  page: number
  page_size: number
  execution_time: number
  metadata: Record<string, any>
}

// Error Types
export interface SearchError {
  code: string
  message: string
  details?: Record<string, any>
}

// Monitoring Types
export interface SearchMetrics {
  total_queries: number
  successful_queries: number
  failed_queries: number
  average_response_time: number
  cache_hit_rate: number
  error_rate: number
  metadata: Record<string, any>
} 