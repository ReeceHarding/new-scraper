import { EventEmitter } from 'events'
import { mockLogger, mockFormat, mockConsoleTransport, MockWriteStream } from '../utils/test-utils'
import * as fs from 'fs'
import { ConfigError } from '@/lib/errors'
import winston from 'winston'
import { mockFs, resetMockFs } from '../mocks/fs'
import { PathLike } from 'fs'

type RequiredEnvVars = NodeJS.ProcessEnv & {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  OPENAI_API_KEY: string
  LOG_LEVEL: string
  LOG_DIR: string
}

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue({ data: [], error: null }),
  update: jest.fn().mockResolvedValue({ data: [], error: null }),
  delete: jest.fn().mockResolvedValue({ data: [], error: null })
};

// Mocks must be before imports
jest.mock('fs', () => mockFs);

jest.mock('@/lib/env', () => ({
  validateEnv: jest.fn(),
  getEnvConfig: jest.fn()
}));

jest.mock('@/lib/supabase/client', () => ({
  supabase: mockSupabase,
  __esModule: true
}));

// Mock winston before any imports
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
}));

jest.mock('@/lib/logging', () => ({
  logger: mockLogger,
  baseLogger: mockLogger,
  createLogger: () => mockLogger,
  initializeLogger: jest.fn().mockResolvedValue(undefined),
  logError: jest.fn((msg, meta) => mockLogger.error(msg, meta)),
  logInfo: jest.fn((msg, meta) => mockLogger.info(msg, meta)),
  logWarn: jest.fn((msg, meta) => mockLogger.warn(msg, meta)),
  logDebug: jest.fn((msg, meta) => mockLogger.debug(msg, meta)),
  logErrorWithContext: jest.fn((error, context) => mockLogger.error(error instanceof Error ? error.message : String(error), context)),
  __esModule: true
}));

// Imports
import { initializeApp, shutdownApp } from '../../src/lib/core/init'
import { validateEnv, getEnvConfig } from '@/lib/env'
import { logger } from '@/lib/logging'
import path from 'path'

jest.mock('@/lib/errors', () => ({
  ConfigError: class ConfigError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ConfigError'
    }
  }
}))

describe('Core Integration Tests', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      LOG_DIR: 'logs',
      NEXT_PUBLIC_SUPABASE_URL: 'test-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
      OPENAI_API_KEY: 'test-key',
      LOG_LEVEL: 'info'
    }
  })

  afterEach(() => {
    process.env = originalEnv
    jest.resetAllMocks()
  })

  it('should initialize core services successfully', async () => {
    await expect(initializeApp()).resolves.not.toThrow()
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Core services initialized successfully',
      expect.objectContaining({ context: 'app-init' })
    )
  })
}) 