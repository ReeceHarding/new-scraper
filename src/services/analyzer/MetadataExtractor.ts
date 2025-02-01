import { OpenAIService, ChatMessage } from '@/services/openai/OpenAIService'
import { logger } from '@/services/logging'

interface ExtractedMetadata {
  industry: string
  industryConfidence: number
  services: string[]
  servicesConfidence: number
  contactInfo: {
    phone?: string
    address?: string
    socialMedia?: string[]
  }
  businessInfo: {
    name?: string
    size?: string
    yearFounded?: string
    employees?: string
    locations?: string[]
  }
  keywords: string[]
  technologies: string[]
}

type ContactInfoKey = keyof ExtractedMetadata['contactInfo']
type BusinessInfoKey = keyof ExtractedMetadata['businessInfo']

export class MetadataExtractor {
  private readonly openai: OpenAIService

  constructor() {
    this.openai = OpenAIService.getInstance()
  }

  /**
   * Extracts and analyzes business metadata from website content
   */
  async extractMetadata(content: {
    text: string
    title: string
    description: string
  }, context: {
    targetIndustry: string
    serviceOffering: string
  }): Promise<ExtractedMetadata> {
    try {
      // Extract basic metadata using regex patterns
      const basicMetadata = this.extractBasicMetadata(content.text)

      // Use OpenAI to analyze the content and extract detailed metadata
      const detailedMetadata = await this.analyzeContentWithAI(content, context)

      // Merge and validate the results
      return this.mergeAndValidateMetadata(basicMetadata, detailedMetadata)
    } catch (error: unknown) {
      logger.error('Metadata extraction failed:', { error })
      throw new Error(`Failed to extract metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extracts basic metadata using regex patterns
   */
  private extractBasicMetadata(text: string): Partial<ExtractedMetadata> {
    const metadata: Partial<ExtractedMetadata> = {
      contactInfo: {}
    }

    // Extract phone numbers
    const phoneRegex = /(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})/g
    const phones = text.match(phoneRegex)
    if (phones?.length && metadata.contactInfo) {
      metadata.contactInfo.phone = phones[0]
    }

    // Extract social media links
    const socialMediaRegex = /https?:\/\/(www\.)?(facebook|twitter|linkedin|instagram)\.com\/[a-zA-Z0-9_\-\.]+/g
    const socialMedia = text.match(socialMediaRegex)
    if (socialMedia?.length && metadata.contactInfo) {
      metadata.contactInfo.socialMedia = socialMedia
    }

    // Extract technologies
    const techKeywords = [
      'wordpress', 'shopify', 'wix', 'squarespace',
      'react', 'angular', 'vue', 'node',
      'php', 'python', 'java', 'ruby',
      'aws', 'azure', 'google cloud',
      'mongodb', 'mysql', 'postgresql'
    ]
    const techRegex = new RegExp(techKeywords.join('|'), 'gi')
    const technologies = text.match(techRegex)
    if (technologies?.length) {
      metadata.technologies = [...new Set(technologies.map(t => t.toLowerCase()))]
    }

    return metadata
  }

  /**
   * Uses OpenAI to analyze content and extract detailed metadata
   */
  private async analyzeContentWithAI(content: {
    text: string
    title: string
    description: string
  }, context: {
    targetIndustry: string
    serviceOffering: string
  }): Promise<ExtractedMetadata> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert at analyzing business websites and extracting metadata.
Given website content and context about the target industry and service offering,
analyze the content and return a JSON object with detailed business information.
Focus on identifying:
1. Industry classification and confidence
2. Services offered and confidence in classification
3. Business information (size, age, locations)
4. Contact information
5. Relevant keywords and technologies used

Be conservative with confidence scores - only report high confidence when very certain.`
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

  /**
   * Merges and validates metadata from different sources
   */
  private mergeAndValidateMetadata(
    basicMetadata: Partial<ExtractedMetadata>,
    detailedMetadata: ExtractedMetadata
  ): ExtractedMetadata {
    // Start with the AI-generated metadata
    const merged = { ...detailedMetadata }

    // Merge contact info
    merged.contactInfo = {
      ...merged.contactInfo,
      ...basicMetadata.contactInfo
    }

    // Merge and deduplicate technologies
    if (basicMetadata.technologies?.length) {
      merged.technologies = [...new Set([
        ...(merged.technologies || []),
        ...basicMetadata.technologies
      ])]
    }

    // Validate confidence scores
    merged.industryConfidence = Math.min(Math.max(0, merged.industryConfidence), 1)
    merged.servicesConfidence = Math.min(Math.max(0, merged.servicesConfidence), 1)

    // Ensure arrays exist
    merged.services = merged.services || []
    merged.keywords = merged.keywords || []
    merged.technologies = merged.technologies || []

    // Remove any empty or null values
    Object.keys(merged.contactInfo).forEach(key => {
      const typedKey = key as ContactInfoKey
      if (!merged.contactInfo[typedKey]) {
        delete merged.contactInfo[typedKey]
      }
    })

    Object.keys(merged.businessInfo).forEach(key => {
      const typedKey = key as BusinessInfoKey
      if (!merged.businessInfo[typedKey]) {
        delete merged.businessInfo[typedKey]
      }
    })

    return merged
  }
} 