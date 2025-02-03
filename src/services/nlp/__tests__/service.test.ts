import 'openai/shims/node';
import { OpenAI } from 'openai';
import { NLPService } from '../service';
import { Context, Intent, Entity, LanguageDetectionResult, ResponseTemplate } from '../types';
import { ERROR_CODES, SYSTEM_PROMPTS } from '../config';

// Mock OpenAI
jest.mock('openai', () => {
  const mockCreate = jest.fn().mockImplementation(async ({ messages }) => {
    const prompt = messages[1].content;
    const systemPrompt = messages[0].content;

    // Mock intent classification
    if (systemPrompt === SYSTEM_PROMPTS.intentClassification) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              type: 'LEAD_GENERATION',
              confidence: 0.95,
              parameters: {
                industry: 'healthcare',
                location: 'New York'
              }
            })
          }
        }]
      };
    }

    // Mock keyword extraction
    if (systemPrompt === SYSTEM_PROMPTS.keywordExtraction) {
      return {
        choices: [{
          message: {
            content: JSON.stringify([
              { type: 'industry', value: 'dentist', confidence: 0.9 },
              { type: 'location', value: 'New York', confidence: 0.95 }
            ])
          }
        }]
      };
    }

    // Mock search query generation
    if (systemPrompt === SYSTEM_PROMPTS.searchQueryGeneration) {
      return {
        choices: [{
          message: {
            content: JSON.stringify([
              'dentists in New York',
              'dental practices NYC',
              'healthcare providers dentistry New York'
            ])
          }
        }]
      };
    }

    // Mock location extraction
    if (systemPrompt === SYSTEM_PROMPTS.locationExtraction) {
      if (prompt.includes('New York')) {
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                latitude: 40.7128,
                longitude: -74.0060,
                radius: 25
              })
            }
          }]
        };
      }
      return {
        choices: [{
          message: {
            content: 'null'
          }
        }]
      };
    }

    // Mock industry filters
    if (systemPrompt === SYSTEM_PROMPTS.industryFilters) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              companySize: ['1-10', '11-50', '51-200'],
              businessType: ['Healthcare', 'Dental Practice'],
              certifications: ['ADA', 'AAID'],
              founded: '>1990'
            })
          }
        }]
      };
    }

    // Mock ranking configuration
    if (systemPrompt === SYSTEM_PROMPTS.rankingConfiguration) {
      // Extract context from the prompt
      const hasLocation = prompt.includes('Location: any') ? false : true;
      const hasIndustry = prompt.includes('Industry: any') ? false : true;

      return {
        choices: [{
          message: {
            content: JSON.stringify({
              relevanceFactors: [
                { name: 'industryMatch', weight: hasIndustry ? 0.4 : 0 },
                { name: 'locationProximity', weight: hasLocation ? 0.3 : 0 },
                { name: 'businessSize', weight: hasIndustry ? 0.2 : 0.3 },
                { name: 'certifications', weight: 0.1 }
              ],
              boostFactors: {
                hasWebsite: 1.2,
                hasContactInfo: 1.1,
                isVerifiedBusiness: 1.3
              }
            })
          }
        }]
      };
    }

    // Default response
    return {
      choices: [{
        message: {
          content: JSON.stringify({})
        }
      }]
    };
  });

  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  };
});

describe('NLPService', () => {
  let nlpService: NLPService;
  let mockOpenAI: { chat: { completions: { create: jest.Mock } } };
  let mockLogger: { error: jest.Mock; info: jest.Mock; warn: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
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
      businessGoal: 'Find dentists in New York',
      industry: 'healthcare',
      location: 'New York',
      targetMarket: 'dentists'
    };

    it('should generate search strategy correctly', async () => {
      // Mock successful responses for all API calls
      mockOpenAI.chat.completions.create
        // Mock intent classification
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                type: 'LEAD_GENERATION',
                confidence: 0.95,
                parameters: {
                  industry: 'healthcare',
                  location: 'New York'
                }
              })
            }
          }]
        })
        // Mock keyword extraction
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify([
                { type: 'industry', value: 'dentist', confidence: 0.9 },
                { type: 'location', value: 'New York', confidence: 0.95 }
              ])
            }
          }]
        })
        // Mock search query generation
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify([
                'dentists in New York',
                'dental practices NYC',
                'healthcare providers dentistry New York'
              ])
            }
          }]
        })
        // Mock location extraction
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                latitude: 40.7128,
                longitude: -74.0060,
                radius: 25
              })
            }
          }]
        })
        // Mock industry filters
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                companySize: ['1-10', '11-50', '51-200'],
                businessType: ['Healthcare', 'Dental Practice'],
                certifications: ['ADA', 'AAID'],
                founded: '>1990'
              })
            }
          }]
        })
        // Mock ranking configuration
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                relevanceFactors: [
                  { name: 'industryMatch', weight: 0.4 },
                  { name: 'locationProximity', weight: 0.3 },
                  { name: 'businessSize', weight: 0.2 },
                  { name: 'certifications', weight: 0.1 }
                ],
                boostFactors: {
                  hasWebsite: 1.2,
                  hasContactInfo: 1.1,
                  isVerifiedBusiness: 1.3
                }
              })
            }
          }]
        });

      const result = await nlpService.generateSearchStrategy(mockContext);
      
      // Verify the structure matches SearchStrategy interface
      expect(result).toBeDefined();
      expect(result.queries).toBeInstanceOf(Array);
      expect(result.queries.length).toBe(3);
      expect(result.queries[0]).toBe('dentists in New York');
      
      expect(result.filters).toBeDefined();
      expect(result.filters.intent).toBe('LEAD_GENERATION');
      expect(result.filters.companySize).toEqual(['1-10', '11-50', '51-200']);
      
      expect(result.locationBias).toBeDefined();
      expect(result.locationBias?.latitude).toBe(40.7128);
      expect(result.locationBias?.longitude).toBe(-74.0060);
      
      expect(result.industry).toBe('healthcare');
      expect(result.confidence).toBe(0.95);
      
      expect(result.ranking).toBeDefined();
      expect(result.ranking.relevanceFactors).toHaveLength(4);
      expect(result.ranking.boostFactors).toBeDefined();
      expect(result.ranking.boostFactors.hasWebsite).toBe(1.2);
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