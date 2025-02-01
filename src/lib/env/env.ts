import { z } from "zod";
import { ConfigError } from "@/lib/errors";

// Schema for environment variables
const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().startsWith('ey'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().startsWith('ey'),
  SUPABASE_DB_PASSWORD: z.string(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  // OpenAI
  OPENAI_API_KEY: z.string(),
  OPENAI_MODEL_VERSION: z.string().default('gpt-4'),
  OPENAI_MAX_TOKENS: z.coerce.number().min(1).default(4096),

  // Pinecone
  PINECONE_API_KEY: z.string(),
  PINECONE_ENVIRONMENT: z.string(),
  PINECONE_INDEX: z.string(),
  PINECONE_HOST: z.string().url(),

  // Gmail
  GMAIL_CLIENT_ID: z.string(),
  GMAIL_CLIENT_SECRET: z.string(),
  GMAIL_REDIRECT_URI: z.string().url(),

  // Browser Service
  BROWSER_POOL_SIZE: z.coerce.number().min(1).default(5),
  BROWSER_PAGE_TIMEOUT: z.coerce.number().min(1000).default(30000),
  BROWSER_REQUEST_TIMEOUT: z.coerce.number().min(1000).default(10000),

  // Logging
  LOG_FILE_PATH: z.string().default('./logs/app.log'),
  LOG_ERROR_PATH: z.string().default('./logs/error.log'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional()
});

// Type for validated environment
type EnvConfig = z.infer<typeof envSchema>;

// Validate environment variables
export function validateEnv(): EnvConfig {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ConfigError(`Environment validation failed: ${error.message}`);
    }
    throw error;
  }
}

// Get validated environment config
export function getEnvConfig(): EnvConfig {
  return validateEnv();
}

// Get Supabase configuration
export function getSupabaseConfig() {
  const config = validateEnv();
  return {
    url: config.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
    dbPassword: config.SUPABASE_DB_PASSWORD
  };
}

// Get Redis configuration
export function getRedisConfig() {
  const config = validateEnv();
  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT
  };
}

// Get OpenAI configuration
export function getOpenAIConfig() {
  const config = validateEnv();
  return {
    apiKey: config.OPENAI_API_KEY,
    modelVersion: config.OPENAI_MODEL_VERSION,
    maxTokens: config.OPENAI_MAX_TOKENS
  };
}

// Get Pinecone configuration
export function getPineconeConfig() {
  const config = validateEnv();
  return {
    apiKey: config.PINECONE_API_KEY,
    environment: config.PINECONE_ENVIRONMENT,
    index: config.PINECONE_INDEX,
    host: config.PINECONE_HOST
  };
}

// Get Gmail configuration
export function getGmailConfig() {
  const config = validateEnv();
  return {
    clientId: config.GMAIL_CLIENT_ID,
    clientSecret: config.GMAIL_CLIENT_SECRET,
    redirectUri: config.GMAIL_REDIRECT_URI
  };
}

// Get Browser configuration
export function getBrowserConfig() {
  const config = validateEnv();
  return {
    poolSize: config.BROWSER_POOL_SIZE,
    pageTimeout: config.BROWSER_PAGE_TIMEOUT,
    requestTimeout: config.BROWSER_REQUEST_TIMEOUT
  };
}

// Get Logging configuration
export function getLoggingConfig() {
  const config = validateEnv();
  return {
    filePath: config.LOG_FILE_PATH,
    errorPath: config.LOG_ERROR_PATH,
    level: config.LOG_LEVEL
  };
}
