import { QueryGenerator } from '../QueryGenerator'
import { BraveSearch } from '../BraveSearch'
import { QueryStorage } from '../QueryStorage'
import { SearchResult, SearchOptions } from '../index'

// Mock OpenAI service
jest.mock('@/services/openai/OpenAIService', () => ({
  OpenAIService: {
    getInstance: jest.fn(() => ({
      createChatCompletion: jest.fn()
    }))
  }
}))

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ error: null })),
      select: jest.fn(() => ({ data: [], error: null })),
      order: jest.fn(() => ({ limit: jest.fn(() => ({ data: [], error: null })) })),
      eq: jest.fn(() => ({ order: jest.fn(() => ({ data: [], error: null })) }))
    }))
  }))
}))

describe('Search Service', () => {
  let queryGenerator: QueryGenerator
  let braveSearch: BraveSearch
  let queryStorage: QueryStorage

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Initialize services
    queryGenerator = new QueryGenerator()
    braveSearch = new BraveSearch()
    queryStorage = new QueryStorage()
  })

  describe('QueryGenerator', () => {
    it('should generate search queries from business goal', async () => {
      const mockResponse = JSON.stringify({
        queries: ['dentist website design', 'dental practice web developer'],
        targetIndustry: 'dental',
        serviceOffering: 'web design',
        metadata: {
          industryConfidence: 0.95,
          serviceConfidence: 0.95,
          suggestedKeywords: ['dentist', 'dental practice'],
          locationSpecific: false
        }
      })

      // Mock OpenAI response
      const openai = require('@/services/openai/OpenAIService').OpenAIService.getInstance()
      openai.createChatCompletion.mockResolvedValue(mockResponse)

      const result = await queryGenerator.generateQueries('I make websites for dentists')

      expect(result.queries).toHaveLength(2)
      expect(result.targetIndustry).toBe('dental')
      expect(result.serviceOffering).toBe('web design')
      expect(result.metadata.industryConfidence).toBeGreaterThan(0.9)
    })

    it('should handle location-specific queries', async () => {
      const mockResponse = JSON.stringify({
        queries: ['dentist website design NYC', 'dental practice web developer New York'],
        targetIndustry: 'dental',
        serviceOffering: 'web design',
        location: 'New York',
        metadata: {
          industryConfidence: 0.95,
          serviceConfidence: 0.95,
          suggestedKeywords: ['dentist', 'dental practice'],
          locationSpecific: true
        }
      })

      const openai = require('@/services/openai/OpenAIService').OpenAIService.getInstance()
      openai.createChatCompletion.mockResolvedValue(mockResponse)

      const result = await queryGenerator.generateQueries('I make websites for dentists', {
        location: 'New York'
      })

      expect(result.queries.every(q => q.includes('New York') || q.includes('NYC'))).toBe(true)
      expect(result.location).toBe('New York')
      expect(result.metadata.locationSpecific).toBe(true)
    })
  })

  describe('BraveSearch', () => {
    const mockSearchResult = {
      url: 'https://example.com',
      title: 'Example Dental Practice',
      description: 'A modern dental practice in New York',
      rank: 1,
      relevance_score: 0.95
    }

    beforeEach(() => {
      // Mock axios
      jest.spyOn(require('axios'), 'create').mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: {
            web: {
              results: [mockSearchResult],
              total: 1
            }
          }
        })
      })
    })

    it('should perform search and return results', async () => {
      const results = await braveSearch.search('dentist website design NYC')

      expect(results).toHaveLength(1)
      expect(results[0].url).toBe(mockSearchResult.url)
      expect(results[0].title).toBe(mockSearchResult.title)
      expect(results[0].relevanceScore).toBe(mockSearchResult.relevance_score)
    })

    it('should handle search errors gracefully', async () => {
      const axios = require('axios')
      jest.spyOn(axios, 'create').mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('API Error'))
      })

      await expect(braveSearch.search('test query')).rejects.toThrow('Search failed')
    })
  })

  describe('QueryStorage', () => {
    const mockQuery = 'dentist website design'
    const mockOptions: SearchOptions = {
      targetIndustry: 'dental',
      serviceOffering: 'web design',
      location: 'New York'
    }
    const mockResults: SearchResult[] = [{
      url: 'https://example.com',
      title: 'Example Dental Practice',
      snippet: 'A modern dental practice in New York',
      rank: 1,
      relevanceScore: 0.95,
      metadata: {}
    }]

    it('should save search query', async () => {
      await queryStorage.saveQuery(mockQuery, mockOptions)
      
      const supabase = require('@supabase/supabase-js').createClient()
      expect(supabase.from).toHaveBeenCalledWith('search_queries')
      expect(supabase.from().insert).toHaveBeenCalled()
    })

    it('should save search results', async () => {
      await queryStorage.saveResults(mockResults)
      
      const supabase = require('@supabase/supabase-js').createClient()
      expect(supabase.from).toHaveBeenCalledWith('search_results')
      expect(supabase.from().insert).toHaveBeenCalled()
    })

    it('should retrieve recent queries', async () => {
      await queryStorage.getRecentQueries(5)
      
      const supabase = require('@supabase/supabase-js').createClient()
      expect(supabase.from).toHaveBeenCalledWith('search_queries')
      expect(supabase.from().select).toHaveBeenCalled()
    })

    it('should retrieve results for a query', async () => {
      const queryId = '123'
      await queryStorage.getResultsForQuery(queryId)
      
      const supabase = require('@supabase/supabase-js').createClient()
      expect(supabase.from).toHaveBeenCalledWith('search_results')
      expect(supabase.from().select).toHaveBeenCalled()
      expect(supabase.from().select().eq).toHaveBeenCalledWith('query_id', queryId)
    })
  })
}) 