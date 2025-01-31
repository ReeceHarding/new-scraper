import { WebDriver, By } from 'selenium-webdriver'
import { BrowserService } from '@/services/browser/BrowserService'
import { logger } from '@/services/logging'
import { OpenAI } from 'openai'

interface AnalysisResult {
  url: string
  summary: string
  emails: string[]
  suggestedEmail: string
  metadata: {
    title: string
    description: string
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
  private readonly openai: OpenAI

  constructor() {
    this.browserService = BrowserService.getInstance()
    this.openai = new OpenAI()
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
  }): Promise<{
    summary: string,
    metadata: AnalysisResult['metadata']
  }> {
    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL_VERSION,
      messages: [
        {
          role: 'system',
          content: `Analyze the following website content. Extract key business information and create a summary.
          Focus on details relevant to ${context.serviceOffering} services for the ${context.targetIndustry} industry.
          Return a JSON object with the following structure:
          {
            "summary": "brief summary of the business",
            "metadata": {
              "title": "business name/title",
              "description": "business description",
              "industry": "specific industry",
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
          content: content
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })

    return JSON.parse(response.choices[0].message.content)
  }

  private async generateEmailTemplate(
    analysis: { summary: string, metadata: AnalysisResult['metadata'] },
    context: { targetIndustry: string, serviceOffering: string }
  ): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL_VERSION,
      messages: [
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
      ],
      temperature: 0.7,
      max_tokens: 500
    })

    return response.choices[0].message.content
  }
} 