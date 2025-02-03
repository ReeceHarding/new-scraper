import { SearchService } from '../service';
import { SearchQuery, SearchResult, SearchOptions, FilterOptions, RankingConfig } from '../types';

describe('SearchService', () => {
  let searchService: SearchService;
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    searchService = new SearchService({
      logger: mockLogger,
      config: {
        maxResults: 100,
        cacheEnabled: true,
        cacheTTL: 3600,
        timeout: 30000,
      }
    });
  });

  describe('search', () => {
    it('should perform a basic search', async () => {
      const query: SearchQuery = {
        text: 'software companies',
        filters: {
          industry: 'Technology',
          location: 'San Francisco'
        }
      };

      const options: SearchOptions = {
        limit: 10,
        offset: 0
      };

      // Mock cache hit
      const mockCacheGet = jest.fn().mockReturnValue([{
        id: '1',
        name: 'Tech Corp',
        description: 'Software company',
        industry: 'Technology',
        location: 'San Francisco',
        score: 0.8,
        metadata: {}
      }]);

      // @ts-expect-error - Mocking private property
      searchService.cache = {
        get: mockCacheGet,
        set: jest.fn()
      };

      const result = await searchService.search(query, options);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Using cached search results');
      expect(mockCacheGet).toHaveBeenCalled();
    });

    it('should handle search errors gracefully', async () => {
      const query: SearchQuery = {
        text: '',
        filters: {}
      };

      try {
        await searchService.search(query);
        fail('Expected search to throw an error');
      } catch (err) {
        const error = err as Error;
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Search query text is required');
        expect(mockLogger.error).toHaveBeenCalledWith('Search failed:', error);
      }
    });
  });

  describe('suggest', () => {
    it('should provide search suggestions', async () => {
      const query = 'soft';
      const suggestions = await searchService.suggest(query);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('filter', () => {
    it('should apply search filters', async () => {
      const filters: FilterOptions = {
        industry: ['Technology'],
        location: 'San Francisco',
        companySize: ['50-200', '201-1000']
      };

      const testResults: SearchResult[] = [
        {
          id: '1',
          name: 'Tech Corp',
          description: 'Software company',
          industry: 'Technology',
          location: 'San Francisco',
          score: 0.8,
          metadata: { companySize: '50-200' }
        },
        {
          id: '2',
          name: 'Other Corp',
          description: 'Other company',
          industry: 'Manufacturing',
          location: 'New York',
          score: 0.7,
          metadata: { companySize: '1000+' }
        }
      ];

      const filtered = await searchService.filter(testResults, filters);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });
  });

  describe('rank', () => {
    it('should rank search results', async () => {
      const results: SearchResult[] = [
        {
          id: '1',
          name: 'Tech Corp',
          description: 'Software company',
          industry: 'Technology',
          location: 'San Francisco',
          score: 0.8,
          metadata: {
            website: 'https://techcorp.com',
            contactInfo: true,
            isVerified: true
          }
        },
        {
          id: '2',
          name: 'Dev Inc',
          description: 'Development company',
          industry: 'Technology',
          location: 'San Francisco',
          score: 0.9,
          metadata: {
            website: 'https://devinc.com'
          }
        }
      ];

      const rankingConfig: RankingConfig = {
        relevanceFactors: [
          { name: 'industry', weight: 0.3 },
          { name: 'location', weight: 0.2 }
        ],
        boostFactors: {
          hasWebsite: 0.1,
          hasContactInfo: 0.2,
          isVerifiedBusiness: 0.3
        }
      };

      const ranked = await searchService.rank(results, rankingConfig);
      expect(ranked).toHaveLength(2);
      // First result should be Tech Corp due to boost factors
      expect(ranked[0].id).toBe('1');
    });
  });
}); 