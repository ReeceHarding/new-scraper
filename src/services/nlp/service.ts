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

    const cacheKey = this.getCacheKey('generateSearchStrategy', JSON.stringify(context));
    if (this.config.cacheEnabled && this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug('Using cached search strategy');
        return cached;
      }
    }

    try {
      // Get intent and keywords in parallel for better performance
      const [intent, keywords] = await Promise.all([
        this.classifyIntent(context.businessGoal),
        this.extractKeywords(context)
      ]);

      // Generate optimized search queries based on intent and keywords
      const queryPrompt = `Generate optimized search queries for the following business goal:
Goal: ${context.businessGoal}
Industry: ${context.industry || 'any'}
Intent: ${intent.type}
Keywords: ${keywords.map(k => k.value).join(', ')}

Return a JSON array of search queries optimized for business lead generation.`;

      const queriesResponse = await this.callOpenAI(
        queryPrompt,
        SYSTEM_PROMPTS.searchQueryGeneration,
        0.7
      );
      
      const queries = JSON.parse(queriesResponse) as string[];

      // Build location bias if location is provided
      let locationBias;
      if (context.location) {
        const locationPrompt = `Extract precise location information from: ${context.location}
Return as JSON with latitude, longitude, and appropriate search radius in kilometers.
If exact coordinates cannot be determined, return null.`;

        const locationResponse = await this.callOpenAI(
          locationPrompt,
          SYSTEM_PROMPTS.locationExtraction,
          0.3
        );
        
        try {
          locationBias = JSON.parse(locationResponse);
          if (locationBias === null) {
            locationBias = undefined;
          }
        } catch (e) {
          this.logger.warn('Failed to parse location response:', e);
          locationBias = undefined;
        }
      }

      // Generate industry-specific filters
      let industryFilters = {};
      if (context.industry) {
        const filterPrompt = `Generate search filters for the ${context.industry} industry.
Consider:
- Common industry terminology
- Relevant business categories
- Typical company sizes
- Professional associations
Return as JSON object with filter parameters.`;

        const filtersResponse = await this.callOpenAI(
          filterPrompt,
          SYSTEM_PROMPTS.industryFilters,
          0.5
        );
        
        try {
          industryFilters = JSON.parse(filtersResponse);
        } catch (e) {
          this.logger.warn('Failed to parse industry filters:', e);
          industryFilters = {};
        }
      }

      // Generate ranking configuration
      const rankingPrompt = `Generate ranking configuration for the following context:
Business Goal: ${context.businessGoal}
Industry: ${context.industry || 'any'}
Location: ${context.location || 'any'}

Return a JSON object with:
1. relevanceFactors: array of { name: string, weight: number } where weights sum to 1
2. boostFactors: object with hasWebsite, hasContactInfo, isVerifiedBusiness multipliers`;

      const rankingResponse = await this.callOpenAI(
        rankingPrompt,
        SYSTEM_PROMPTS.rankingConfiguration,
        0.3
      );

      let ranking;
      try {
        ranking = JSON.parse(rankingResponse);
      } catch (e) {
        this.logger.warn('Failed to parse ranking configuration:', e);
        ranking = {
          relevanceFactors: [
            { name: 'intentMatch', weight: 0.3 },
            { name: 'locationProximity', weight: context.location ? 0.3 : 0 },
            { name: 'industryMatch', weight: context.industry ? 0.2 : 0 },
            { name: 'keywordPresence', weight: 0.2 }
          ],
          boostFactors: {
            hasWebsite: 1.2,
            hasContactInfo: 1.3,
            isVerifiedBusiness: 1.5
          }
        };
      }

      // Combine everything into a search strategy
      const strategy: SearchStrategy = {
        queries: queries.map(q => q.trim()),
        filters: {
          intent: intent.type,
          ...intent.parameters,
          ...industryFilters
        },
        industry: context.industry,
        confidence: intent.confidence,
        locationBias: locationBias || undefined,
        ranking
      };

      // Cache the generated strategy
      if (this.config.cacheEnabled && this.cache) {
        this.cache.set(cacheKey, strategy);
        this.logger.debug('Cached search strategy');
      }

      // Log search strategy creation for tracking
      this.logger.info('Generated search strategy', {
        context: {
          businessGoal: context.businessGoal,
          industry: context.industry,
          location: context.location
        },
        strategy: {
          queryCount: strategy.queries.length,
          filterCount: Object.keys(strategy.filters).length,
          confidence: strategy.confidence,
          hasLocation: !!locationBias,
          hasIndustryFilters: Object.keys(industryFilters).length > 0
        }
      });

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