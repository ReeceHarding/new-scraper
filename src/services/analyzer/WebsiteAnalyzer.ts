import { WebDriver, By } from 'selenium-webdriver';
import { BrowserService } from '@/services/browser/BrowserService';
import { OpenAIService, ChatMessage } from '@/services/openai/OpenAIService';
import { logger } from '@/services/logging';

interface AnalysisResult {
  url: string
  summary: string
  emails: string[]
  suggestedEmail: string
  metadata: {
    industry: string
    services: string[]
    contactInfo: {
      phone?: string
      address?: string
      socialMedia?: string[]
    }
  }
}

export class WebsiteAnalyzer {
  private readonly browserService: BrowserService
  private readonly openai: OpenAIService

  constructor() {
    this.browserService = BrowserService.getInstance()
    this.openai = OpenAIService.getInstance()
  }

  async analyzeWebsite(url: string, context: { 
    targetIndustry: string, 
    serviceOffering: string 
  }): Promise<AnalysisResult> {
    let driver: WebDriver = null

    try {
      driver = await this.browserService.getDriver()
      await driver.get(url)

      // Extract content
      const content = await this.extractContent(driver)
      const emails = await this.extractEmails(driver)
      
      // Generate analysis using OpenAI
      const analysis = await this.generateAnalysis(content, context)
      
      // Generate suggested email
      const suggestedEmail = await this.generateEmailTemplate(analysis, context)

      return {
        url,
        summary: analysis.summary,
        emails,
        suggestedEmail,
        metadata: analysis.metadata
      }
    } catch (error) {
      logger.error('Website analysis failed:', { url, error })
      throw error
    } finally {
      if (driver) {
        await this.browserService.releaseDriver(driver)
      }
    }
  }

  private async extractContent(driver: WebDriver): Promise<string> {
    const elements = await driver.findElements(By.css('body *'))
    const texts = await Promise.all(
      elements.map(async (element) => {
        try {
          const text = await element.getText()
          return text.trim()
        } catch {
          return ''
        }
      })
    )
    return texts.filter(text => text.length > 0).join('\n')
  }

  private async extractEmails(driver: WebDriver): Promise<string[]> {
    const pageSource = await driver.getPageSource()
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const matches = pageSource.match(emailRegex) || []
    return [...new Set(matches)]
  }

  private async generateAnalysis(content: string, context: { 
    targetIndustry: string, 
    serviceOffering: string 
  }): Promise<{ summary: string, metadata: AnalysisResult['metadata'] }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert at analyzing business websites.
        Given the content of a website and the target industry/service context,
        analyze the content and return a JSON object with the following structure:
        {
          "summary": "Brief summary of the business",
          "metadata": {
            "industry": "Detected industry",
            "services": ["service1", "service2"],
            "contactInfo": {
              "phone": "phone number if found",
              "address": "address if found",
              "socialMedia": ["social media links"]
            }
          }
        }`
      },
      {
        role: 'user',
        content: JSON.stringify({
          content,
          context
        })
      }
    ]

    const response = await this.openai.createChatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 1000
    })

    return JSON.parse(response)
  }

  private async generateEmailTemplate(
    analysis: { summary: string, metadata: AnalysisResult['metadata'] },
    context: { targetIndustry: string, serviceOffering: string }
  ): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate a personalized cold email template for a business offering ${context.serviceOffering} 
        to a potential client in the ${context.targetIndustry} industry. Use the provided business analysis 
        to make the email specific and relevant. The email should be professional, concise, and highlight 
        the value proposition. Focus on how your services can help solve their specific problems or improve 
        their business.`
      },
      {
        role: 'user',
        content: JSON.stringify(analysis)
      }
    ]

    return await this.openai.createChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 500
    })
  }
} 