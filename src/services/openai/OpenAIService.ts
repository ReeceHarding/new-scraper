import { OpenAI } from 'openai'
import { logger } from '@/services/logging'
import NodeCache from 'node-cache'
import { performance } from 'perf_hooks'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class OpenAIError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message)
    this.name = 'OpenAIError'
  }
}

export class OpenAIService {
  private static instance: OpenAIService
  private openai: OpenAI
  private cache: NodeCache
  private rateLimitDelay = 100 // Start with 100ms delay
  private readonly maxRetries = 3
  private readonly requestTimeout = 10000 // 10 seconds
  private readonly cacheExpiry = 3600 // 1 hour

  private constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY environment variable')
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0, // We handle retries ourselves
      timeout: this.requestTimeout
    })

    this.cache = new NodeCache({
      stdTTL: this.cacheExpiry,
      checkperiod: 120,
      useClones: false
    })

    // Reset rate limit delay every minute
    setInterval(() => {
      this.rateLimitDelay = 100
    }, 60000)
  }

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService()
    }
    return OpenAIService.instance
  }

  private getCacheKey(messages: ChatMessage[]): string {
    return JSON.stringify(messages)
  }

  private async handleRateLimit(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay))
    this.rateLimitDelay = Math.min(this.rateLimitDelay * 2, 5000) // Max 5s delay
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new OpenAIError('OpenAI request timed out'))
      }, timeoutMs)
    })

    try {
      const result = await Promise.race([promise, timeoutPromise])
      clearTimeout(timeoutHandle)
      return result
    } catch (error) {
      clearTimeout(timeoutHandle)
      throw error
    }
  }

  public async createChatCompletion(
    messages: ChatMessage[],
    options: {
      temperature?: number
      maxTokens?: number
      model?: string
    } = {}
  ): Promise<string> {
    const cacheKey = this.getCacheKey(messages)
    const cached = this.cache.get<string>(cacheKey)
    if (cached) {
      logger.info('Using cached OpenAI response', { messages })
      return cached
    }

    const startTime = performance.now()
    let attempts = 0

    while (attempts < this.maxRetries) {
      try {
        const response = await this.executeWithTimeout(
          this.openai.chat.completions.create({
            model: options.model || process.env.OPENAI_MODEL_VERSION,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
          }),
          this.requestTimeout
        )

        const endTime = performance.now()
        const duration = endTime - startTime

        // Log metrics
        logger.info('OpenAI request completed', {
          duration,
          attempts: attempts + 1,
          tokens: {
            prompt: response.usage?.prompt_tokens,
            completion: response.usage?.completion_tokens,
            total: response.usage?.total_tokens
          }
        })

        const result = response.choices[0].message.content
        this.cache.set(cacheKey, result)
        return result

      } catch (error: any) {
        attempts++

        if (error.name === 'RateLimitError') {
          if (attempts < this.maxRetries) {
            logger.warn('OpenAI rate limit hit, retrying...', {
              delay: this.rateLimitDelay,
              attempt: attempts
            })
            await this.handleRateLimit()
            continue
          }
        }

        logger.error('OpenAI request failed', {
          error: error.message,
          attempts,
          messages
        })

        if (attempts === this.maxRetries) {
          throw new OpenAIError(
            'OpenAI request failed after max retries',
            error
          )
        }
      }
    }

    throw new OpenAIError('OpenAI request failed unexpectedly')
  }
} 