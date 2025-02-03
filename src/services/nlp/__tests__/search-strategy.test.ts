import { NLPService } from '../service';
import { Context, SearchStrategy } from '../types';
import { DEFAULT_CONFIG, SYSTEM_PROMPTS } from '../config';

// Mock the OpenAI module
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
                industry: 'Technology',
                subIndustry: 'Software Development',
                companySize: ['50-200', '201-1000', '1000+'],
                businessType: ['Software Development', 'Technology Services']
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
              { type: 'INDUSTRY', value: 'software development', confidence: 0.9 },
              { type: 'TECHNOLOGY', value: 'AI', confidence: 0.95 },
              { type: 'TECHNOLOGY', value: 'machine learning', confidence: 0.95 },
              { type: 'LOCATION', value: 'San Francisco', confidence: 0.9 }
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
              'software development company AI machine learning San Francisco',
              'AI ML development firms SF Bay Area',
              'enterprise software companies San Francisco AI'
            ])
          }
        }]
      };
    }

    // Mock location extraction
    if (systemPrompt === SYSTEM_PROMPTS.locationExtraction) {
      if (prompt.includes('San Francisco')) {
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                latitude: 37.7749,
                longitude: -122.4194,
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
              companySize: ['50-200', '201-1000', '1000+'],
              businessType: ['Software Development', 'Technology Services'],
              certifications: ['ISO 27001', 'SOC 2'],
              founded: '>2010'
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

describe('Search Strategy Generation', () => {
  let nlpService: NLPService;
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    nlpService = new NLPService({
      config: {
        ...DEFAULT_CONFIG,
        openaiApiKey: 'test-key',
        cacheEnabled: true,
      },
      logger: mockLogger,
    });
  });

  it('should generate a complete search strategy with all components', async () => {
    const context: Context = {
      businessGoal: 'Find software development companies in San Francisco that specialize in AI and machine learning',
      industry: 'Technology',
      location: 'San Francisco, CA',
      targetMarket: 'Enterprise',
    };

    const strategy = await nlpService.generateSearchStrategy(context);

    expect(strategy).toBeDefined();
    expect(strategy.queries).toBeInstanceOf(Array);
    expect(strategy.queries.length).toBe(3);
    expect(strategy.filters).toBeDefined();
    expect(strategy.filters.intent).toBe('LEAD_GENERATION');
    expect(strategy.filters.companySize).toEqual(['50-200', '201-1000', '1000+']);
    expect(strategy.filters.businessType).toEqual(['Software Development', 'Technology Services']);
    expect(strategy.locationBias).toBeDefined();
    expect(strategy.locationBias?.latitude).toBe(37.7749);
    expect(strategy.locationBias?.longitude).toBe(-122.4194);
    expect(strategy.industry).toBe('Technology');
    expect(strategy.confidence).toBe(0.95);
    expect(strategy.ranking).toBeDefined();
    expect(strategy.ranking.relevanceFactors).toHaveLength(4);
    expect(strategy.ranking.boostFactors).toBeDefined();
    expect(strategy.ranking.boostFactors.hasWebsite).toBe(1.2);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Generated search strategy',
      expect.any(Object)
    );
  });

  it('should handle missing location gracefully', async () => {
    const context: Context = {
      businessGoal: 'Find software development companies specializing in AI',
      industry: 'Technology',
    };

    const strategy = await nlpService.generateSearchStrategy(context);

    expect(strategy).toBeDefined();
    expect(strategy.locationBias).toBeUndefined();
    expect(strategy.ranking.relevanceFactors.find((f: { name: string }) => f.name === 'locationProximity')?.weight).toBe(0);
  });

  it('should handle missing industry gracefully', async () => {
    const context: Context = {
      businessGoal: 'Find software companies in New York',
      location: 'New York, NY',
    };

    const strategy = await nlpService.generateSearchStrategy(context);

    expect(strategy).toBeDefined();
    expect(strategy.industry).toBeUndefined();
    expect(strategy.ranking.relevanceFactors.find((f: { name: string }) => f.name === 'industryMatch')?.weight).toBe(0);
  });

  it('should use cache when enabled', async () => {
    const context: Context = {
      businessGoal: 'Find marketing agencies in London',
      industry: 'Marketing',
      location: 'London, UK',
    };

    // First call should generate new strategy
    const strategy1 = await nlpService.generateSearchStrategy(context);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Generated search strategy',
      expect.any(Object)
    );

    // Second call should use cache
    const strategy2 = await nlpService.generateSearchStrategy(context);
    expect(strategy2).toEqual(strategy1);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
  });

  it('should throw error on invalid input', async () => {
    const invalidContext = {
      // Missing required businessGoal
      industry: 'Technology',
      location: 'San Francisco',
    } as Context;

    await expect(nlpService.generateSearchStrategy(invalidContext))
      .rejects
      .toThrow('Missing context');
  });

  it('should generate appropriate industry filters', async () => {
    const context: Context = {
      businessGoal: 'Find manufacturing companies that produce electric vehicle components',
      industry: 'Automotive Manufacturing',
      location: 'Detroit, MI',
    };

    const strategy = await nlpService.generateSearchStrategy(context);

    expect(strategy.filters).toBeDefined();
    expect(Object.keys(strategy.filters).length).toBeGreaterThan(1);
    expect(strategy.filters.intent).toBe('LEAD_GENERATION');
    expect(strategy.filters.companySize).toEqual(['50-200', '201-1000', '1000+']);
    expect(strategy.filters.businessType).toEqual(['Software Development', 'Technology Services']);
  });

  it('should handle API errors gracefully', async () => {
    // Mock OpenAI to throw an error
    const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API Error'))
        }
      }
    };

    const errorService = new NLPService({
      config: {
        ...DEFAULT_CONFIG,
        openaiApiKey: 'invalid-key',
      },
      logger: mockLogger,
      openai: mockOpenAI as any,
    });

    const context: Context = {
      businessGoal: 'Find software companies',
      industry: 'Technology',
    };

    await expect(errorService.generateSearchStrategy(context))
      .rejects
      .toThrow();
    expect(mockLogger.error).toHaveBeenCalled();
  });
}); 