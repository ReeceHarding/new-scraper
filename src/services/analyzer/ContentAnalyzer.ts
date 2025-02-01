import { OpenAIService } from '../openai/OpenAIService'
import { logger } from '@/lib/logging'
import { JSDOM } from 'jsdom'
import { AnalysisError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { createHash } from 'crypto'

export interface ContentAnalysisResult {
  summary: string
  metadata: Record<string, any>
  sentiment: {
    score: number
    label: string
  }
  entities: Array<{
    name: string
    type: string
    mentions: number
  }>
  keywords: Array<{
    keyword: string
    relevance: number
  }>
  topics: string[]
  readability: {
    score: number
    level: string
  }
  classification: {
    category: string
    confidence: number
  }
}

export interface ExtractedMetadata {
  title: string
  description: string
  schema: Record<string, any> | null
}

export class ContentAnalyzer {
  private readonly openai: OpenAIService

  constructor() {
    this.openai = OpenAIService.getInstance()
  }

  private generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  async analyzeContent(content: string, url: string): Promise<ContentAnalysisResult> {
    try {
      if (!content?.trim()) {
        logger.error('Empty content provided')
        throw new AnalysisError('Empty content provided')
      }

      logger.info('Starting content analysis', { url })
      
      const contentHash = this.generateContentHash(content)
      
      // Check cache first
      const { data: cachedAnalysis, error: cacheError } = await supabase
        .from('content_analysis_cache')
        .select('analysis_id')
        .eq('content_hash', contentHash)
        .eq('is_valid', true)
        .single()

      if (cacheError) {
        logger.error('Failed to check analysis cache', { error: cacheError.message })
      } else if (cachedAnalysis) {
        logger.info('Found cached analysis', { url, contentHash })
        const { data: analysis, error: analysisError } = await supabase
          .from('content_analysis')
          .select(`
            id,
            url,
            content_hash,
            summary,
            topics,
            sentiment_score,
            sentiment_label,
            readability_score,
            readability_level,
            classification_category,
            classification_confidence,
            metadata,
            content_entities (
              name,
              entity_type,
              mentions
            ),
            content_keywords (
              keyword,
              relevance_score
            )
          `)
          .eq('id', cachedAnalysis.analysis_id)
          .single()
        
        if (analysisError) {
          logger.error('Failed to fetch cached analysis', { error: analysisError.message })
        } else if (analysis) {
          return this.transformDatabaseToAnalysis(analysis)
        }
      }
      
      const metadata = await this.extractMetadata(content)
      const cleanContent = await this.cleanHtml(content)
      
      const prompt = this.buildAnalysisPrompt(cleanContent, metadata)
      
      logger.info('Sending content to OpenAI for analysis', { url })
      const analysisStr = await this.openai.createChatCompletion([
        {
          role: 'system',
          content: 'You are an expert content analyzer. Analyze the provided content and return a JSON response with the requested structure.'
        },
        {
          role: 'user',
          content: prompt
        }
      ])
      
      if (!analysisStr) {
        throw new AnalysisError('OpenAI returned empty analysis')
      }

      let analysis: ContentAnalysisResult
      try {
        analysis = JSON.parse(analysisStr)
      } catch (e) {
        throw new AnalysisError('Failed to parse OpenAI response as JSON')
      }
      
      this.validateContent(analysis)
      
      // Store analysis in database
      const { data: storedAnalysis, error: insertError } = await supabase
        .from('content_analysis')
        .insert({
          url,
          content_hash: contentHash,
          summary: analysis.summary,
          topics: analysis.topics,
          sentiment_score: analysis.sentiment.score,
          sentiment_label: analysis.sentiment.label,
          readability_score: analysis.readability.score,
          readability_level: analysis.readability.level,
          classification_category: analysis.classification.category,
          classification_confidence: analysis.classification.confidence,
          metadata: analysis.metadata
        })
        .select()
        .single()

      if (insertError) {
        throw new AnalysisError(`Failed to store analysis: ${insertError.message}`)
      }

      if (!storedAnalysis) {
        throw new AnalysisError('Failed to store analysis: No data returned')
      }

      // Store entities
      const { error: entitiesError } = await supabase
        .from('content_entities')
        .insert(
          analysis.entities.map(entity => ({
            analysis_id: storedAnalysis.id,
            name: entity.name,
            entity_type: entity.type,
            mentions: entity.mentions
          }))
        )

      if (entitiesError) {
        logger.error('Failed to store entities', { error: entitiesError.message })
      }

      // Store keywords
      const { error: keywordsError } = await supabase
        .from('content_keywords')
        .insert(
          analysis.keywords.map(keyword => ({
            analysis_id: storedAnalysis.id,
            keyword: keyword.keyword,
            relevance_score: keyword.relevance
          }))
        )

      if (keywordsError) {
        logger.error('Failed to store keywords', { error: keywordsError.message })
      }

      // Store in cache
      const { error: cacheStoreError } = await supabase
        .from('content_analysis_cache')
        .insert({
          content_hash: contentHash,
          analysis_id: storedAnalysis.id,
          is_valid: true
        })

      if (cacheStoreError) {
        logger.error('Failed to store in cache', { error: cacheStoreError.message })
      }

      logger.info('Content analysis completed and stored successfully', { url })
      return analysis
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to analyze content', { error: errorMessage })
      throw error instanceof AnalysisError ? error : new AnalysisError('Failed to analyze content: ' + errorMessage)
    }
  }

  private transformDatabaseToAnalysis(dbAnalysis: any): ContentAnalysisResult {
    return {
      summary: dbAnalysis.summary,
      metadata: dbAnalysis.metadata,
      sentiment: {
        score: dbAnalysis.sentiment_score,
        label: dbAnalysis.sentiment_label
      },
      entities: (dbAnalysis.content_entities || []).map((entity: any) => ({
        name: entity.name,
        type: entity.entity_type,
        mentions: entity.mentions
      })),
      keywords: (dbAnalysis.content_keywords || []).map((keyword: any) => ({
        keyword: keyword.keyword,
        relevance: keyword.relevance_score
      })),
      topics: dbAnalysis.topics,
      readability: {
        score: dbAnalysis.readability_score,
        level: dbAnalysis.readability_level
      },
      classification: {
        category: dbAnalysis.classification_category,
        confidence: dbAnalysis.classification_confidence
      }
    }
  }

  private async extractMetadata(html: string): Promise<ExtractedMetadata> {
    try {
      logger.info('Extracting metadata from HTML')
      
      const dom = new JSDOM(html)
      const document = dom.window.document

      // Extract basic metadata
      const title = document.querySelector('title')?.textContent?.trim() || ''
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || ''

      // Extract JSON-LD schema
      let schema = null
      const jsonLd = document.querySelector('script[type="application/ld+json"]')
      if (jsonLd?.textContent) {
        try {
          schema = JSON.parse(jsonLd.textContent)
        } catch (e) {
          logger.warn('Failed to parse JSON-LD schema', { error: e })
        }
      }

      logger.info('Metadata extraction completed')
      return { title, description, schema }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to parse HTML', { error: errorMessage })
      throw new AnalysisError('Failed to parse HTML: ' + errorMessage)
    }
  }

  private async cleanHtml(html: string): Promise<string> {
    try {
      const dom = new JSDOM(html)
      const document = dom.window.document

      // Remove script and style tags
      document.querySelectorAll('script, style').forEach(el => el.remove())

      // Get text content
      const text = document.body?.textContent?.trim() || ''
      
      // Clean up whitespace
      return text.replace(/\s+/g, ' ').trim()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to clean HTML', { error: errorMessage })
      throw new AnalysisError('Failed to clean HTML: ' + errorMessage)
    }
  }

  private buildAnalysisPrompt(content: string, metadata: ExtractedMetadata): string {
    return `
      Please analyze the following content and metadata:

      Content: ${content}

      Metadata:
      Title: ${metadata.title}
      Description: ${metadata.description}
      Schema: ${JSON.stringify(metadata.schema)}

      Please provide a detailed analysis in the following JSON format:
      {
        "summary": "A concise summary of the content",
        "metadata": {
          "companyName": "string",
          "industry": "string",
          "services": ["string"]
        },
        "sentiment": {
          "score": number (between -1 and 1),
          "label": "positive" | "negative" | "neutral"
        },
        "entities": [
          {
            "name": "string",
            "type": "string (PERSON, ORGANIZATION, LOCATION, etc.)",
            "mentions": number
          }
        ],
        "keywords": [
          {
            "keyword": "string",
            "relevance": number (between 0 and 1)
          }
        ],
        "topics": ["string"],
        "readability": {
          "score": number (between 0 and 100),
          "level": "string (Elementary, Intermediate, Advanced, etc.)"
        },
        "classification": {
          "category": "string",
          "confidence": number (between 0 and 1)
        }
      }
    `
  }

  private validateContent(content: ContentAnalysisResult): void {
    try {
      logger.info('Validating content analysis result')

      if (!content?.summary || typeof content.summary !== 'string') {
        throw new Error('Invalid or missing summary')
      }

      if (!content?.metadata || typeof content.metadata !== 'object') {
        throw new Error('Invalid or missing metadata')
      }

      if (!content?.sentiment || 
          typeof content.sentiment.score !== 'number' || 
          !['positive', 'negative', 'neutral'].includes(content.sentiment.label)) {
        throw new Error('Invalid or missing sentiment')
      }

      if (!Array.isArray(content?.entities) || content.entities.length === 0) {
        throw new Error('Invalid or missing entities')
      }

      if (!Array.isArray(content?.keywords) || content.keywords.length === 0) {
        throw new Error('Invalid or missing keywords')
      }

      if (!Array.isArray(content?.topics) || content.topics.length === 0) {
        throw new Error('Invalid or missing topics')
      }

      if (!content?.readability || 
          typeof content.readability.score !== 'number' || 
          typeof content.readability.level !== 'string') {
        throw new Error('Invalid or missing readability')
      }

      if (!content?.classification || 
          typeof content.classification.category !== 'string' || 
          typeof content.classification.confidence !== 'number') {
        throw new Error('Invalid or missing classification')
      }

      logger.info('Content validation successful')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Content validation failed', { error: errorMessage })
      throw new AnalysisError('Invalid content analysis result: ' + errorMessage)
    }
  }
}
