import { z } from 'zod'

// Redis configuration schema
const redisConfigSchema = z.object({
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.string().pipe(
    z.string()
      .transform((val) => parseInt(val))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 65535, {
        message: 'Invalid port number'
      })
  )
})

// Browser configuration schema
const browserConfigSchema = z.object({
  poolSize: z.number().min(1).max(10).default(5),
  pageTimeout: z.number().min(1000).max(60000).default(30000),
  requestTimeout: z.number().min(1000).max(30000).default(10000)
})

// Full environment schema
export const envSchema = z.object({
  // Redis configuration
  ...redisConfigSchema.shape,
  
  // Browser configuration
  BROWSER_POOL_SIZE: z.string().pipe(
    z.string()
      .transform((val) => parseInt(val))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 10, {
        message: 'Invalid pool size'
      })
  ),
  BROWSER_PAGE_TIMEOUT: z.string().transform((val) => parseInt(val)),
  BROWSER_REQUEST_TIMEOUT: z.string().transform((val) => parseInt(val)),
  
  // Other required environment variables
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_DB_PASSWORD: z.string().min(1),
  BRAVE_API_KEY: z.string().min(1),
  BRAVE_SEARCH_RATE_LIMIT: z.string(),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL_VERSION: z.string().min(1),
  OPENAI_MAX_TOKENS: z.string(),
  PINECONE_API_KEY: z.string().min(1),
  PINECONE_ENV: z.string().min(1),
  PINECONE_INDEX: z.string().min(1),
  PINECONE_HOST: z.string().min(1),
  NEXT_PUBLIC_GMAIL_CLIENT_ID: z.string().min(1),
  GMAIL_CLIENT_SECRET: z.string().min(1),
  NEXT_PUBLIC_GMAIL_REDIRECT_URI: z.string().min(1),
  LOG_FILE_PATH: z.string().min(1),
  ERROR_LOG_PATH: z.string().min(1)
})

export type BrowserConfig = z.infer<typeof browserConfigSchema>

// Get browser configuration with validation
export function getBrowserConfig(): BrowserConfig {
  const config = {
    poolSize: process.env.BROWSER_POOL_SIZE ? parseInt(process.env.BROWSER_POOL_SIZE) : 5,
    pageTimeout: process.env.BROWSER_PAGE_TIMEOUT ? parseInt(process.env.BROWSER_PAGE_TIMEOUT) : 30000,
    requestTimeout: process.env.BROWSER_REQUEST_TIMEOUT ? parseInt(process.env.BROWSER_REQUEST_TIMEOUT) : 10000
  }

  return browserConfigSchema.parse(config)
} 