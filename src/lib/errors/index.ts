/**
 * Custom error classes for the lead generation platform
 * Each class represents a specific type of error that can occur in different parts of the system
 */

// Base error class for all application errors
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Search-related errors
export class SearchError extends AppError {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'SearchError';
    Object.setPrototypeOf(this, SearchError.prototype);
  }
}

// Website analysis errors
export class AnalysisError extends AppError {
  constructor(message: string, public url?: string) {
    super(message);
    this.name = 'AnalysisError';
    Object.setPrototypeOf(this, AnalysisError.prototype);
  }
}

// Content processing errors
export class ProcessingError extends AppError {
  constructor(message: string, public source?: string) {
    super(message);
    this.name = 'ProcessingError';
    Object.setPrototypeOf(this, ProcessingError.prototype);
  }
}

// Browser automation errors
export class BrowserError extends AppError {
  constructor(message: string, public url?: string, public action?: string) {
    super(message);
    this.name = 'BrowserError';
    Object.setPrototypeOf(this, BrowserError.prototype);
  }
}

// API-related errors
export class APIError extends AppError {
  constructor(message: string, public statusCode?: number, public endpoint?: string) {
    super(message);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

// Database errors
export class DatabaseError extends AppError {
  constructor(message: string, public operation?: string, public table?: string) {
    super(message);
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

// Email-related errors
export class EmailError extends AppError {
  constructor(message: string, public emailAddress?: string) {
    super(message);
    this.name = 'EmailError';
    Object.setPrototypeOf(this, EmailError.prototype);
  }
}

// Validation errors
export class ValidationError extends AppError {
  constructor(message: string, public field?: string, public value?: any) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// Rate limiting errors
export class RateLimitError extends AppError {
  constructor(message: string, public service?: string, public limit?: number) {
    super(message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

// Configuration errors
export class ConfigError extends AppError {
  constructor(message: string, public configKey?: string) {
    super(message);
    this.name = 'ConfigError';
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

// Authentication errors
export class AuthError extends AppError {
  constructor(message: string, code: string = 'AUTH_ERROR', statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

// Authorization errors
export class ForbiddenError extends AppError {
  constructor(message: string, code: string = 'FORBIDDEN_ERROR', statusCode: number = 403) {
    super(message);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

// Not found errors
export class NotFoundError extends AppError {
  constructor(message: string, code: string = 'NOT_FOUND_ERROR', statusCode: number = 404) {
    super(message);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

// Error handler function for consistent error handling
export function handleError(error: Error): void {
  // Log the error using our logging system
  console.error(`[${error.name}] ${error.message}`)
  
  // Re-throw the error to be handled by the caller
  throw error
}

// Type guard to check if an error is one of our custom errors
export function isCustomError(error: unknown): error is Error {
  return error instanceof Error && (
    error instanceof SearchError ||
    error instanceof AnalysisError ||
    error instanceof BrowserError ||
    error instanceof ProcessingError ||
    error instanceof RateLimitError ||
    error instanceof ValidationError ||
    error instanceof DatabaseError
  )
} 