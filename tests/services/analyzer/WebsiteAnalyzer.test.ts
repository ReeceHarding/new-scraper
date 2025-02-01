import { WebsiteAnalyzer } from '../../../src/services/analyzer/WebsiteAnalyzer'
import { BrowserService } from '../../../src/services/browser/BrowserService'
import { OpenAIService } from '../../../src/services/openai/OpenAIService'
import { WebDriver, By, WebElement } from 'selenium-webdriver'

// Mock dependencies
jest.mock('../../../src/services/browser/BrowserService')
jest.mock('../../../src/services/openai/OpenAIService')

describe('WebsiteAnalyzer', () => {
  let analyzer: WebsiteAnalyzer
  let mockDriver: jest.Mocked<WebDriver>
  let mockBrowserService: jest.Mocked<BrowserService>
  let mockOpenAI: jest.Mocked<OpenAIService>

  beforeEach(() => {
    // Setup mock driver
    mockDriver = {
      get: jest.fn(),
      findElements: jest.fn(),
      getPageSource: jest.fn(),
      quit: jest.fn()
    } as unknown as jest.Mocked<WebDriver>

    // Setup mock browser service
    mockBrowserService = {
      getDriver: jest.fn().mockResolvedValue(mockDriver),
      releaseDriver: jest.fn()
    } as unknown as jest.Mocked<BrowserService>

    // Setup mock OpenAI service
    mockOpenAI = {
      createChatCompletion: jest.fn()
    } as unknown as jest.Mocked<OpenAIService>

    // Setup mock getInstance methods
    ;(BrowserService.getInstance as jest.Mock).mockReturnValue(mockBrowserService)
    ;(OpenAIService.getInstance as jest.Mock).mockReturnValue(mockOpenAI)

    analyzer = new WebsiteAnalyzer()
  })

  describe('analyzeWebsite', () => {
    const mockUrl = 'https://example.com'
    const mockContext = {
      targetIndustry: 'Technology',
      serviceOffering: 'Software Development'
    }

    const mockAnalysis = {
      summary: 'A technology company',
      metadata: {
        industry: 'Technology',
        services: ['Software Development', 'Consulting'],
        contactInfo: {
          phone: '123-456-7890',
          socialMedia: ['https://linkedin.com/company']
        }
      }
    }

    beforeEach(() => {
      // Setup mock responses
      const mockElement = {
        getText: jest.fn().mockResolvedValue('Sample text'),
        getDriver: jest.fn(),
        getId: jest.fn(),
        click: jest.fn(),
        sendKeys: jest.fn(),
        clear: jest.fn(),
        isSelected: jest.fn(),
        isEnabled: jest.fn(),
        isDisplayed: jest.fn(),
        submit: jest.fn(),
        findElement: jest.fn(),
        findElements: jest.fn(),
        getAttribute: jest.fn(),
        getCssValue: jest.fn(),
        getRect: jest.fn(),
        getTagName: jest.fn(),
        takeScreenshot: jest.fn()
      } as unknown as WebElement

      mockDriver.findElements.mockResolvedValue([mockElement])
      mockDriver.getPageSource.mockResolvedValue('Sample text with email@example.com')
      
      mockOpenAI.createChatCompletion
        .mockResolvedValueOnce(JSON.stringify(mockAnalysis))
        .mockResolvedValueOnce('Sample email template')
    })

    it('should analyze website successfully', async () => {
      const result = await analyzer.analyzeWebsite(mockUrl, mockContext)

      expect(result).toMatchObject({
        url: mockUrl,
        summary: mockAnalysis.summary,
        emails: ['email@example.com'],
        suggestedEmail: 'Sample email template',
        metadata: mockAnalysis.metadata
      })

      expect(mockBrowserService.getDriver).toHaveBeenCalled()
      expect(mockDriver.get).toHaveBeenCalledWith(mockUrl)
      expect(mockBrowserService.releaseDriver).toHaveBeenCalledWith(mockDriver)
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('Failed to load page')
      mockDriver.get.mockRejectedValueOnce(error)

      await expect(analyzer.analyzeWebsite(mockUrl, mockContext))
        .rejects
        .toThrow(error)

      expect(mockBrowserService.releaseDriver).toHaveBeenCalledWith(mockDriver)
    })

    it('should extract and deduplicate emails', async () => {
      mockDriver.getPageSource.mockResolvedValueOnce(
        'Text with duplicate emails: email@example.com and email@example.com and another@example.com'
      )

      const result = await analyzer.analyzeWebsite(mockUrl, mockContext)

      expect(result.emails).toEqual(['email@example.com', 'another@example.com'])
    })

    it('should generate email template based on analysis', async () => {
      const result = await analyzer.analyzeWebsite(mockUrl, mockContext)

      expect(mockOpenAI.createChatCompletion).toHaveBeenCalledTimes(2)
      expect(result.suggestedEmail).toBe('Sample email template')
    })
  })
}) 