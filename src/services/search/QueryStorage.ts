import { createClient } from '@supabase/supabase-js'
import { logger } from '@/services/logging'
import { SearchResult, SearchOptions } from './index'

export class QueryStorageError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message)
    this.name = 'QueryStorageError'
  }
}

export interface QueryAnalytics {
  totalQueries: number;
  averageResultCount: number;
  topIndustries: Array<{ industry: string; count: number }>;
  topServices: Array<{ service: string; count: number }>;
  querySuccessRate: number;
  averageExecutionTime: number;
}

export class QueryStorage {
  private readonly supabase
  
  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      throw new QueryStorageError('Missing required Supabase environment variables')
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  async saveQuery(query: string, options: SearchOptions): Promise<string> {
    try {
      const startTime = Date.now()
      
      const { data, error } = await this.supabase
        .from('search_queries')
        .insert({
          query,
          target_industry: options.targetIndustry,
          service_offering: options.serviceOffering,
          location: options.location,
          max_results: options.maxResults,
          metadata: {
            timestamp: new Date().toISOString(),
            options,
            execution_time_ms: Date.now() - startTime
          }
        })
        .select('id')
        .single()

      if (error) throw error

      // Save analytics data
      await this.saveQueryAnalytics(data.id, startTime)

      logger.info('Search query saved successfully', { query, options })
      return data.id
    } catch (error) {
      logger.error('Failed to save search query:', { query, options, error })
      throw new QueryStorageError('Failed to save search query', error)
    }
  }

  private async saveQueryAnalytics(queryId: string, startTime: number): Promise<void> {
    try {
      const executionTime = Date.now() - startTime
      
      const { error } = await this.supabase
        .from('search_analytics')
        .insert({
          query_id: queryId,
          execution_time_ms: executionTime,
          success: true,
          metadata: {
            timestamp: new Date().toISOString()
          }
        })

      if (error) throw error

      logger.debug('Query analytics saved', { queryId, executionTime })
    } catch (error) {
      logger.error('Failed to save query analytics:', { queryId, error })
      // Don't throw here to prevent disrupting the main flow
    }
  }

  async saveResults(queryId: string, results: SearchResult[]): Promise<void> {
    try {
      const searchResults = results.map(result => ({
        query_id: queryId,
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        rank: result.rank,
        relevance_score: result.relevanceScore,
        metadata: {
          ...result.metadata,
          saved_at: new Date().toISOString()
        }
      }))

      const { error } = await this.supabase
        .from('search_results')
        .insert(searchResults)

      if (error) throw error

      // Update analytics with result count
      await this.updateAnalyticsWithResults(queryId, results.length)

      logger.info('Search results saved successfully', { 
        queryId,
        count: results.length,
        urls: results.map(r => r.url)
      })
    } catch (error) {
      logger.error('Failed to save search results:', { 
        queryId,
        count: results.length,
        error 
      })
      throw new QueryStorageError('Failed to save search results', error)
    }
  }

  private async updateAnalyticsWithResults(queryId: string, resultCount: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('search_analytics')
        .update({ total_results: resultCount })
        .eq('query_id', queryId)

      if (error) throw error

      logger.debug('Analytics updated with result count', { queryId, resultCount })
    } catch (error) {
      logger.error('Failed to update analytics with results:', { queryId, error })
    }
  }

  async getQueryAnalytics(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<QueryAnalytics> {
    try {
      const timeframeMap = {
        day: '1 day',
        week: '7 days',
        month: '30 days'
      }

      // Get analytics data
      const { data: analyticsData, error: analyticsError } = await this.supabase
        .from('search_analytics')
        .select('*')
        .gte('created_at', `now() - interval '${timeframeMap[timeframe]}'`)

      if (analyticsError) throw analyticsError

      // Get queries data
      const { data: queriesData, error: queriesError } = await this.supabase
        .from('search_queries')
        .select('target_industry, service_offering')
        .gte('created_at', `now() - interval '${timeframeMap[timeframe]}'`)

      if (queriesError) throw queriesError

      // Calculate analytics
      const totalQueries = analyticsData.length
      const successfulQueries = analyticsData.filter(a => a.success).length
      const totalResults = analyticsData.reduce((sum, a) => sum + (a.total_results || 0), 0)
      const totalExecutionTime = analyticsData.reduce((sum, a) => sum + a.execution_time_ms, 0)

      // Calculate industry and service frequencies
      const industries = queriesData
        .map(q => q.target_industry)
        .filter(Boolean)
        .reduce<Record<string, number>>((acc, industry) => {
          acc[industry] = (acc[industry] || 0) + 1
          return acc
        }, {})

      const services = queriesData
        .map(q => q.service_offering)
        .filter(Boolean)
        .reduce<Record<string, number>>((acc, service) => {
          acc[service] = (acc[service] || 0) + 1
          return acc
        }, {})

      return {
        totalQueries,
        averageResultCount: totalQueries ? totalResults / totalQueries : 0,
        topIndustries: Object.entries(industries)
          .map(([industry, count]) => ({ industry, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        topServices: Object.entries(services)
          .map(([service, count]) => ({ service, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        querySuccessRate: totalQueries ? (successfulQueries / totalQueries) * 100 : 0,
        averageExecutionTime: totalQueries ? totalExecutionTime / totalQueries : 0
      }
    } catch (error) {
      logger.error('Failed to get query analytics:', { timeframe, error })
      throw new QueryStorageError('Failed to get query analytics', error)
    }
  }

  async getRecentQueries(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('search_queries')
        .select(`
          id,
          query,
          target_industry,
          service_offering,
          location,
          created_at,
          search_analytics (
            execution_time_ms,
            total_results,
            success
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data
    } catch (error) {
      logger.error('Failed to fetch recent queries:', { limit, error })
      throw new QueryStorageError('Failed to fetch recent queries', error)
    }
  }

  async getResultsForQuery(queryId: string): Promise<SearchResult[]> {
    try {
      const { data, error } = await this.supabase
        .from('search_results')
        .select('*')
        .eq('query_id', queryId)
        .order('rank', { ascending: true })

      if (error) throw error

      return data.map(row => ({
        url: row.url,
        title: row.title,
        snippet: row.snippet,
        rank: row.rank,
        relevanceScore: row.relevance_score,
        metadata: row.metadata
      }))
    } catch (error) {
      logger.error('Failed to fetch results for query:', { queryId, error })
      throw new QueryStorageError('Failed to fetch query results', error)
    }
  }
} 