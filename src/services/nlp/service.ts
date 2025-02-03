import 'openai/shims/node';
import { OpenAI } from 'openai';
import { LRUCache } from 'lru-cache';
import {
  Entity,
  Intent,
  Context,
  SearchStrategy,
  NLPServiceConfig,
  NLPServiceOptions,
  TranslationResult,
  LanguageDetectionResult,
  ResponseTemplate,
  ProcessingError,
} from './types';
import { DEFAULT_CONFIG, SYSTEM_PROMPTS, ERROR_CODES, SUPPORTED_LANGUAGES } from './config';

export class NLPService {
  private openai: OpenAI;
  private config: NLPServiceConfig;
  private logger: any;
  private cache: LRUCache<string, any> | null = null;

  constructor(options: NLPServiceOptions) {
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.logger = options.logger || console;
    this.openai = options.openai || new OpenAI({ apiKey: this.config.openaiApiKey });
    
    if (this.config.cacheEnabled) {
      this.cache = new LRUCache({
        max: 1000,
        ttl: this.config.cacheTTL * 1000,
      });
    }
  }

  private async callOpenAI(
    prompt: string,
    systemPrompt: string,
    temperature: number = 0.7,
    maxTokens: number = 500
  ): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      this.logger.error('OpenAI API error:', error);
      throw this.createError(ERROR_CODES.API_ERROR, error.message, true);
    }
  }

  private createError(code: string, message: string, retryable: boolean): ProcessingError {
    const error = new Error(message) as ProcessingError;
    error.code = code;
    error.retryable = retryable;
    return error;
  }

  private getCacheKey(method: string, input: string): string {
    return `${method}:${input}`;
  }

  async processBusinessGoal(text: string): Promise<Context> {
    if (!text || typeof text !== 'string') {
      throw this.createError(ERROR_CODES.INVALID_INPUT, 'Invalid business goal text', false);
    }

    const cacheKey = this.getCacheKey('processBusinessGoal', text);
    if (this.config.cacheEnabled && this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const response = await this.callOpenAI(
        text,
        SYSTEM_PROMPTS.businessGoalParsing,
        0.3
      );
      
      const context = JSON.parse(response) as Context;
      if (this.config.cacheEnabled && this.cache) {
        this.cache.set(cacheKey, context);
      }
      
      return context;
    } catch (error: any) {
      this.logger.error('Failed to process business goal:', error);
      throw this.createError(
        ERROR_CODES.PROCESSING_ERROR,
        'Failed to process business goal',
        true
      );
    }
  }

  async classifyIntent(text: string): Promise<Intent> {
    if (!text || typeof text !== 'string') {
      throw this.createError(ERROR_CODES.INVALID_INPUT, 'Invalid input text', false);
    }

    const cacheKey = this.getCacheKey('classifyIntent', text);
    if (this.config.cacheEnabled && this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const response = await this.callOpenAI(
        text,
        SYSTEM_PROMPTS.intentClassification,
        0.3
      );
      
      const intent = JSON.parse(response) as Intent;
      if (this.config.cacheEnabled && this.cache) {
        this.cache.set(cacheKey, intent);
      }
      
      return intent;
    } catch (error: any) {
      this.logger.error('Failed to classify intent:', error);
      throw this.createError(
        ERROR_CODES.PROCESSING_ERROR,
        'Failed to classify intent',
        true
      );
    }
  }

  async extractKeywords(context: Context): Promise<Entity[]> {
    if (!context || !context.businessGoal) {
      throw this.createError(ERROR_CODES.INVALID_INPUT, 'Invalid context', false);
    }

    const cacheKey = this.getCacheKey('extractKeywords', JSON.stringify(context));
    if (this.config.cacheEnabled && this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const response = await this.callOpenAI(
        JSON.stringify(context),
        SYSTEM_PROMPTS.keywordExtraction,
        0.3
      );
      
      const keywords = JSON.parse(response) as Entity[];
      if (this.config.cacheEnabled && this.cache) {
        this.cache.set(cacheKey, keywords);
      }
      
      return keywords;
    } catch (error: any) {
      this.logger.error('Failed to extract keywords:', error);
      throw this.createError(
        ERROR_CODES.PROCESSING_ERROR,
        'Failed to extract keywords',
        true
      );
    }
  }

  async generateSearchStrategy(context: Context): Promise<SearchStrategy> {
    if (!context || !context.businessGoal) {
      throw this.createError(ERROR_CODES.CONTEXT_ERROR, 'Missing context', false);
    }

    try {
      const intent = await this.classifyIntent(context.businessGoal);
      const keywords = await this.extractKeywords(context);
      
      // Combine intent and keywords to generate search strategy
      const strategy: SearchStrategy = {
        queries: keywords
          .filter(k => k.confidence > 0.6)
          .map(k => k.value),
        filters: {
          intent: intent.type,
          ...intent.parameters,
        },
        industry: context.industry,
        confidence: intent.confidence,
      };

      if (context.location) {
        // Add location bias if available
        // This would be enhanced with actual geocoding in production
        strategy.locationBias = {
          radius: 50, // Default 50km radius
        };
      }

      return strategy;
    } catch (error: any) {
      this.logger.error('Failed to generate search strategy:', error);
      throw this.createError(
        ERROR_CODES.PROCESSING_ERROR,
        'Failed to generate search strategy',
        true
      );
    }
  }

  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    if (!text || typeof text !== 'string') {
      throw this.createError(ERROR_CODES.INVALID_INPUT, 'Invalid input text', false);
    }

    try {
      // Use OpenAI to detect language
      const response = await this.callOpenAI(
        `Detect the language of this text and return confidence score: ${text}`,
        'You are a language detection expert. Return result as JSON with "language" (ISO code) and "confidence" (0-1).',
        0.3
      );
      
      return JSON.parse(response) as LanguageDetectionResult;
    } catch (error: any) {
      this.logger.error('Failed to detect language:', error);
      throw this.createError(
        ERROR_CODES.PROCESSING_ERROR,
        'Failed to detect language',
        true
      );
    }
  }

  async translate(text: string, targetLanguage: string): Promise<TranslationResult> {
    if (!text || !targetLanguage) {
      throw this.createError(ERROR_CODES.INVALID_INPUT, 'Invalid input', false);
    }

    if (!SUPPORTED_LANGUAGES.find(lang => lang.code === targetLanguage)) {
      throw this.createError(ERROR_CODES.INVALID_INPUT, 'Unsupported target language', false);
    }

    try {
      const response = await this.callOpenAI(
        `Translate this text to ${targetLanguage}: ${text}`,
        'You are a professional translator. Translate the text accurately while maintaining the original meaning and tone.',
        0.3
      );
      
      const detectionResult = await this.detectLanguage(text);
      
      return {
        translatedText: response,
        detectedLanguage: detectionResult.language,
        confidence: detectionResult.confidence,
      };
    } catch (error: any) {
      this.logger.error('Failed to translate text:', error);
      throw this.createError(
        ERROR_CODES.PROCESSING_ERROR,
        'Failed to translate text',
        true
      );
    }
  }

  async generateResponse(context: Context): Promise<ResponseTemplate> {
    if (!context || !context.businessGoal) {
      throw this.createError(ERROR_CODES.CONTEXT_ERROR, 'Missing context', false);
    }

    try {
      const response = await this.callOpenAI(
        JSON.stringify(context),
        SYSTEM_PROMPTS.responseGeneration,
        0.7
      );
      
      return JSON.parse(response) as ResponseTemplate;
    } catch (error: any) {
      this.logger.error('Failed to generate response:', error);
      throw this.createError(
        ERROR_CODES.PROCESSING_ERROR,
        'Failed to generate response',
        true
      );
    }
  }
} 