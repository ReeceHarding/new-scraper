import 'openai/shims/node';
import { OpenAI } from 'openai';

export interface Entity {
  type: string;
  value: string;
  confidence: number;
}

export interface Intent {
  type: string;
  confidence: number;
  parameters: Record<string, any>;
}

export interface Context {
  businessGoal: string;
  industry?: string;
  location?: string;
  targetMarket?: string;
  constraints?: string[];
  history?: string[];
}

export interface SearchStrategy {
  queries: string[];
  filters: Record<string, any>;
  locationBias?: {
    latitude?: number;
    longitude?: number;
    radius?: number;
  };
  industry?: string;
  confidence: number;
  ranking: {
    relevanceFactors: Array<{
      name: string;
      weight: number;
    }>;
    boostFactors: {
      hasWebsite: number;
      hasContactInfo: number;
      isVerifiedBusiness: number;
    };
  };
}

export interface NLPServiceConfig {
  openaiApiKey: string;
  openaiModel: string;
  maxRetries: number;
  timeout: number;
  cacheEnabled: boolean;
  cacheTTL: number;
}

export interface NLPServiceOptions {
  config: NLPServiceConfig;
  logger?: any;
  openai?: OpenAI;
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  alternatives?: Array<{
    language: string;
    confidence: number;
  }>;
}

export interface ResponseTemplate {
  type: string;
  content: string;
  tone: string;
  variables: Record<string, string>;
}

export interface ProcessingError extends Error {
  code: string;
  details?: any;
  retryable: boolean;
} 