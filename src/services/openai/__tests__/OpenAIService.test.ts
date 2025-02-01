import { OpenAIService } from '../OpenAIService'
import { OpenAI } from 'openai'
import { logger } from '@/services/logging'

// Mock OpenAI
jest.mock('openai')
jest.mock('@/services/logging')

describe('OpenAIService', () => {
  let service: OpenAIService
  let mockOpenAI: jest.Mocked<OpenAI>

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()
    
    // Setup OpenAI mock
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    } as unknown as jest.Mocked<OpenAI>
    
    // Mock OpenAI constructor
    ;(OpenAI as jest.Mock).mockImplementation(() => mockOpenAI)
    
    // Create service instance
    service = OpenAIService.getInstance()
  })

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = OpenAIService.getInstance()
      const instance2 = OpenAIService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('createChatCompletion', () => {
    const mockMessages = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello' }
    ]

    it('should successfully create a chat completion', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Hello there!' } }]
      }
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any)

      const result = await service.createChatCompletion(mockMessages)
      expect(result).toBe('Hello there!')
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: mockMessages,
          model: process.env.OPENAI_MODEL_VERSION
        })
      )
    })

    it('should handle rate limits with exponential backoff', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      rateLimitError.name = 'RateLimitError'
      
      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Success!' } }] } as any)

      const result = await service.createChatCompletion(mockMessages)
      expect(result).toBe('Success!')
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2)
    })

    it('should throw after max retries', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      rateLimitError.name = 'RateLimitError'
      
      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError)

      await expect(service.createChatCompletion(mockMessages))
        .rejects
        .toThrow('OpenAI request failed after max retries')
    })

    it('should log errors', async () => {
      const error = new Error('API Error')
      mockOpenAI.chat.completions.create.mockRejectedValue(error)

      await expect(service.createChatCompletion(mockMessages)).rejects.toThrow()
      expect(logger.error).toHaveBeenCalled()
    })

    it('should respect timeouts', async () => {
      jest.useFakeTimers()
      
      const mockPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve({ choices: [{ message: { content: 'Too late!' } }] })
        }, 11000) // Longer than our timeout
      })
      
      mockOpenAI.chat.completions.create.mockReturnValue(mockPromise as any)

      const resultPromise = service.createChatCompletion(mockMessages)
      jest.advanceTimersByTime(11000)

      await expect(resultPromise).rejects.toThrow('OpenAI request timed out')
      
      jest.useRealTimers()
    })
  })

  describe('caching', () => {
    const mockMessages = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'What is 2+2?' }
    ]

    it('should cache responses', async () => {
      const mockResponse = {
        choices: [{ message: { content: '4' } }]
      }
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any)

      // First call should hit the API
      const result1 = await service.createChatCompletion(mockMessages)
      expect(result1).toBe('4')
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1)

      // Second call with same messages should use cache
      const result2 = await service.createChatCompletion(mockMessages)
      expect(result2).toBe('4')
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1)
    })

    it('should not cache errors', async () => {
      const error = new Error('API Error')
      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ choices: [{ message: { content: '4' } }] } as any)

      // First call should fail
      await expect(service.createChatCompletion(mockMessages)).rejects.toThrow()

      // Second call should succeed and not use cache
      const result = await service.createChatCompletion(mockMessages)
      expect(result).toBe('4')
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2)
    })
  })

  describe('monitoring', () => {
    it('should track metrics', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Hello!' } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      }
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any)

      await service.createChatCompletion([{ role: 'user', content: 'Hi' }])
      
      // Verify metrics were logged
      expect(logger.info).toHaveBeenCalledWith(
        'OpenAI request completed',
        expect.objectContaining({
          tokens: {
            prompt: 10,
            completion: 5,
            total: 15
          }
        })
      )
    })
  })
}) 