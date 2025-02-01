import { createMocks } from 'node-mocks-http'
import handler from '../process-goal'
import { QueryGenerator } from '@/services/search/QueryGenerator'
import { BraveSearch } from '@/services/search/BraveSearch'
import { QueryStorage } from '@/services/search/QueryStorage'
import { QueryCache } from '@/services/search/QueryCache'

// Mock the services
jest.mock('@/services/search/QueryGenerator')
jest.mock('@/services/search/BraveSearch')
jest.mock('@/services/search/QueryStorage')
jest.mock('@/services/search/QueryCache')

describe('Process Goal API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Method not allowed'
    })
  })

  it('should return 400 when goal is missing', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {}
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Business goal is required and must be a string'
    })
  })

  it('should return 400 when maxResults is invalid', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        goal: 'I make websites for dentists',
        maxResults: 0
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData())).toEqual({
      error: 'maxResults must be between 1 and 50'
    })
  })

  it('should process a valid goal successfully', async () => {
    // Mock service responses
    const mockQueries = ['dental practice website', 'dentist office website']
    const mockQueryResult = {
      queries: mockQueries,
      targetIndustry: 'dental',
      serviceOffering: 'web design',
      location: undefined,
      metadata: {
        industryConfidence: 0.95,
        serviceConfidence: 0.95,
        suggestedKeywords: ['dentist', 'dental practice'],
        locationSpecific: false
      }
    }

    const mockSearchResults = [
      {
        url: 'https://example.com/1',
        title: 'Dental Practice 1',
        snippet: 'A great dental practice',
        rank: 1,
        relevanceScore: 0.9,
        metadata: {}
      },
      {
        url: 'https://example.com/2',
        title: 'Dental Practice 2',
        snippet: 'Another great dental practice',
        rank: 2,
        relevanceScore: 0.8,
        metadata: {}
      }
    ]

    const mockQueryId = 'mock-query-id'

    // Set up mocks
    ;(QueryGenerator as jest.MockedClass<typeof QueryGenerator>).prototype.generateQueries
      .mockResolvedValue(mockQueryResult)
    ;(BraveSearch as jest.MockedClass<typeof BraveSearch>).prototype.search
      .mockResolvedValue(mockSearchResults)
    ;(QueryStorage as jest.MockedClass<typeof QueryStorage>).prototype.saveQuery
      .mockResolvedValue(mockQueryId)
    ;(QueryCache as jest.MockedClass<typeof QueryCache>).prototype.get
      .mockResolvedValue(null)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        goal: 'I make websites for dentists',
        maxResults: 10,
        prioritizeLocal: true
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const responseData = JSON.parse(res._getData())
    
    expect(responseData).toEqual({
      queryId: mockQueryId,
      targetIndustry: mockQueryResult.targetIndustry,
      serviceOffering: mockQueryResult.serviceOffering,
      location: mockQueryResult.location,
      metadata: mockQueryResult.metadata,
      results: mockSearchResults
    })

    // Verify service calls
    expect(QueryGenerator.prototype.generateQueries).toHaveBeenCalledWith(
      'I make websites for dentists',
      expect.objectContaining({
        maxQueries: 5,
        prioritizeLocal: true
      })
    )

    expect(BraveSearch.prototype.search).toHaveBeenCalledTimes(2)
    expect(QueryStorage.prototype.saveQuery).toHaveBeenCalledTimes(1)
    expect(QueryStorage.prototype.saveResults).toHaveBeenCalledTimes(1)
  })

  it('should use cached results when available', async () => {
    const mockQueries = ['dental practice website']
    const mockQueryResult = {
      queries: mockQueries,
      targetIndustry: 'dental',
      serviceOffering: 'web design',
      location: undefined,
      metadata: {
        industryConfidence: 0.95,
        serviceConfidence: 0.95,
        suggestedKeywords: ['dentist'],
        locationSpecific: false
      }
    }

    const mockCachedResults = [
      {
        url: 'https://example.com/cached',
        title: 'Cached Result',
        snippet: 'A cached result',
        rank: 1,
        relevanceScore: 0.9,
        metadata: {}
      }
    ]

    const mockQueryId = 'mock-query-id'

    // Set up mocks
    ;(QueryGenerator as jest.MockedClass<typeof QueryGenerator>).prototype.generateQueries
      .mockResolvedValue(mockQueryResult)
    ;(QueryCache as jest.MockedClass<typeof QueryCache>).prototype.get
      .mockResolvedValue(mockCachedResults)
    ;(QueryStorage as jest.MockedClass<typeof QueryStorage>).prototype.saveQuery
      .mockResolvedValue(mockQueryId)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        goal: 'I make websites for dentists',
        maxResults: 5
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const responseData = JSON.parse(res._getData())
    
    expect(responseData.results).toEqual(mockCachedResults)
    expect(BraveSearch.prototype.search).not.toHaveBeenCalled()
  })

  it('should handle service errors gracefully', async () => {
    ;(QueryGenerator as jest.MockedClass<typeof QueryGenerator>).prototype.generateQueries
      .mockRejectedValue(new Error('Service error'))

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        goal: 'I make websites for dentists'
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(500)
    expect(JSON.parse(res._getData())).toEqual({
      error: 'An error occurred while processing your request',
      details: process.env.NODE_ENV === 'development' ? 'Service error' : undefined
    })
  })
}) 