import { OpenAI } from 'openai'
import { logger } from '@/services/logging'

interface QueryGeneratorResult {
  queries: string[]
  targetIndustry: string
  serviceOffering: string
}

export class QueryGenerator {
  private openai: OpenAI
  
  constructor() {
    this.openai = new OpenAI()
  }

  async generateQueries(userGoal: string): Promise<QueryGeneratorResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL_VERSION,
        messages: [
          {
            role: 'system',
            content: `You are an expert at generating effective search queries for business prospecting.
            Given a user's business goal, generate a list of search queries that would find potential clients.
            Focus on location-based and industry-specific queries that would lead to business websites.
            Return a JSON object with the following structure:
            {
              "queries": ["query1", "query2", ...],
              "targetIndustry": "industry name",
              "serviceOffering": "service type"
            }`
          },
          {
            role: 'user',
            content: `Generate search queries for the following business goal: "${userGoal}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })

      const result = JSON.parse(response.choices[0].message.content) as QueryGeneratorResult
      logger.info('Generated search queries:', { goal: userGoal, queries: result.queries })
      
      return result
    } catch (error) {
      logger.error('Failed to generate queries:', { goal: userGoal, error })
      throw new Error(`Failed to generate search queries: ${error.message}`)
    }
  }
} 