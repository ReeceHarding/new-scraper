import axios, { AxiosError } from 'axios'
import { logger } from '@/services/logging'
import { SearchResult, SearchOptions } from './index'
import rateLimit from 'axios-rate-limit'

export class BraveSearchError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message)
    this.name = 'BraveSearchError'
  }
}

interface BraveSearchOptions {
  count?: number
  offset?: number
  language?: string
  country?: string
  safesearch?: 'strict' | 'moderate' | 'off'
}

export class BraveSearch {
  private readonly apiKey: string
  private readonly baseUrl: string = 'https://api.search.brave.com/res/v1/web/search'
  private readonly http: typeof axios
  private readonly defaultCount = 20
  private readonly maxCount = 50
  private readonly defaultTimeout = 10000

  constructor() {
    this.apiKey = process.env.BRAVE_API_KEY
    if (!this.apiKey) {
      throw new BraveSearchError('BRAVE_API_KEY environment variable is required')
    }

    // Create rate-limited axios instance (100 requests per minute as per Brave's limits)
    this.http = rateLimit(axios.create(), { 
      maxRequests: 100,
      perMilliseconds: 60000,
      maxRPS: 2 // Max 2 requests per second
    })
  }

  private validateCount(count?: number): number {
    if (!count) return this.defaultCount
    return Math.min(Math.max(1, count), this.maxCount)
  }

  private processSearchResult(result: any): SearchResult {
    return {
      url: result.url,
      title: result.title,
      snippet: result.description,
      rank: result.rank || 0,
      relevanceScore: result.relevance_score || 0,
      metadata: {
        deepLinks: result.deep_links || [],
        favicon: result.favicon,
        age: result.age,
        language: result.language,
        familyFriendly: result.family_friendly,
        additionalProperties: {
          ...result.additional_properties
        }
      }
    }
  }

  private buildSearchParams(query: string, options: SearchOptions & BraveSearchOptions) {
    const params: Record<string, any> = {
      q: query,
      format: 'json',
      count: this.validateCount(options.maxResults),
    }

    // Add optional parameters
    if (options.offset) params.offset = options.offset
    if (options.language) params.language = options.language
    if (options.country) params.country = options.country
    if (options.safesearch) params.safesearch = options.safesearch

    // Add location context if provided
    if (options.location) {
      params.q += ` location:${options.location}`
    }

    return params
  }

  private handleSearchError(error: any, query: string): never {
    const axiosError = error as AxiosError
    let message = 'Search failed'

    if (axiosError.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      message = `Search failed with status ${axiosError.response.status}`
      if (axiosError.response.data?.message) {
        message += `: ${axiosError.response.data.message}`
      }
    } else if (axiosError.request) {
      // The request was made but no response was received
      message = 'No response received from search API'
    }

    logger.error('Brave search failed:', { 
      query,
      error: {
        message: error.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data
      }
    })

    throw new BraveSearchError(message, error)
  }

  async search(query: string, options: SearchOptions & BraveSearchOptions = {}): Promise<SearchResult[]> {
    try {
      const response = await this.http.get(this.baseUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey
        },
        params: this.buildSearchParams(query, options),
        timeout: this.defaultTimeout
      })

      if (!response.data?.web?.results) {
        throw new BraveSearchError('Invalid response format from search API')
      }

      const results = response.data.web.results.map(this.processSearchResult)

      logger.info('Search completed successfully', {
        query,
        resultCount: results.length,
        totalResults: response.data.web.total || 0
      })

      return results
    } catch (error) {
      this.handleSearchError(error, query)
    }
  }
} 