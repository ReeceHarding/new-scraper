/**
 * Environment configuration with validation
 */

import { ConfigError } from '@/lib/errors'

// Required environment variables
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'OPENAI_MODEL_VERSION',
  'OPENAI_MAX_TOKENS',
  'BRAVE_API_KEY',
  'BRAVE_SEARCH_RATE_LIMIT',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'BROWSER_POOL_SIZE',
  'BROWSER_PAGE_TIMEOUT',
  'BROWSER_REQUEST_TIMEOUT'
] as const

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new ConfigError(`Missing required environment variable: ${envVar}`)
  }
}

// OpenAI Configuration
export const OPENAI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY!,
  modelVersion: process.env.OPENAI_MODEL_VERSION!,
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS!, 10)
} as const

// Brave Search Configuration
export const BRAVE_SEARCH_CONFIG = {
  apiKey: process.env.BRAVE_API_KEY!,
  rateLimit: parseInt(process.env.BRAVE_SEARCH_RATE_LIMIT!, 10)
} as const

// Supabase Configuration
export const SUPABASE_CONFIG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
} as const

// Browser Service Configuration
export const BROWSER_CONFIG = {
  poolSize: parseInt(process.env.BROWSER_POOL_SIZE!, 10),
  pageTimeout: parseInt(process.env.BROWSER_PAGE_TIMEOUT!, 10),
  requestTimeout: parseInt(process.env.BROWSER_REQUEST_TIMEOUT!, 10)
} as const

// Environment type
export const NODE_ENV = process.env.NODE_ENV || 'development'

// Validate numeric values
if (isNaN(OPENAI_CONFIG.maxTokens)) {
  throw new ConfigError('OPENAI_MAX_TOKENS must be a number')
}

if (isNaN(BRAVE_SEARCH_CONFIG.rateLimit)) {
  throw new ConfigError('BRAVE_SEARCH_RATE_LIMIT must be a number')
}

if (isNaN(BROWSER_CONFIG.poolSize)) {
  throw new ConfigError('BROWSER_POOL_SIZE must be a number')
}

if (isNaN(BROWSER_CONFIG.pageTimeout)) {
  throw new ConfigError('BROWSER_PAGE_TIMEOUT must be a number')
}

if (isNaN(BROWSER_CONFIG.requestTimeout)) {
  throw new ConfigError('BROWSER_REQUEST_TIMEOUT must be a number')
}

// Export all configurations
export const config = {
  openai: OPENAI_CONFIG,
  braveSearch: BRAVE_SEARCH_CONFIG,
  supabase: SUPABASE_CONFIG,
  browser: BROWSER_CONFIG,
  nodeEnv: NODE_ENV
} as const

export default config 