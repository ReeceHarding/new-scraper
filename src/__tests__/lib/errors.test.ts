import {
  AppError,
  SearchError,
  AnalysisError,
  BrowserError,
  APIError,
  DatabaseError,
  EmailError,
  ValidationError,
  RateLimitError,
  ConfigError
} from '@/lib/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create a base error with correct properties', () => {
      const error = new AppError('Base error message');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('AppError');
      expect(error.message).toBe('Base error message');
    });
  });

  describe('SearchError', () => {
    it('should create a search error with details', () => {
      const details = { query: 'test query', service: 'brave' };
      const error = new SearchError('Search failed', details);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('SearchError');
      expect(error.message).toBe('Search failed');
      expect(error.details).toEqual(details);
    });
  });

  describe('AnalysisError', () => {
    it('should create an analysis error with URL', () => {
      const url = 'https://example.com';
      const error = new AnalysisError('Analysis failed', url);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('AnalysisError');
      expect(error.message).toBe('Analysis failed');
      expect(error.url).toBe(url);
    });
  });

  describe('BrowserError', () => {
    it('should create a browser error with URL and action', () => {
      const url = 'https://example.com';
      const action = 'click';
      const error = new BrowserError('Browser action failed', url, action);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('BrowserError');
      expect(error.message).toBe('Browser action failed');
      expect(error.url).toBe(url);
      expect(error.action).toBe(action);
    });
  });

  describe('APIError', () => {
    it('should create an API error with status code and endpoint', () => {
      const statusCode = 404;
      const endpoint = '/api/search';
      const error = new APIError('API request failed', statusCode, endpoint);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('APIError');
      expect(error.message).toBe('API request failed');
      expect(error.statusCode).toBe(statusCode);
      expect(error.endpoint).toBe(endpoint);
    });
  });

  describe('DatabaseError', () => {
    it('should create a database error with operation and table', () => {
      const operation = 'INSERT';
      const table = 'prospects';
      const error = new DatabaseError('Database operation failed', operation, table);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('DatabaseError');
      expect(error.message).toBe('Database operation failed');
      expect(error.operation).toBe(operation);
      expect(error.table).toBe(table);
    });
  });

  describe('EmailError', () => {
    it('should create an email error with email address', () => {
      const emailAddress = 'test@example.com';
      const error = new EmailError('Email operation failed', emailAddress);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('EmailError');
      expect(error.message).toBe('Email operation failed');
      expect(error.emailAddress).toBe(emailAddress);
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with field and value', () => {
      const field = 'email';
      const value = 'invalid-email';
      const error = new ValidationError('Validation failed', field, value);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.field).toBe(field);
      expect(error.value).toBe(value);
    });
  });

  describe('RateLimitError', () => {
    it('should create a rate limit error with service and limit', () => {
      const service = 'brave-search';
      const limit = 100;
      const error = new RateLimitError('Rate limit exceeded', service, limit);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('RateLimitError');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.service).toBe(service);
      expect(error.limit).toBe(limit);
    });
  });

  describe('ConfigError', () => {
    it('should create a config error with config key', () => {
      const configKey = 'API_KEY';
      const error = new ConfigError('Configuration error', configKey);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('ConfigError');
      expect(error.message).toBe('Configuration error');
      expect(error.configKey).toBe(configKey);
    });
  });

  describe('Error inheritance', () => {
    it('should maintain proper instanceof checks through the chain', () => {
      const error = new SearchError('Test error');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof SearchError).toBe(true);
    });
  });
}); 