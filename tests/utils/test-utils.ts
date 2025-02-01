import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock Supabase client
export const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  neq: jest.fn().mockResolvedValue({ data: [], error: null })
};

// Create mock format functions
const mockPrintf = jest.fn((template) => ({
  transform: (info: any) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${message} ${metaStr}`;
  }
}));

const mockTimestamp = jest.fn(() => ({
  transform: (info: any) => ({ ...info, timestamp: new Date().toISOString() })
}));

const mockJson = jest.fn(() => ({
  transform: (info: any) => JSON.stringify(info)
}));

const mockCombine = jest.fn((...formats) => ({
  transform: (info: any) => {
    return formats.reduce((acc, format) => {
      if (format.transform) {
        return format.transform(acc);
      }
      return acc;
    }, info);
  }
}));

// Export mock format with transform functions
export const mockFormat = {
  combine: mockCombine,
  timestamp: mockTimestamp,
  printf: mockPrintf,
  json: mockJson,
  colorize: jest.fn(() => ({
    transform: (info: any) => info
  })),
  simple: jest.fn().mockReturnValue({})
};

// Export mock logger
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
  child: jest.fn().mockReturnThis(),
  clear: jest.fn(),
  remove: jest.fn(),
  add: jest.fn(),
  transports: [],
  format: mockFormat,
  level: 'info',
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
  },
  log: jest.fn()
};

// Export mock console transport
export const mockConsoleTransport = {
  log: jest.fn()
};

export const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

export const cleanupTestData = async () => {
  await mockSupabase.from('email_templates').delete().neq('id', 0);
  await mockSupabase.from('email_queue').delete().neq('id', 0);
  await mockSupabase.from('email_analytics').delete().neq('id', 0);
  await mockSupabase.from('vector_embeddings').delete().neq('id', 0);
};

export { fs, path };

export class MockWriteStream extends EventEmitter {
  write = jest.fn();
  end = jest.fn();
  removeAllListeners = jest.fn();
}

export const createMockFs = () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(() => new MockWriteStream()),
  stat: jest.fn((path, callback) => callback(null, { isFile: () => true }))
});

export const createContextLoggerMock = () => ({
  createContextLogger: jest.fn().mockReturnValue(mockLogger)
}); 