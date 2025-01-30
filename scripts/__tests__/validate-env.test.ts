import { validateEnvironment } from '../validate-env'
import { beforeEach, describe, expect, it } from '@jest/globals'

describe('Environment Validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should validate valid Supabase configuration', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-key'
    process.env.SUPABASE_DB_PASSWORD = 'password123'

    const isValid = await validateEnvironment()
    expect(isValid).toBe(true)
  })

  it('should fail on invalid Supabase URL', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-key'
    process.env.SUPABASE_DB_PASSWORD = 'password123'

    const isValid = await validateEnvironment()
    expect(isValid).toBe(false)
  })

  it('should validate valid Redis configuration', async () => {
    process.env.REDIS_HOST = 'localhost'
    process.env.REDIS_PORT = '6379'
    process.env.REDIS_TLS_ENABLED = 'false'

    const isValid = await validateEnvironment()
    expect(isValid).toBe(true)
  })

  it('should fail on invalid Redis port', async () => {
    process.env.REDIS_HOST = 'localhost'
    process.env.REDIS_PORT = '999999'
    process.env.REDIS_TLS_ENABLED = 'false'

    const isValid = await validateEnvironment()
    expect(isValid).toBe(false)
  })

  // Add more test cases for other configurations...
}) 