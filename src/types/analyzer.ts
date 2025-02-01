export interface ContentToAnalyze {
  title: string;
  text: string;
  html: string;
  metadata?: {
    description?: string;
    keywords?: string[];
    [key: string]: any;
  };
}

export interface AnalyzedContent {
  summary: string;
  classification: {
    industry: string;
    subIndustry: string;
  };
  sentiment: 'positive' | 'negative' | 'neutral';
  entities: string[];
  keywords: string[];
  topics: string[];
}

export interface AnalysisOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
} 