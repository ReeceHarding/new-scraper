import { createClient } from '@supabase/supabase-js'
import { logger } from '@/services/logging'
import { SearchResult, SearchOptions } from './index'

export class QueryCacheError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message)
    this.name = 'QueryCacheError'
  }
}

interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
  options: SearchOptions;
}

export class QueryCache {
  private readonly supabase
  private readonly cacheDuration: number // Duration in milliseconds
  private readonly cacheTable = 'query_cache'
  
  constructor(cacheDuration: number = 24 * 60 * 60 * 1000) { // Default 24 hours
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      throw new QueryCacheError('Missing required Supabase environment variables')
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey)
    this.cacheDuration = cacheDuration
  }

  private generateCacheKey(query: string, options: SearchOptions): string {
    // Create a deterministic cache key from the query and options
    const optionsString = JSON.stringify(options, Object.keys(options).sort())
    return `${query}:${optionsString}`
  }

  async get(query: string, options: SearchOptions): Promise<SearchResult[] | null> {
    try {
      const cacheKey = this.generateCacheKey(query, options)
      
      const { data, error } = await this.supabase
        .from(this.cacheTable)
        .select('*')
        .eq('cache_key', cacheKey)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null
        }
        throw error
      }

      if (!data) return null

      const entry: CacheEntry = data.value
      const age = Date.now() - entry.timestamp

      // Check if cache entry is still valid
      if (age > this.cacheDuration) {
        await this.delete(query, options)
        return null
      }

      logger.debug('Cache hit', { query, options })
      return entry.results
    } catch (error) {
      logger.error('Failed to get from cache:', { query, options, error })
      throw new QueryCacheError('Failed to get from cache', error)
    }
  }

  async set(query: string, options: SearchOptions, results: SearchResult[]): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(query, options)
      const entry: CacheEntry = {
        results,
        timestamp: Date.now(),
        options
      }

      const { error } = await this.supabase
        .from(this.cacheTable)
        .upsert({
          cache_key: cacheKey,
          value: entry,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      logger.debug('Cache set', { query, options, resultCount: results.length })
    } catch (error) {
      logger.error('Failed to set cache:', { query, options, error })
      throw new QueryCacheError('Failed to set cache', error)
    }
  }

  async delete(query: string, options: SearchOptions): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(query, options)
      
      const { error } = await this.supabase
        .from(this.cacheTable)
        .delete()
        .eq('cache_key', cacheKey)

      if (error) throw error

      logger.debug('Cache entry deleted', { query, options })
    } catch (error) {
      logger.error('Failed to delete from cache:', { query, options, error })
      throw new QueryCacheError('Failed to delete from cache', error)
    }
  }

  async cleanup(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - this.cacheDuration).toISOString()
      
      const { error } = await this.supabase
        .from(this.cacheTable)
        .delete()
        .lt('updated_at', cutoffTime)

      if (error) throw error

      logger.info('Cache cleanup completed')
    } catch (error) {
      logger.error('Failed to cleanup cache:', error)
      throw new QueryCacheError('Failed to cleanup cache', error)
    }
  }
} 