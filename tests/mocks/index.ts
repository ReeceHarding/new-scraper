import fs from 'fs'

export const mockFs = {
  existsSync: jest.fn(),
  promises: {
    mkdir: jest.fn()
  }
}

export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}

jest.mock('fs', () => mockFs)
jest.mock('@/lib/logging', () => ({
  logger: mockLogger
})) 