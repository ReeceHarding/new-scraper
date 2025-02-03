import 'openai/shims/node';
import { OpenAI } from 'openai';
import { NLPService } from '../service';
import { Context, Intent, Entity, LanguageDetectionResult, ResponseTemplate } from '../types';
import { ERROR_CODES } from '../config';

// Mock OpenAI
jest.mock('openai');

// Create a proper mock type for OpenAI chat completions
type MockOpenAIChat = {
  completions: {
    create: jest.Mock;
  };
};

type MockOpenAI = {
  chat: MockOpenAIChat;
};

describe('NLPService', () => {
  let nlpService: NLPService;
  let mockOpenAI: MockOpenAI;
  let mockLogger: { error: jest.Mock; info: jest.Mock };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
    };

    // Create mock OpenAI instance with proper typing
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };

    // Initialize service with mocks
    nlpService = new NLPService({
      config: {
        openaiApiKey: 'test-key',
        openaiModel: 'gpt-4',
        maxRetries: 3,
        timeout: 30000,
        cacheEnabled: true,
        cacheTTL: 3600,
      },
      logger: mockLogger,
      openai: mockOpenAI as unknown as OpenAI,
    });
  });

  describe('processBusinessGoal', () => {
    const mockContext: Context = {
      businessGoal: 'I want to find dentists in New York',
      industry: 'healthcare',
      location: 'New York',
      targetMarket: 'dentists',
    };

    it('should process a valid business goal', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockContext) } }],
      });

      const result = await nlpService.processBusinessGoal('I want to find dentists in New York');
      expect(result).toEqual(mockContext);
    });

    it('should throw on invalid input', async () => {
      await expect(nlpService.processBusinessGoal('')).rejects.toThrow('Invalid business goal text');
    });

    it('should use cache when available', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockContext) } }],
      });

      // First call should hit the API
      await nlpService.processBusinessGoal('I want to find dentists in New York');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await nlpService.processBusinessGoal('I want to find dentists in New York');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('classifyIntent', () => {
    const mockIntent: Intent = {
      type: 'LEAD_GENERATION',
      confidence: 0.95,
      parameters: {
        industry: 'healthcare',
        location: 'New York',
      },
    };

    it('should classify intent correctly', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockIntent) } }],
      });

      const result = await nlpService.classifyIntent('I want to find dentists in New York');
      expect(result).toEqual(mockIntent);
    });

    it('should throw on invalid input', async () => {
      await expect(nlpService.classifyIntent('')).rejects.toThrow('Invalid input text');
    });
  });

  describe('extractKeywords', () => {
    const mockContext: Context = {
      businessGoal: 'I want to find dentists in New York',
      industry: 'healthcare',
    };

    const mockKeywords: Entity[] = [
      { type: 'industry', value: 'dentist', confidence: 0.9 },
      { type: 'location', value: 'New York', confidence: 0.95 },
    ];

    it('should extract keywords correctly', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockKeywords) } }],
      });

      const result = await nlpService.extractKeywords(mockContext);
      expect(result).toEqual(mockKeywords);
    });

    it('should throw on invalid context', async () => {
      await expect(nlpService.extractKeywords({} as Context)).rejects.toThrow('Invalid context');
    });
  });

  describe('generateSearchStrategy', () => {
    const mockContext: Context = {
      businessGoal: 'I want to find dentists in New York',
      industry: 'healthcare',
      location: 'New York',
    };

    const mockIntent: Intent = {
      type: 'LEAD_GENERATION',
      confidence: 0.95,
      parameters: { industry: 'healthcare' },
    };

    const mockKeywords: Entity[] = [
      { type: 'industry', value: 'dentist', confidence: 0.9 },
      { type: 'location', value: 'New York', confidence: 0.95 },
    ];

    it('should generate search strategy correctly', async () => {
      // Mock the dependent method calls
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(mockIntent) } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(mockKeywords) } }] });

      const result = await nlpService.generateSearchStrategy(mockContext);
      
      expect(result.queries).toContain('dentist');
      expect(result.queries).toContain('New York');
      expect(result.filters.intent).toBe('LEAD_GENERATION');
      expect(result.industry).toBe('healthcare');
      expect(result.locationBias).toBeDefined();
    });

    it('should throw on invalid context', async () => {
      await expect(nlpService.generateSearchStrategy({} as Context)).rejects.toThrow('Missing context');
    });
  });

  describe('detectLanguage', () => {
    const mockDetection: LanguageDetectionResult = {
      language: 'en',
      confidence: 0.98,
    };

    it('should detect language correctly', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockDetection) } }],
      });

      const result = await nlpService.detectLanguage('Hello world');
      expect(result).toEqual(mockDetection);
    });

    it('should throw on invalid input', async () => {
      await expect(nlpService.detectLanguage('')).rejects.toThrow('Invalid input text');
    });
  });

  describe('translate', () => {
    it('should translate text correctly', async () => {
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: 'Hola mundo' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ language: 'en', confidence: 0.98 }) } }] });

      const result = await nlpService.translate('Hello world', 'es');
      expect(result.translatedText).toBe('Hola mundo');
      expect(result.detectedLanguage).toBe('en');
    });

    it('should throw on invalid input', async () => {
      await expect(nlpService.translate('', 'es')).rejects.toThrow('Invalid input');
    });

    it('should throw on unsupported language', async () => {
      await expect(nlpService.translate('Hello', 'xx')).rejects.toThrow('Unsupported target language');
    });
  });

  describe('generateResponse', () => {
    const mockContext: Context = {
      businessGoal: 'I want to find dentists in New York',
      industry: 'healthcare',
    };

    const mockTemplate: ResponseTemplate = {
      type: 'outreach',
      content: 'Hello {{name}}, I noticed your dental practice in New York...',
      tone: 'professional',
      variables: {
        name: '{{name}}',
      },
    };

    it('should generate response correctly', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockTemplate) } }],
      });

      const result = await nlpService.generateResponse(mockContext);
      expect(result).toEqual(mockTemplate);
    });

    it('should throw on invalid context', async () => {
      await expect(nlpService.generateResponse({} as Context)).rejects.toThrow('Missing context');
    });
  });

  describe('error handling', () => {
    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));

      await expect(nlpService.processBusinessGoal('test')).rejects.toMatchObject({
        code: ERROR_CODES.PROCESSING_ERROR,
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle JSON parsing errors', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: 'invalid json' } }],
      });

      await expect(nlpService.processBusinessGoal('test')).rejects.toMatchObject({
        code: ERROR_CODES.PROCESSING_ERROR,
      });
    });
  });
}); 