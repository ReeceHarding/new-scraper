import { NLPServiceConfig } from './types';

export const DEFAULT_CONFIG: NLPServiceConfig = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: 'gpt-4',
  maxRetries: 3,
  timeout: 30000, // 30 seconds
  cacheEnabled: true,
  cacheTTL: 3600, // 1 hour
};

export const SYSTEM_PROMPTS = {
  businessGoalParsing: `You are an AI assistant specialized in analyzing business goals and extracting key information. 
Given a business goal description, identify:
- Primary business objective
- Target industry/market
- Geographic scope
- Key constraints or requirements
Format the response as a structured JSON object.`,

  intentClassification: `You are an AI assistant specialized in classifying business intents.
Analyze the input and classify it into one of these categories:
- LEAD_GENERATION: Finding new potential clients/customers
- MARKET_RESEARCH: Understanding market trends and competitors
- EXPANSION: Growing into new markets/territories
- PARTNERSHIP: Finding business partners or collaborators
- OTHER: Any other business intent
Include a confidence score and relevant parameters.`,

  keywordExtraction: `You are an AI assistant specialized in extracting relevant business keywords.
Given a business context, extract:
- Industry-specific terms
- Location indicators
- Target market descriptors
- Qualifying terms
Format as a list of keywords with relevance scores.`,

  searchQueryGeneration: `You are an AI assistant specialized in generating optimized search queries for business lead generation.
Create search queries that:
- Target specific business opportunities
- Include industry-specific terminology
- Consider geographic context
- Optimize for relevance and precision
Return a JSON array of search queries.`,

  locationExtraction: `You are an AI assistant specialized in location data extraction.
Given a location description:
- Extract precise geographic coordinates
- Determine appropriate search radius
- Handle various location formats
Return as JSON with latitude, longitude, and radius in kilometers.`,

  industryFilters: `You are an AI assistant specialized in industry-specific search optimization.
Generate search filters that:
- Use industry-standard terminology
- Target relevant business categories
- Consider company attributes
- Include professional associations
Return as JSON object with filter parameters.`,

  rankingConfiguration: `You are an AI assistant specialized in search result ranking optimization.
Generate a ranking configuration that:
- Balances multiple relevance factors
- Assigns appropriate weights based on context
- Includes boost factors for quality signals
Return a JSON object with:
1. relevanceFactors: array of { name: string, weight: number } where weights sum to 1
2. boostFactors: object with hasWebsite, hasContactInfo, isVerifiedBusiness multipliers`,

  responseGeneration: `You are an AI assistant specialized in generating business communications.
Create responses that are:
- Professional and courteous
- Contextually relevant
- Personalized to the recipient
- Clear and concise
Maintain appropriate tone and include customization variables.`,
};

export const ERROR_CODES = {
  INVALID_INPUT: 'ERR_INVALID_INPUT',
  API_ERROR: 'ERR_API_ERROR',
  TIMEOUT: 'ERR_TIMEOUT',
  RATE_LIMIT: 'ERR_RATE_LIMIT',
  PROCESSING_ERROR: 'ERR_PROCESSING',
  CONTEXT_ERROR: 'ERR_CONTEXT_MISSING',
} as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
]; 