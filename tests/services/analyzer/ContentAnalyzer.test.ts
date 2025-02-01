import { ContentAnalyzer } from '../../../src/services/analyzer/ContentAnalyzer'
import { OpenAIService } from '../../../src/services/openai/OpenAIService'
import { logger } from '../../../src/lib/logging'
import { supabase } from '../../../src/lib/supabase'
import { PostgrestResponse, PostgrestSingleResponse, PostgrestError } from '@supabase/supabase-js'

type MockPostgrestError = {
  message: string
  details?: string
  hint?: string
  code?: string
}

// Create a type-safe mock response builder for success case
const createSuccessResponse = <T>(data: T[]): PostgrestResponse<T> => ({
  data,
  error: null,
  count: data.length,
  status: 200,
  statusText: 'OK'
})

// Create a type-safe mock response builder for error case
const createErrorResponse = <T>(error: MockPostgrestError): PostgrestResponse<T> => ({
  data: null,
  error: {
    message: error.message,
    details: error.details || '',
    hint: error.hint || '',
    code: error.code || 'ERROR',
    name: 'PostgrestError'
  },
  count: null,
  status: 400,
  statusText: 'Error'
})

// Create a type-safe mock single response builder for success case
const createSuccessSingleResponse = <T>(data: T): PostgrestSingleResponse<T> => ({
  data,
  error: null,
  count: 1,
  status: 200,
  statusText: 'OK'
})

// Create a type-safe mock single response builder for error case
const createErrorSingleResponse = <T>(error: MockPostgrestError): PostgrestSingleResponse<T> => ({
  data: null,
  error: {
    message: error.message,
    details: error.details || '',
    hint: error.hint || '',
    code: error.code || 'ERROR',
    name: 'PostgrestError'
  },
  count: null,
  status: 400,
  statusText: 'Error'
})

const mockStoredAnalysis = {
  id: 'test-id',
  url: 'https://test.com',
  content_hash: 'test-hash',
  summary: 'Test summary',
  topics: ['topic1', 'topic2'],
  sentiment_score: 0.8,
  sentiment_label: 'positive',
  readability_score: 80,
  readability_level: 'easy',
  classification_category: 'test',
  classification_confidence: 0.9,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve(createSuccessSingleResponse(null)))
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve(createSuccessSingleResponse(mockStoredAnalysis)))
        }))
      }))
    }))
  }
}))

describe('ContentAnalyzer', () => {
  let analyzer: ContentAnalyzer
  let mockOpenAI: jest.Mocked<OpenAIService>
  let mockSupabase: jest.Mocked<typeof supabase>

  beforeEach(() => {
    mockOpenAI = {
      createChatCompletion: jest.fn()
    } as unknown as jest.Mocked<OpenAIService>

    jest.spyOn(OpenAIService, 'getInstance').mockReturnValue(mockOpenAI)
    
    analyzer = new ContentAnalyzer()
    jest.clearAllMocks()

    // Reset Supabase mock default responses
    mockSupabase = supabase as jest.Mocked<typeof supabase>
    
    mockSupabase.from.mockImplementation((table: string) => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(createSuccessSingleResponse(null))
          })
        })
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue(createSuccessSingleResponse(mockStoredAnalysis))
        })
      })
    }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('analyzeContent', () => {
    const validContent = '<html><body>Test content</body></html>'
    const validUrl = 'https://test.com'
    const validAnalysis = {
      summary: 'Test summary',
      metadata: { companyName: 'Test Co', industry: 'Tech', services: ['service1'] },
      sentiment: {
        score: 0.8,
        label: 'positive'
      },
      entities: [{
        name: 'Test Co',
        type: 'ORGANIZATION',
        mentions: 1
      }],
      keywords: [{
        keyword: 'test',
        relevance: 0.9
      }],
      topics: ['technology'],
      readability: {
        score: 85,
        level: 'Intermediate'
      },
      classification: {
        category: 'Technology',
        confidence: 0.95
      }
    }

    it('should successfully analyze content', async () => {
      mockOpenAI.createChatCompletion.mockResolvedValue(JSON.stringify(validAnalysis))
      
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockImplementation((table: string) => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue(createSuccessSingleResponse(null))
            })
          })
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(createSuccessSingleResponse(mockStoredAnalysis))
          })
        })
      }))

      const result = await analyzer.analyzeContent(validContent, validUrl)
      expect(result).toEqual(validAnalysis)
      expect(logger.info).toHaveBeenCalledWith('Starting content analysis', { url: validUrl })
    })

    it('should handle empty content', async () => {
      await expect(analyzer.analyzeContent('', validUrl)).rejects.toThrow('Empty content provided')
      expect(logger.error).toHaveBeenCalledWith('Empty content provided')
    })

    it('should handle OpenAI errors', async () => {
      mockOpenAI.createChatCompletion.mockRejectedValue(new Error('API error'))

      await expect(analyzer.analyzeContent(validContent, validUrl)).rejects.toThrow('Failed to analyze content: API error')
      expect(logger.error).toHaveBeenCalledWith('Failed to analyze content', { error: 'API error' })
    })

    it('should handle invalid OpenAI response', async () => {
      mockOpenAI.createChatCompletion.mockResolvedValue('invalid json')

      await expect(analyzer.analyzeContent(validContent, validUrl)).rejects.toThrow('Failed to parse OpenAI response as JSON')
      expect(logger.error).toHaveBeenCalled()
    })

    it('should validate analysis results', async () => {
      const invalidAnalysis = {
        summary: 'Test summary',
        metadata: { companyName: 'Test Co' },
        sentiment: {
          score: 999, // Invalid score
          label: 'invalid'
        },
        entities: [],
        keywords: [{
          keyword: 'test',
          relevance: 0.5
        }],
        topics: ['topic1'],
        readability: {
          score: 85,
          level: 'Intermediate'
        },
        classification: {
          category: 'Technology',
          confidence: 0.95
        }
      }

      mockOpenAI.createChatCompletion.mockResolvedValue(JSON.stringify(invalidAnalysis))

      await expect(analyzer.analyzeContent(validContent, validUrl)).rejects.toThrow('Invalid or missing sentiment')
      expect(logger.error).toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      mockOpenAI.createChatCompletion.mockResolvedValue(JSON.stringify(validAnalysis))
      
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockImplementation((table: string) => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve(createErrorSingleResponse({ message: 'Database error' })))
            })),
            single: jest.fn(() => Promise.resolve(createErrorSingleResponse({ message: 'Database error' })))
          }))
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve(createErrorSingleResponse({ message: 'Database error' })))
          }))
        }))
      }))

      await expect(analyzer.analyzeContent(validContent, validUrl))
        .rejects.toThrow('Failed to store analysis: Database error')
      expect(logger.error).toHaveBeenCalled()
    })

    it('should use cached analysis when available', async () => {
      const cachedAnalysis = {
        id: '123',
        url: validUrl,
        content_hash: 'hash',
        summary: validAnalysis.summary,
        topics: validAnalysis.topics,
        sentiment_score: validAnalysis.sentiment.score,
        sentiment_label: validAnalysis.sentiment.label,
        readability_score: validAnalysis.readability.score,
        readability_level: validAnalysis.readability.level,
        classification_category: validAnalysis.classification.category,
        classification_confidence: validAnalysis.classification.confidence,
        metadata: validAnalysis.metadata,
        content_entities: validAnalysis.entities.map(e => ({
          name: e.name,
          entity_type: e.type,
          mentions: e.mentions
        })),
        content_keywords: validAnalysis.keywords.map(k => ({
          keyword: k.keyword,
          relevance_score: k.relevance
        }))
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockImplementation((table: string) => {
        if (table === 'content_analysis_cache') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn(() => Promise.resolve(createSuccessSingleResponse({ analysis_id: '123' })))
                }))
              }))
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => Promise.resolve(createSuccessResponse([mockStoredAnalysis])))
            }))
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve(createSuccessSingleResponse(cachedAnalysis)))
            }))
          }))
        }
      })

      const result = await analyzer.analyzeContent(validContent, validUrl)
      expect(result).toEqual(validAnalysis)
      expect(mockOpenAI.createChatCompletion).not.toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith('Found cached analysis', expect.any(Object))
    })
  })
})
