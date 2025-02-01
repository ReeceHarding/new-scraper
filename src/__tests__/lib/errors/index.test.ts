import {
  AppError,
  SearchError,
  AnalysisError,
  BrowserError,
  DatabaseError,
  APIError,
  ValidationError,
  RateLimitError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConfigError
} from '@/lib/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create base error with default values', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    it('should create base error with custom values', () => {
      const error = new AppError('Custom error', 'CUSTOM_CODE', 418, false);
      expect(error.message).toBe('Custom error');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.statusCode).toBe(418);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('SearchError', () => {
    it('should create search error with correct properties', () => {
      const error = new SearchError('Search failed');
      expect(error.message).toBe('Search failed');
      expect(error.code).toBe('SEARCH_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('SearchError');
    });
  });

  describe('AnalysisError', () => {
    it('should create analysis error with correct properties', () => {
      const error = new AnalysisError('Analysis failed');
      expect(error.message).toBe('Analysis failed');
      expect(error.code).toBe('ANALYSIS_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AnalysisError');
    });
  });

  describe('BrowserError', () => {
    it('should create browser error with correct properties', () => {
      const error = new BrowserError('Browser failed');
      expect(error.message).toBe('Browser failed');
      expect(error.code).toBe('BROWSER_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('BrowserError');
    });
  });

  describe('DatabaseError', () => {
    it('should create database error with correct properties', () => {
      const error = new DatabaseError('Database failed');
      expect(error.message).toBe('Database failed');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('DatabaseError');
    });
  });

  describe('APIError', () => {
    it('should create API error with default status code', () => {
      const error = new APIError('API failed');
      expect(error.message).toBe('API failed');
      expect(error.code).toBe('API_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('APIError');
    });

    it('should create API error with custom status code', () => {
      const error = new APIError('API failed', 503);
      expect(error.statusCode).toBe(503);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with correct properties', () => {
      const error = new ValidationError('Validation failed');
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with correct properties', () => {
      const error = new RateLimitError('Rate limit exceeded');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe('RateLimitError');
    });
  });

  describe('AuthError', () => {
    it('should create auth error with default properties', () => {
      const error = new AuthError('Authentication failed');
      expect(error.message).toBe('Authentication failed');
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.statusCode).toBe(401);
    });

    it('should create auth error with custom properties', () => {
      const error = new AuthError('Token expired', 'TOKEN_EXPIRED', 401);
      expect(error.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('ForbiddenError', () => {
    it('should create forbidden error with default properties', () => {
      const error = new ForbiddenError('Access denied');
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('FORBIDDEN_ERROR');
      expect(error.statusCode).toBe(403);
    });

    it('should create forbidden error with custom properties', () => {
      const error = new ForbiddenError('Invalid role', 'INVALID_ROLE', 403);
      expect(error.code).toBe('INVALID_ROLE');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with default properties', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error.statusCode).toBe(404);
    });

    it('should create not found error with custom properties', () => {
      const error = new NotFoundError('User not found', 'USER_NOT_FOUND', 404);
      expect(error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('ConfigError', () => {
    it('should create config error with default properties', () => {
      const error = new ConfigError('Configuration error');
      expect(error.message).toBe('Configuration error');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should create config error with custom properties', () => {
      const error = new ConfigError('Invalid config', 'INVALID_CONFIG', 500);
      expect(error.code).toBe('INVALID_CONFIG');
    });
  });
}); 