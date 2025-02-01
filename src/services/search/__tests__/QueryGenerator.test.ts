import { QueryGenerator } from '../QueryGenerator'
import { OpenAIService } from '@/services/openai/OpenAIService'

// Mock OpenAIService
jest.mock('@/services/openai/OpenAIService', () => ({
  OpenAIService: {
    getInstance: jest.fn(() => ({
      createChatCompletion: jest.fn()
    }))
  }
}))

describe('QueryGenerator', () => {
  let queryGenerator: QueryGenerator
  let mockOpenAI: jest.Mocked<OpenAIService>

  beforeEach(() => {
    jest.clearAllMocks()
    queryGenerator = new QueryGenerator()
    mockOpenAI = OpenAIService.getInstance() as jest.Mocked<OpenAIService>
  })

  describe('generateQueries', () => {
    const mockResponse = {
      queries: ['dentists in new york', 'dental practices nyc', 'manhattan dentist office'],
      targetIndustry: 'dental',
      serviceOffering: 'web design',
      location: 'New York',
      metadata: {
        industryConfidence: 0.95,
        serviceConfidence: 0.90,
        suggestedKeywords: ['dental practice', 'dentistry', 'oral health'],
        locationSpecific: true
      }
    }

    it('should generate queries successfully', async () => {
      mockOpenAI.createChatCompletion.mockResolvedValueOnce(JSON.stringify(mockResponse))

      const result = await queryGenerator.generateQueries('I make websites for dentists', {
        location: 'New York',
        maxQueries: 5
      })

      expect(result).toEqual(mockResponse)
      expect(mockOpenAI.createChatCompletion).toHaveBeenCalledTimes(1)
      expect(mockOpenAI.createChatCompletion.mock.calls[0][0]).toHaveLength(2)
      expect(mockOpenAI.createChatCompletion.mock.calls[0][0][0].role).toBe('system')
      expect(mockOpenAI.createChatCompletion.mock.calls[0][0][1].role).toBe('user')
    })

    it('should handle location-agnostic queries', async () => {
      const locationAgnosticResponse = {
        ...mockResponse,
        queries: ['dental practices', 'dentist offices', 'dental clinics'],
        location: '',
        metadata: { ...mockResponse.metadata, locationSpecific: false }
      }

      mockOpenAI.createChatCompletion.mockResolvedValueOnce(JSON.stringify(locationAgnosticResponse))

      const result = await queryGenerator.generateQueries('I make websites for dentists')

      expect(result.metadata.locationSpecific).toBe(false)
      expect(result.queries.every(q => !q.includes('new york'))).toBe(true)
    })

    it('should respect maxQueries limit', async () => {
      const responseWithManyQueries = {
        ...mockResponse,
        queries: Array(15).fill('query')
      }

      mockOpenAI.createChatCompletion.mockResolvedValueOnce(JSON.stringify(responseWithManyQueries))

      const result = await queryGenerator.generateQueries('I make websites for dentists', {
        maxQueries: 5
      })

      expect(result.queries).toHaveLength(5)
    })

    it('should handle keyword inclusion/exclusion', async () => {
      mockOpenAI.createChatCompletion.mockResolvedValueOnce(JSON.stringify(mockResponse))

      await queryGenerator.generateQueries('I make websites for dentists', {
        includeKeywords: ['professional', 'modern'],
        excludeKeywords: ['cheap', 'free']
      })

      const systemPrompt = mockOpenAI.createChatCompletion.mock.calls[0][0][0].content
      expect(systemPrompt).toContain('Include these keywords')
      expect(systemPrompt).toContain('professional, modern')
      expect(systemPrompt).toContain('Exclude these keywords')
      expect(systemPrompt).toContain('cheap, free')
    })

    it('should handle OpenAI errors gracefully', async () => {
      mockOpenAI.createChatCompletion.mockRejectedValueOnce(new Error('API Error'))

      await expect(queryGenerator.generateQueries('I make websites for dentists'))
        .rejects
        .toThrow('Failed to generate search queries: API Error')
    })

    it('should throw error when no valid queries are generated', async () => {
      const emptyResponse = {
        ...mockResponse,
        queries: []
      }

      mockOpenAI.createChatCompletion.mockResolvedValueOnce(JSON.stringify(emptyResponse))

      await expect(queryGenerator.generateQueries('I make websites for dentists'))
        .rejects
        .toThrow('No valid queries generated')
    })

    it('should validate and clean queries', async () => {
      const responseWithDirtyQueries = {
        ...mockResponse,
        queries: ['  query1  ', '', '  query2  ', null, undefined, '  ']
      }

      mockOpenAI.createChatCompletion.mockResolvedValueOnce(JSON.stringify(responseWithDirtyQueries))

      const result = await queryGenerator.generateQueries('I make websites for dentists')

      expect(result.queries).toEqual(['query1', 'query2'])
    })

    it('should expand queries when requested', async () => {
      const expandedQueries = [
        'dentists in new york',
        'dental practices nyc',
        'manhattan dentist office',
        'dental clinics new york',
        'orthodontists nyc',
        'pediatric dentists manhattan'
      ]

      mockOpenAI.createChatCompletion
        .mockResolvedValueOnce(JSON.stringify(mockResponse)) // Initial generation
        .mockResolvedValueOnce(JSON.stringify(expandedQueries)) // Expansion
        .mockResolvedValueOnce(JSON.stringify(expandedQueries.map(q => ({ // Testing
          query: q,
          score: 0.9,
          feedback: 'Excellent query'
        }))))

      const result = await queryGenerator.generateQueries('I make websites for dentists', {
        location: 'New York',
        maxQueries: 10,
        expandQueries: true
      })

      expect(result.queries).toHaveLength(6)
      expect(mockOpenAI.createChatCompletion).toHaveBeenCalledTimes(3)
      expect(result.queries).toContain('orthodontists nyc')
      expect(result.queries).toContain('pediatric dentists manhattan')
    })

    it('should handle query expansion failures gracefully', async () => {
      mockOpenAI.createChatCompletion
        .mockResolvedValueOnce(JSON.stringify(mockResponse)) // Initial generation
        .mockRejectedValueOnce(new Error('Expansion failed')) // Expansion fails
        .mockResolvedValueOnce(JSON.stringify(mockResponse.queries.map(q => ({ // Testing
          query: q,
          score: 0.9,
          feedback: 'Good query'
        }))))

      const result = await queryGenerator.generateQueries('I make websites for dentists', {
        expandQueries: true
      })

      expect(result.queries).toEqual(mockResponse.queries)
      expect(mockOpenAI.createChatCompletion).toHaveBeenCalledTimes(3)
    })

    it('should filter out low-scoring queries', async () => {
      const testResults = [
        { query: 'good query 1', score: 0.9, feedback: 'Excellent' },
        { query: 'bad query', score: 0.5, feedback: 'Too vague' },
        { query: 'good query 2', score: 0.8, feedback: 'Very good' }
      ]

      mockOpenAI.createChatCompletion
        .mockResolvedValueOnce(JSON.stringify(mockResponse)) // Initial generation
        .mockResolvedValueOnce(JSON.stringify(testResults)) // Testing

      const result = await queryGenerator.generateQueries('I make websites for dentists')

      expect(result.queries).toHaveLength(2)
      expect(result.queries).toContain('good query 1')
      expect(result.queries).toContain('good query 2')
      expect(result.queries).not.toContain('bad query')
    })

    it('should handle query testing failures gracefully', async () => {
      mockOpenAI.createChatCompletion
        .mockResolvedValueOnce(JSON.stringify(mockResponse)) // Initial generation
        .mockRejectedValueOnce(new Error('Testing failed')) // Testing fails

      const result = await queryGenerator.generateQueries('I make websites for dentists')

      expect(result.queries).toEqual(mockResponse.queries)
      expect(mockOpenAI.createChatCompletion).toHaveBeenCalledTimes(2)
    })

    it('should sort queries by score', async () => {
      const testResults = [
        { query: 'medium query', score: 0.8, feedback: 'Good' },
        { query: 'best query', score: 0.95, feedback: 'Excellent' },
        { query: 'good query', score: 0.85, feedback: 'Very good' }
      ]

      mockOpenAI.createChatCompletion
        .mockResolvedValueOnce(JSON.stringify({ ...mockResponse, queries: testResults.map(r => r.query) }))
        .mockResolvedValueOnce(JSON.stringify(testResults))

      const result = await queryGenerator.generateQueries('I make websites for dentists')

      expect(result.queries[0]).toBe('best query')
      expect(result.queries[1]).toBe('good query')
      expect(result.queries[2]).toBe('medium query')
    })
  })
}) 