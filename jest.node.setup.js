const dotenv = require('dotenv')
const path = require('path')

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })

// Set default timeout for all tests
jest.setTimeout(30000)

// Mock console methods
const mockConsole = {
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}

global.mockConsoleTransport = {
  log: jest.fn()
}

// Store original console
const originalConsole = { ...console }

beforeAll(() => {
  // Replace console with mocks
  global.console = {
    ...originalConsole,
    ...mockConsole
  }
})

afterAll(() => {
  // Restore original console
  global.console = originalConsole
})

afterEach(() => {
  // Clear all mocks after each test
  Object.values(mockConsole).forEach(mock => mock.mockClear())
  global.mockConsoleTransport.log.mockClear()
})

// Mock environment variables
process.env = {
  ...process.env,
  NODE_ENV: 'test',
  LOG_LEVEL: 'debug',
  LOG_FILE_PATH: 'logs/test.log',
  ERROR_LOG_PATH: 'logs/error.log'
}

// Mock winston
jest.mock('winston', () => {
  const format = {
    combine: jest.fn().mockReturnThis(),
    timestamp: jest.fn().mockReturnThis(),
    colorize: jest.fn().mockReturnThis(),
    printf: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    errors: jest.fn().mockReturnThis(),
    simple: jest.fn().mockReturnThis(),
  }
  
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    http: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
    add: jest.fn(),
    log: jest.fn(),
    transports: [],
  }

  class Console {
    constructor(options) {
      this.options = options
      this.level = options.level || 'info'
      this.format = options.format || format.json()
    }
    log(info) {
      return info
    }
  }

  const transports = {
    Console,
    File: jest.fn().mockImplementation(() => ({
      log: jest.fn(),
      level: 'info',
      format: format.combine(),
    }))
  }

  return {
    format,
    addColors: jest.fn(),
    createLogger: jest.fn().mockReturnValue(mockLogger),
    transports,
    transport: {
      Console,
      File: transports.File
    }
  }
})

// Mock fs module
jest.mock('fs', () => {
  const mockWriteStream = {
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn().mockImplementation(function(event, handler) {
      if (event === 'open' || event === 'ready') {
        process.nextTick(handler)
      }
      return this
    }),
    once: jest.fn().mockImplementation(function(event, handler) {
      if (event === 'open' || event === 'ready') {
        process.nextTick(handler)
      }
      return this
    }),
    emit: jest.fn(),
    removeListener: jest.fn(),
    close: jest.fn(),
    cork: jest.fn(),
    uncork: jest.fn(),
    destroy: jest.fn()
  }

  const fs = jest.requireActual('fs')
  return {
    ...fs,
    existsSync: jest.fn().mockReturnValue(false),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    readdirSync: jest.fn(),
    unlinkSync: jest.fn(),
    rmdirSync: jest.fn(),
    statSync: jest.fn().mockReturnValue({
      isFile: () => true,
      size: 0
    }),
    stat: jest.fn((path, callback) => {
      if (callback) {
        callback(null, {
          isFile: () => true,
          size: 0
        })
      } else {
        return Promise.resolve({
          isFile: () => true,
          size: 0
        })
      }
    }),
    promises: {
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockResolvedValue(''),
      unlink: jest.fn().mockResolvedValue(undefined),
      rmdir: jest.fn().mockResolvedValue(undefined),
      stat: jest.fn().mockResolvedValue({
        isFile: () => true,
        size: 0
      })
    },
    createWriteStream: jest.fn().mockReturnValue(mockWriteStream)
  }
})

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: [], error: null })
        }))
      })),
      insert: jest.fn().mockResolvedValue({ data: [], error: null }),
      update: jest.fn().mockResolvedValue({ data: [], error: null }),
      delete: jest.fn().mockResolvedValue({ data: [], error: null })
    }))
  }))
})) 