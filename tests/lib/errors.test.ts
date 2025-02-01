import {
  SearchError,
  AnalysisError,
  BrowserError,
  RateLimitError,
  ValidationError,
  DatabaseError,
  handleError,
  isCustomError
} from '../../src/lib/errors'

describe('Error Handling Module', () => {
  describe('Custom Error Classes', () => {
    it('should create SearchError with correct name and message', () => {
      const error = new SearchError('Search failed')
      expect(error.name).toBe('SearchError')
      expect(error.message).toBe('Search failed')
      expect(error instanceof Error).toBe(true)
    })

    it('should create AnalysisError with correct name and message', () => {
      const error = new AnalysisError('Analysis failed')
      expect(error.name).toBe('AnalysisError')
      expect(error.message).toBe('Analysis failed')
      expect(error instanceof Error).toBe(true)
    })

    it('should create BrowserError with correct name and message', () => {
      const error = new BrowserError('Browser failed')
      expect(error.name).toBe('BrowserError')
      expect(error.message).toBe('Browser failed')
      expect(error instanceof Error).toBe(true)
    })

    it('should create RateLimitError with correct name and message', () => {
      const error = new RateLimitError('Rate limit exceeded')
      expect(error.name).toBe('RateLimitError')
      expect(error.message).toBe('Rate limit exceeded')
      expect(error instanceof Error).toBe(true)
    })

    it('should create ValidationError with correct name and message', () => {
      const error = new ValidationError('Invalid input')
      expect(error.name).toBe('ValidationError')
      expect(error.message).toBe('Invalid input')
      expect(error instanceof Error).toBe(true)
    })

    it('should create DatabaseError with correct name and message', () => {
      const error = new DatabaseError('Database connection failed')
      expect(error.name).toBe('DatabaseError')
      expect(error.message).toBe('Database connection failed')
      expect(error instanceof Error).toBe(true)
    })
  })

  describe('handleError function', () => {
    const originalConsoleError = console.error
    let consoleOutput: string[] = []

    beforeEach(() => {
      consoleOutput = []
      console.error = (message: string) => {
        consoleOutput.push(message)
      }
    })

    afterEach(() => {
      console.error = originalConsoleError
    })

    it('should log and re-throw the error', () => {
      const error = new SearchError('Test error')
      
      expect(() => handleError(error)).toThrow(error)
      expect(consoleOutput).toHaveLength(1)
      expect(consoleOutput[0]).toBe('[SearchError] Test error')
    })
  })

  describe('isCustomError function', () => {
    it('should return true for custom errors', () => {
      expect(isCustomError(new SearchError('test'))).toBe(true)
      expect(isCustomError(new AnalysisError('test'))).toBe(true)
      expect(isCustomError(new BrowserError('test'))).toBe(true)
      expect(isCustomError(new RateLimitError('test'))).toBe(true)
      expect(isCustomError(new ValidationError('test'))).toBe(true)
      expect(isCustomError(new DatabaseError('test'))).toBe(true)
    })

    it('should return false for non-custom errors', () => {
      expect(isCustomError(new Error('test'))).toBe(false)
      expect(isCustomError('string')).toBe(false)
      expect(isCustomError(null)).toBe(false)
      expect(isCustomError(undefined)).toBe(false)
      expect(isCustomError(42)).toBe(false)
      expect(isCustomError({})).toBe(false)
    })
  })
}) 