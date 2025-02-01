import { supabase } from '@/lib/supabase'
import { logger } from '@/services/logging'
import { PostgrestError, PostgrestResponse } from '@supabase/supabase-js'

// Define valid table names based on schema
type TableName = 
  | 'content_analysis'
  | 'content_entities' 
  | 'content_keywords'
  | 'content_analysis_cache'
  | 'search_queries'
  | 'search_results'
  | 'search_analytics'
  | 'knowledge_docs'
  | 'knowledge_doc_chunks'
  | 'outreach_campaigns'
  | 'outreach_companies'
  | 'outreach_contacts'

export class StorageService {
  private static instance: StorageService
  private transactionInProgress: boolean = false

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService()
    }
    return StorageService.instance
  }

  private getTable(table: TableName) {
    return supabase.from(table as any)
  }

  private handleError(operation: string, table: string, error: any): never {
    const preposition = ['read', 'delete', 'query'].includes(operation) ? 'from' : 'in'
    const isPlural = operation.includes('batch') || operation === 'query'
    const recordText = isPlural ? 'records' : 'record'
    logger.error(`Failed to ${operation} ${recordText} ${preposition} ${table}:`, error)
    throw error
  }

  async startTransaction(): Promise<void> {
    if (this.transactionInProgress) {
      throw new Error('Transaction already in progress')
    }
    this.transactionInProgress = true
    logger.info('Starting transaction')
  }

  async commitTransaction(): Promise<void> {
    if (!this.transactionInProgress) {
      throw new Error('No transaction in progress')
    }
    this.transactionInProgress = false
    logger.info('Committing transaction')
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.transactionInProgress) {
      throw new Error('No transaction in progress')
    }
    this.transactionInProgress = false
    logger.info('Rolling back transaction')
  }

  async create<T extends TableName>(
    table: T,
    data: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      logger.info(`Creating record in ${table}`, { data })
      const { data: result, error } = await this.getTable(table)
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return result
    } catch (error) {
      return this.handleError('create', table, error)
    }
  }

  async read<T extends TableName>(table: T, id: string): Promise<Record<string, any>> {
    try {
      logger.info(`Reading record from ${table}`, { id })
      const { data: result, error } = await this.getTable(table)
        .select()
        .eq('id', id)
        .single()

      if (error) throw error
      if (!result) throw new Error(`Record not found in ${table} with id ${id}`)
      return result
    } catch (error) {
      return this.handleError('read', table, error)
    }
  }

  async update<T extends TableName>(
    table: T,
    id: string,
    data: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      logger.info(`Updating record in ${table}`, { id, data })
      const { data: result, error } = await this.getTable(table)
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (!result) throw new Error(`Record not found in ${table} with id ${id}`)
      return result
    } catch (error) {
      return this.handleError('update', table, error)
    }
  }

  async delete<T extends TableName>(table: T, id: string): Promise<Record<string, any>> {
    try {
      logger.info(`Deleting record from ${table}`, { id })
      const { data: result, error } = await this.getTable(table)
        .delete()
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (!result) throw new Error(`Record not found in ${table} with id ${id}`)
      return result
    } catch (error) {
      return this.handleError('delete', table, error)
    }
  }

  async batchCreate<T extends TableName>(
    table: T,
    data: Record<string, any>[]
  ): Promise<Record<string, any>[]> {
    try {
      logger.info(`Batch creating records in ${table}`, { count: data.length })
      const { data: result, error } = await this.getTable(table)
        .insert(data)
        .select()

      if (error) throw error
      return result
    } catch (error) {
      return this.handleError('batch create', table, error)
    }
  }

  async batchUpdate<T extends TableName>(
    table: T,
    updates: (Record<string, any> & { id: string })[]
  ): Promise<Record<string, any>[]> {
    try {
      logger.info(`Batch updating records in ${table}`, { count: updates.length })
      const { data: result, error } = await this.getTable(table)
        .upsert(updates)
        .select()

      if (error) throw error
      return result
    } catch (error) {
      return this.handleError('batch update', table, error)
    }
  }

  async query<T extends TableName>(
    table: T,
    filter: Record<string, any>,
    options: {
      orderBy?: { column: string; ascending?: boolean }
      limit?: number
      offset?: number
    } = {}
  ): Promise<Record<string, any>[]> {
    try {
      logger.info(`Querying records from ${table}`, { filter, options })
      let query = this.getTable(table).select()

      // Apply filters
      Object.entries(filter).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value)
        } else if (value === null) {
          query = query.is(key, null)
        } else {
          query = query.eq(key, value)
        }
      })

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? true
        })
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit)
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
      }

      const { data: result, error } = await query

      if (error) throw error
      return result || []
    } catch (error) {
      return this.handleError('query', table, error)
    }
  }

  async queryPaginated<T extends TableName>(
    table: T,
    page: number,
    pageSize: number,
    filter: Record<string, any> = {},
    orderBy?: { column: string; ascending?: boolean }
  ): Promise<{
    data: Record<string, any>[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    try {
      logger.info(`Querying paginated records from ${table}`, { page, pageSize, filter })
      
      // Get total count
      const countResult = await this.getTable(table)
        .select('id', { count: 'exact', head: true })
        .match(filter)

      if (countResult.error) throw countResult.error

      // Get paginated data
      const result = await this.query(table, filter, {
        orderBy,
        limit: pageSize,
        offset: page * pageSize
      })

      const total = countResult.count || 0
      const totalPages = Math.ceil(total / pageSize)

      return {
        data: result,
        total,
        page,
        pageSize,
        totalPages
      }
    } catch (error) {
      return this.handleError('query paginated', table, error)
    }
  }

  async searchText<T extends TableName>(
    table: T,
    column: string,
    searchTerm: string
  ): Promise<Record<string, any>[]> {
    try {
      logger.info(`Searching text in ${table}`, { column, searchTerm })
      const { data: result, error } = await this.getTable(table)
        .select()
        .textSearch(column, searchTerm)

      if (error) throw error
      return result || []
    } catch (error) {
      return this.handleError('search text', table, error)
    }
  }
} 