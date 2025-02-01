import { logger } from '@/services/logging'
import { OpenAIService, ChatMessage } from '@/services/openai/OpenAIService'

interface QueryGeneratorResult {
  queries: string[]
  targetIndustry: string
  serviceOffering: string
  location?: string
  metadata: {
    industryConfidence: number
    serviceConfidence: number
    suggestedKeywords: string[]
    locationSpecific: boolean
  }
}

interface QueryGeneratorOptions {
  location?: string
  maxQueries?: number
  prioritizeLocal?: boolean
  excludeKeywords?: string[]
  includeKeywords?: string[]
  expandQueries?: boolean
}

interface QueryTestResult {
  query: string
  score: number
  feedback: string
}

export class QueryGenerator {
  private openai: OpenAIService
  private readonly defaultMaxQueries = 10
  
  constructor() {
    this.openai = OpenAIService.getInstance()
  }

  private validateOptions(options: QueryGeneratorOptions): QueryGeneratorOptions {
    return {
      maxQueries: Math.min(Math.max(1, options.maxQueries || this.defaultMaxQueries), 20),
      location: options.location?.trim(),
      prioritizeLocal: options.prioritizeLocal ?? true,
      excludeKeywords: options.excludeKeywords?.filter(k => k.trim()) || [],
      includeKeywords: options.includeKeywords?.filter(k => k.trim()) || [],
      expandQueries: options.expandQueries ?? false
    }
  }

  private buildSystemPrompt(options: QueryGeneratorOptions): string {
    const locationContext = options.location 
      ? `Focus on businesses in or around ${options.location}.` 
      : 'Generate location-agnostic queries.'

    const keywordContext = [
      options.includeKeywords?.length ? `Include these keywords when relevant: ${options.includeKeywords.join(', ')}` : '',
      options.excludeKeywords?.length ? `Exclude these keywords: ${options.excludeKeywords.join(', ')}` : ''
    ].filter(Boolean).join(' ')

    return `You are an expert at generating effective search queries for business prospecting.
Given a user's business goal, analyze it to:
1. Identify the target industry with high precision
2. Determine the specific service being offered
3. Generate strategic search queries to find potential clients
4. ${locationContext}
5. ${keywordContext}

Return a JSON object with this structure:
{
  "queries": ["query1", "query2", ...], // Limited to ${options.maxQueries} most effective queries
  "targetIndustry": "precise industry name",
  "serviceOffering": "specific service type",
  "location": "${options.location || ''}", // If location-specific
  "metadata": {
    "industryConfidence": 0.95, // Confidence score 0-1
    "serviceConfidence": 0.95, // Confidence score 0-1
    "suggestedKeywords": ["keyword1", "keyword2"], // Industry-specific terms
    "locationSpecific": true/false // Whether queries are location-specific
  }
}`
  }

  async generateQueries(userGoal: string, options: QueryGeneratorOptions = {}): Promise<QueryGeneratorResult> {
    const validatedOptions = this.validateOptions(options)
    
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(validatedOptions)
        },
        {
          role: 'user',
          content: `Generate search queries for the following business goal: "${userGoal}"`
        }
      ]

      const response = await this.openai.createChatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 750
      })

      const result = JSON.parse(response) as QueryGeneratorResult
      
      // Validate and clean the result
      result.queries = result.queries
        .slice(0, validatedOptions.maxQueries)
        .map(q => q.trim())
        .filter(Boolean)

      if (result.queries.length === 0) {
        throw new Error('No valid queries generated')
      }

      // Expand queries if requested
      if (validatedOptions.expandQueries) {
        result.queries = await this.expandQueries(result.queries, result.targetIndustry, result.serviceOffering)
      }

      // Test and filter queries
      const testResults = await this.testQueries(result.queries, result.targetIndustry, result.serviceOffering)
      result.queries = testResults
        .filter(r => r.score >= 0.7) // Only keep queries with good scores
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .map(r => r.query)
        .slice(0, validatedOptions.maxQueries)

      logger.info('Generated search queries:', { 
        goal: userGoal,
        queries: result.queries,
        industry: result.targetIndustry,
        service: result.serviceOffering,
        location: result.location,
        metadata: result.metadata
      })
      
      return result
    } catch (error) {
      logger.error('Failed to generate queries:', { 
        goal: userGoal,
        options: validatedOptions,
        error
      })
      throw new Error(`Failed to generate search queries: ${error.message}`)
    }
  }

  /**
   * Expands a set of queries by generating variations and related queries
   */
  private async expandQueries(
    queries: string[],
    targetIndustry: string,
    serviceOffering: string
  ): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert at expanding search queries for business prospecting.
Given a set of base queries, generate variations and related queries that would help find
businesses in the ${targetIndustry} industry that might need ${serviceOffering} services.
Focus on:
1. Synonyms and alternative phrasings
2. Industry-specific terminology
3. Common business needs and pain points
4. Different business sizes/types
Return only the expanded queries as a JSON array of strings.`
      },
      {
        role: 'user',
        content: JSON.stringify(queries)
      }
    ]

    try {
      const response = await this.openai.createChatCompletion(messages, {
        temperature: 0.8, // Slightly higher for more variety
        maxTokens: 750
      })

      const expandedQueries = JSON.parse(response) as string[]
      return [...new Set([...queries, ...expandedQueries])] // Deduplicate
    } catch (error) {
      logger.warn('Query expansion failed, using original queries:', { error })
      return queries
    }
  }

  /**
   * Tests queries for effectiveness and relevance
   */
  private async testQueries(
    queries: string[],
    targetIndustry: string,
    serviceOffering: string
  ): Promise<QueryTestResult[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert at evaluating search queries for business prospecting.
For each query, evaluate:
1. Relevance to the ${targetIndustry} industry
2. Likelihood of finding businesses needing ${serviceOffering}
3. Specificity and focus
4. Proper syntax and formatting
Return a JSON array of objects with this structure:
{
  "query": "the query string",
  "score": 0.95, // 0-1 score
  "feedback": "brief explanation of the score"
}`
      },
      {
        role: 'user',
        content: JSON.stringify(queries)
      }
    ]

    try {
      const response = await this.openai.createChatCompletion(messages, {
        temperature: 0.3, // Lower for more consistent evaluation
        maxTokens: 750
      })

      return JSON.parse(response) as QueryTestResult[]
    } catch (error) {
      logger.warn('Query testing failed, returning default scores:', { error })
      return queries.map(q => ({
        query: q,
        score: 0.75, // Default "good enough" score
        feedback: 'Score defaulted due to testing error'
      }))
    }
  }
} 