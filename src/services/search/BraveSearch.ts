import axios from 'axios'
import { logger } from '@/services/logging'

interface SearchResult {
  url: string
  title: string
  description: string
}

export class BraveSearch {
  private readonly apiKey: string
  private readonly baseUrl: string = 'https://api.search.brave.com/res/v1/web/search'

  constructor() {
    this.apiKey = process.env.BRAVE_API_KEY
    if (!this.apiKey) {
      throw new Error('BRAVE_API_KEY environment variable is required')
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey
        },
        params: {
          q: query,
          format: 'json',
          count: 20
        }
      })

      return response.data.web.results.map((result: any) => ({
        url: result.url,
        title: result.title,
        description: result.description
      }))
    } catch (error) {
      logger.error('Brave search failed:', { query, error })
      throw new Error(`Search failed: ${error.message}`)
    }
  }
} 