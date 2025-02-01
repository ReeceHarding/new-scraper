import { supabase } from '@/lib/supabase'
import { logger } from '@/services/logging'
import { Database } from '@/types/supabase'

type QueryCache = Database['public']['Tables']['query_cache']

export class CacheService {
  private static instance: CacheService
  private readonly tableName = 'query_cache' as const

  private constructor() {}

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  async set<T>(key: string, value: T): Promise<T> {
    try {
      logger.info('Setting cache entry', { key })
      const { data, error } = await supabase
        .from(this.tableName)
        .upsert({
          cache_key: key,
          value: value as any
        } satisfies QueryCache['Insert'])
        .select()
        .single()

      if (error) throw error
      return value
    } catch (error) {
      logger.error('Failed to set cache entry:', error)
      throw error
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      logger.debug('Getting cache entry', { key })
      const { data, error } = await supabase
        .from(this.tableName)
        .select('value')
        .eq('cache_key', key)
        .single()

      if (error) throw error
      if (!data) {
        logger.debug('Cache miss', { key })
        return null
      }

      return data.value as T
    } catch (error) {
      logger.error('Failed to get cache entry:', error)
      throw error
    }
  }

  async delete<T>(key: string): Promise<T | null> {
    try {
      logger.info('Deleting cache entry', { key })
      
      // Get the value first
      const value = await this.get<T>(key)
      
      // Then delete the entry
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('cache_key', key)

      if (error) throw error
      return value
    } catch (error) {
      logger.error('Failed to delete cache entry:', error)
      throw error
    }
  }

  async cleanup(olderThanDays: number = 30): Promise<void> {
    try {
      logger.info('Cleaning up old cache entries', { olderThanDays })
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .lt('updated_at', cutoffDate.toISOString())

      if (error) throw error
      logger.info('Cache cleanup completed', { olderThanDays })
    } catch (error) {
      logger.error('Failed to cleanup cache:', error)
      throw error
    }
  }
} 