import { mockLogger, mockFormat } from '../../utils/test-utils';
import { supabase } from '@/lib/supabase';
import { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js';
import { ContentAnalyzer } from '../../../src/services/analyzer/ContentAnalyzer';
import { OpenAIService } from '../../../src/services/openai/OpenAIService';
import { logger } from '../../../src/lib/logging';

// Mock winston before any imports
jest.mock('winston', () => ({
  format: mockFormat,
  transports: {
    Console: jest.fn().mockImplementation(() => ({
      log: jest.fn()
    })),
    File: jest.fn().mockImplementation(() => ({
      log: jest.fn()
    }))
  },
  createLogger: jest.fn().mockReturnValue(mockLogger),
  addColors: jest.fn()
}));

// Mock dependencies before any imports
jest.mock('@/lib/logging', () => ({
  logger: mockLogger,
  baseLogger: mockLogger,
  createLogger: () => mockLogger,
  initializeLogger: jest.fn().mockResolvedValue(undefined),
  __esModule: true
}));

type MockPostgrestError = {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
};

const createSuccessResponse = <T>(data: T[]): PostgrestResponse<T> => ({
  data,
  error: null,
  count: data.length,
  status: 200,
  statusText: 'OK'
});

const createSuccessSingleResponse = <T>(data: T): PostgrestSingleResponse<T> => ({
  data,
  error: null,
  count: 1,
  status: 200,
  statusText: 'OK'
});

// Mock OpenAIService before any imports
jest.mock('../../../src/services/openai/OpenAIService', () => ({
  OpenAIService: {
    getInstance: jest.fn().mockReturnValue({
      createChatCompletion: jest.fn()
    })
  }
}));

jest.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null }))
          })),
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: '123' }, error: null }))
        }))
      }))
    }))
  }
}));

describe('ContentAnalyzer Storage', () => {
  let analyzer: ContentAnalyzer;
  let mockOpenAI: jest.Mocked<OpenAIService>;
  let mockSupabase: jest.Mocked<typeof supabase>;

  beforeEach(() => {
    mockOpenAI = {
      createChatCompletion: jest.fn()
    } as unknown as jest.Mocked<OpenAIService>;

    jest.spyOn(OpenAIService, 'getInstance').mockReturnValue(mockOpenAI);
    
    analyzer = new ContentAnalyzer();
    jest.clearAllMocks();

    mockSupabase = supabase as jest.Mocked<typeof supabase>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('analyzeContent with storage', () => {
    const validContent = '<html><body>Test content</body></html>';
    const validUrl = 'https://test.com';
    const validAnalysis = {
      summary: 'Test summary',
      metadata: { companyName: 'Test Co' },
      sentiment: {
        score: 0.8,
        label: 'positive'
      },
      entities: [{
        name: 'Test Co',
        type: 'ORGANIZATION',
        mentions: 1
      }],
      keywords: [{
        keyword: 'test',
        relevance: 0.9
      }],
      topics: ['technology'],
      readability: {
        score: 85,
        level: 'Intermediate'
      },
      classification: {
        category: 'Technology',
        confidence: 0.95
      }
    };

    it('should analyze and store content successfully', async () => {
      mockOpenAI.createChatCompletion.mockResolvedValue(JSON.stringify(validAnalysis));
      
      const mockStoredAnalysis = {
        id: '123',
        url: validUrl,
        content_hash: 'hash',
        ...validAnalysis
      };

      const mockFrom = mockSupabase.from as jest.Mock;
      mockFrom.mockImplementation((table: string) => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null })
            }),
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockStoredAnalysis, error: null })
          })
        })
      }));

      const result = await analyzer.analyzeContent(validContent, validUrl);
      expect(result).toEqual(validAnalysis);
      expect(logger.info).toHaveBeenCalledWith('Starting content analysis', { url: validUrl });
    });

    it('should handle analysis errors gracefully', async () => {
      const testContent = '<html><body>Test content for analysis</body></html>';
      const testUrl = 'https://test.com';

      // Mock OpenAIService to throw an error
      const mockOpenAIService = require('../../../src/services/openai/OpenAIService').OpenAIService;
      mockOpenAIService.getInstance().createChatCompletion.mockRejectedValueOnce(new Error('API Error'));

      await expect(analyzer.analyzeContent(testContent, testUrl)).rejects.toThrow('Failed to analyze content');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
}); 