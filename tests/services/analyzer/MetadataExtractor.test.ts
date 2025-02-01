import { MetadataExtractor } from '../../../src/services/analyzer/MetadataExtractor'
import { OpenAIService } from '../../../src/services/openai/OpenAIService'

// Mock OpenAI service
jest.mock('../../../src/services/openai/OpenAIService', () => ({
  OpenAIService: {
    getInstance: jest.fn(() => ({
      createChatCompletion: jest.fn()
    }))
  }
}))

describe('MetadataExtractor', () => {
  let extractor: MetadataExtractor
  let mockOpenAI: jest.Mocked<OpenAIService>

  beforeEach(() => {
    mockOpenAI = {
      createChatCompletion: jest.fn()
    } as unknown as jest.Mocked<OpenAIService>
    
    // Reset the mock implementation
    ;(OpenAIService.getInstance as jest.Mock).mockReturnValue(mockOpenAI)
    
    extractor = new MetadataExtractor()
  })

  describe('extractMetadata', () => {
    const mockContent = {
      text: 'Sample text with phone: +1-555-123-4567 and website: https://www.facebook.com/sample',
      title: 'Test Title',
      description: 'Test Description'
    }

    const mockContext = {
      targetIndustry: 'Technology',
      serviceOffering: 'Software Development'
    }

    const mockAIResponse = {
      industry: 'Technology',
      industryConfidence: 0.9,
      services: ['Software Development', 'Consulting'],
      servicesConfidence: 0.8,
      contactInfo: {
        phone: '+1-555-123-4567',
        socialMedia: ['https://www.facebook.com/sample']
      },
      businessInfo: {
        name: 'Test Company',
        size: 'Medium'
      },
      keywords: ['software', 'technology'],
      technologies: ['react', 'node']
    }

    it('should extract and merge metadata successfully', async () => {
      mockOpenAI.createChatCompletion.mockResolvedValueOnce(JSON.stringify(mockAIResponse))

      const result = await extractor.extractMetadata(mockContent, mockContext)

      expect(result).toMatchObject({
        industry: 'Technology',
        industryConfidence: 0.9,
        services: expect.arrayContaining(['Software Development', 'Consulting']),
        servicesConfidence: 0.8,
        contactInfo: {
          phone: expect.any(String),
          socialMedia: expect.arrayContaining([expect.stringContaining('facebook')])
        },
        businessInfo: {
          name: expect.any(String),
          size: expect.any(String)
        },
        keywords: expect.arrayContaining(['software', 'technology']),
        technologies: expect.arrayContaining(['react', 'node'])
      })
    })

    it('should handle errors gracefully', async () => {
      mockOpenAI.createChatCompletion.mockRejectedValueOnce(new Error('API Error'))

      await expect(extractor.extractMetadata(mockContent, mockContext))
        .rejects
        .toThrow('Failed to extract metadata: API Error')
    })

    it('should validate confidence scores', async () => {
      const invalidResponse = {
        ...mockAIResponse,
        industryConfidence: 1.5,
        servicesConfidence: -0.5
      }
      mockOpenAI.createChatCompletion.mockResolvedValueOnce(JSON.stringify(invalidResponse))

      const result = await extractor.extractMetadata(mockContent, mockContext)

      expect(result.industryConfidence).toBeLessThanOrEqual(1)
      expect(result.industryConfidence).toBeGreaterThanOrEqual(0)
      expect(result.servicesConfidence).toBeLessThanOrEqual(1)
      expect(result.servicesConfidence).toBeGreaterThanOrEqual(0)
    })
  })
}) 