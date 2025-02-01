import { mockLogger, mockFormat, mockConsoleTransport } from '../../../tests/utils/test-utils'
import * as fs from 'fs'
import { PathLike } from 'fs'
import winston from 'winston'
import { ConfigError } from '@/lib/errors'
import { initializeApp } from '@/lib/core/init'
import { mockFs, resetMockFs } from '../../mocks/fs'

// Mock env config
const mockEnvConfig = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  SUPABASE_DB_PASSWORD: 'test-db-password',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  BRAVE_API_KEY: 'test-brave-key',
  BRAVE_SEARCH_RATE_LIMIT: '10',
  OPENAI_API_KEY: 'test-openai-key',
  OPENAI_MODEL_VERSION: 'gpt-4',
  OPENAI_MAX_TOKENS: '4096',
  PINECONE_API_KEY: 'test-pinecone-key',
  PINECONE_ENV: 'test',
  PINECONE_INDEX: 'test-index',
  PINECONE_HOST: 'https://test.pinecone.io',
  NEXT_PUBLIC_GMAIL_CLIENT_ID: 'test-gmail-client-id',
  GMAIL_CLIENT_SECRET: 'test-gmail-secret',
  NEXT_PUBLIC_GMAIL_REDIRECT_URI: 'http://localhost:3000/auth/callback',
  BROWSER_POOL_SIZE: '5',
  BROWSER_PAGE_TIMEOUT: '30000',
  BROWSER_REQUEST_TIMEOUT: '10000',
  LOG_LEVEL: 'debug',
  LOG_DIR: 'logs',
  LOG_FILE_PATH: 'logs/combined.log',
  ERROR_LOG_PATH: 'logs/error.log'
} as const;

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Record<keyof typeof mockEnvConfig, string> {}
  }
}

const mockLogDir = 'logs'

// Mock fs module
const mockExistsSync = jest.fn()
const mockMkdir = jest.fn()
const mockAccess = jest.fn()

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: mockExistsSync,
  promises: {
    mkdir: mockMkdir,
    access: mockAccess
  }
}))

jest.mock('@/lib/env', () => ({
  validateEnv: jest.fn(),
  getEnvConfig: jest.fn()
}))

jest.mock('@/lib/logging', () => ({
  logger: mockLogger,
  baseLogger: mockLogger,
  createLogger: () => mockLogger,
  initializeLogger: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('winston', () => ({
  format: mockFormat,
  transports: {
    Console: jest.fn().mockImplementation(() => mockConsoleTransport),
    File: jest.fn().mockImplementation(() => ({
      log: jest.fn()
    }))
  },
  createLogger: jest.fn().mockReturnValue({
    ...mockLogger,
    add: jest.fn(),
    remove: jest.fn(),
    info: jest.fn((msg, meta) => {
      mockLogger.info(msg, meta || {})
      mockConsoleTransport.log({ level: 'info', message: msg, ...meta })
      return undefined
    }),
    error: jest.fn((msg, meta) => {
      mockLogger.error(msg, meta || {})
      mockConsoleTransport.log({ level: 'error', message: msg, ...meta })
      return undefined
    }),
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn()
  }),
  addColors: jest.fn()
}))

import { validateEnv } from '@/lib/env'
import { baseLogger } from '@/lib/logging'

type RequiredEnvVars = NodeJS.ProcessEnv & {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  OPENAI_API_KEY: string
  LOG_LEVEL: string
  LOG_DIR: string
}

describe('Core Services Integration', () => {
  const mockLogDir = 'logs'
  const originalEnv = process.env

  beforeEach(() => {
    // Set up environment variables
    process.env = {
      ...originalEnv,
      LOG_DIR: mockLogDir,
      NEXT_PUBLIC_SUPABASE_URL: 'test-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
      OPENAI_API_KEY: 'test-key',
      LOG_LEVEL: 'info'
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Logging Integration', () => {
    test('should set up logging with correct configuration', async () => {
      await initializeApp()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Core services initialized successfully',
        expect.objectContaining({ context: 'app-init' })
      )
    })
  })
}) 