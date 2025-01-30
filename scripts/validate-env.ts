import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'
import { logger } from '../src/utils/logger'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Define validation schemas for each section
const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(32).optional(),
  SUPABASE_DB_PASSWORD: z.string().min(8)
})

const redisSchema = z.object({
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().int().min(1).max(65535)),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS_ENABLED: z.enum(['true', 'false']).optional().default('false'),
  REDIS_DATABASE: z.string().transform(Number).pipe(z.number().int().min(0)).optional()
})

const openaiSchema = z.object({
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  OPENAI_ORG_ID: z.string().optional(),
  OPENAI_MODEL_VERSION: z.string().min(1),
  OPENAI_MAX_TOKENS: z.string().transform(Number).pipe(z.number().int().min(1)),
  OPENAI_TEMPERATURE: z.string().transform(Number).pipe(z.number().min(0).max(1))
})

const pineconeSchema = z.object({
  PINECONE_API_KEY: z.string().min(1),
  PINECONE_ENVIRONMENT: z.string().min(1),
  PINECONE_INDEX_NAME: z.string().min(1),
  PINECONE_NAMESPACE: z.string().optional(),
  PINECONE_DIMENSION: z.string().transform(Number).pipe(z.number().int().positive())
})

const gmailSchema = z.object({
  NEXT_PUBLIC_GMAIL_CLIENT_ID: z.string().min(1),
  GMAIL_CLIENT_SECRET: z.string().min(1),
  NEXT_PUBLIC_GMAIL_REDIRECT_URI: z.string().url(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),
  GMAIL_ACCESS_TOKEN: z.string().optional()
})

const appSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  APP_ENV: z.enum(['local', 'staging', 'production']),
  DEBUG_MODE: z.enum(['true', 'false']).default('false'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
  API_VERSION: z.string().min(1)
})

const securitySchema = z.object({
  JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  API_KEY_SALT: z.string().min(16)
})

const endpointSchema = z.object({
  API_BASE_URL: z.string().url(),
  WEBSOCKET_URL: z.string().url(),
  CDN_URL: z.string().url(),
  METRICS_URL: z.string().url()
})

const monitoringSchema = z.object({
  SENTRY_DSN: z.string().url().optional(),
  DATADOG_API_KEY: z.string().optional(),
  NEW_RELIC_LICENSE_KEY: z.string().optional()
})

const testingSchema = z.object({
  TEST_DATABASE_URL: z.string().url().optional(),
  TEST_REDIS_URL: z.string().url().optional(),
  TEST_API_KEY: z.string().optional()
})

// Validate all sections
async function validateEnvironment() {
  try {
    logger.info('Starting environment validation...')

    const validations = [
      { name: 'Supabase', schema: supabaseSchema },
      { name: 'Redis', schema: redisSchema },
      { name: 'OpenAI', schema: openaiSchema },
      { name: 'Pinecone', schema: pineconeSchema },
      { name: 'Gmail', schema: gmailSchema },
      { name: 'Application', schema: appSchema },
      { name: 'Security', schema: securitySchema },
      { name: 'Endpoints', schema: endpointSchema },
      { name: 'Monitoring', schema: monitoringSchema },
      { name: 'Testing', schema: testingSchema }
    ]

    for (const { name, schema } of validations) {
      try {
        schema.parse(process.env)
        logger.info(`✅ ${name} configuration is valid`)
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.error(`❌ ${name} configuration validation failed:`, {
            errors: error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message
            }))
          })
          throw error
        }
      }
    }

    logger.info('Environment validation completed successfully')
    return true
  } catch (error) {
    logger.error('Environment validation failed', { error })
    return false
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  validateEnvironment()
    .then(isValid => {
      if (!isValid) {
        process.exit(1)
      }
    })
    .catch(() => {
      process.exit(1)
    })
}

export { validateEnvironment } 