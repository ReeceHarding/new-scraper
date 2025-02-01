const dotenv = require('dotenv')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { initializeLogger } = require('./src/lib/logging')

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })

// Set default timeout for all tests
jest.setTimeout(30000)

// Mock console methods to keep test output clean
const mockConsole = {
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
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
})

// Create Supabase client for tests
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required Supabase environment variables')
}

global.supabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// Clean up function to run after each test
afterEach(() => {
  jest.clearAllMocks()
})

// Global test setup
beforeAll(async () => {
  // Initialize logger
  await initializeLogger()
  
  // Verify database connection
  try {
    const { data, error } = await global.supabaseClient.from('organizations').select('count')
    if (error) throw error
    console.log('Database connection verified')
  } catch (error) {
    console.error('Failed to connect to database:', error)
    throw error
  }
})

// Global test teardown
afterAll(async () => {
  // Close any open connections
  await global.supabaseClient.auth.signOut()
})

// Add Jest extended matchers
import '@testing-library/jest-dom';

// Mock the window.matchMedia function
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock ResizeObserver
const mockResizeObserver = jest.fn();
mockResizeObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.ResizeObserver = mockResizeObserver;

// Mock window.fetch
global.fetch = jest.fn();

// Mock console methods to fail tests on console.error and console.warn
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    originalError(...args);
    throw new Error('Console error was called. See above for details.');
  };

  console.warn = (...args) => {
    originalWarn(...args);
    throw new Error('Console warn was called. See above for details.');
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset fetch mock
  global.fetch.mockClear();
  
  // Clean up any pending timers
  jest.useRealTimers();
});

// Add custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '',
      query: {},
      asPath: '',
      push: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    }
  },
}))

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />
  },
}))

// Mock environment variables for tests
process.env = {
  ...process.env,
  NODE_ENV: 'test',
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
  SUPABASE_DB_PASSWORD: 'test-password',

  // Redis
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',

  // Brave Search
  BRAVE_API_KEY: 'test-brave-key',
  BRAVE_SEARCH_RATE_LIMIT: '100',

  // OpenAI
  OPENAI_API_KEY: 'test-openai-key',
  OPENAI_MODEL_VERSION: 'gpt-4',
  OPENAI_MAX_TOKENS: '2000',

  // Pinecone
  PINECONE_API_KEY: 'test-pinecone-key',
  PINECONE_ENV: 'test',
  PINECONE_INDEX: 'test-index',
  PINECONE_HOST: 'https://test-index.pinecone.io',

  // Gmail
  NEXT_PUBLIC_GMAIL_CLIENT_ID: 'test-client-id',
  GMAIL_CLIENT_SECRET: 'test-secret',
  NEXT_PUBLIC_GMAIL_REDIRECT_URI: 'http://localhost:3000/auth/callback',

  // Browser Service
  BROWSER_POOL_SIZE: '5',
  BROWSER_PAGE_TIMEOUT: '30000',
  BROWSER_REQUEST_TIMEOUT: '10000',

  // Logging
  LOG_LEVEL: 'debug',
  LOG_FILE_PATH: 'logs/test.log',
  ERROR_LOG_PATH: 'logs/test-error.log'
}

// Mock setImmediate for Node.js compatibility
if (!global.setImmediate) {
  global.setImmediate = (callback) => setTimeout(callback, 0)
}

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn()
}))

// Mock Supabase client
jest.mock('src/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockResolvedValue({ data: [], error: null }),
      update: jest.fn().mockResolvedValue({ data: [], error: null }),
      delete: jest.fn().mockResolvedValue({ data: [], error: null })
    }))
  }
})) 