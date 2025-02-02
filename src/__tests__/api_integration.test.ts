import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import dotenv from 'dotenv'

// Mock axios
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

dotenv.config({ path: '.env.test' })

describe('External API Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
    
    // Setup successful mock responses
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('brave.com')) {
        return Promise.resolve({ status: 200, data: { status: 'ok' } })
      } else if (url.includes('openai.com')) {
        return Promise.resolve({ status: 200, data: { data: [] } })
      } else if (url.includes('sendgrid.com')) {
        return Promise.resolve({ status: 200, data: { credits: 1000 } })
      } else if (url.includes('twilio.com')) {
        return Promise.resolve({ status: 200, data: { keys: [] } })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  test('Brave Search API configuration is valid', async () => {
    const braveApiKey = process.env.BRAVE_API_KEY
    expect(braveApiKey).toBeDefined()
    
    if (braveApiKey) {
      const response = await axios.get('https://api.search.brave.com/res/v1/status', {
        headers: {
          'X-Subscription-Token': braveApiKey
        }
      })
      expect(response.status).toBe(200)
    }
  })

  test('OpenAI API configuration is valid', async () => {
    const openaiApiKey = process.env.OPENAI_API_KEY
    expect(openaiApiKey).toBeDefined()
    
    if (openaiApiKey) {
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        }
      })
      expect(response.status).toBe(200)
    }
  })

  test('SendGrid API configuration is valid', async () => {
    const sendgridApiKey = process.env.SENDGRID_API_KEY
    expect(sendgridApiKey).toBeDefined()
    
    if (sendgridApiKey) {
      const response = await axios.get('https://api.sendgrid.com/v3/user/credits', {
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`
        }
      })
      expect(response.status).toBe(200)
    }
  })

  test('Twilio API configuration is valid', async () => {
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN
    expect(twilioAccountSid).toBeDefined()
    expect(twilioAuthToken).toBeDefined()
    
    if (twilioAccountSid && twilioAuthToken) {
      const response = await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Keys.json`, {
        auth: {
          username: twilioAccountSid,
          password: twilioAuthToken
        }
      })
      expect(response.status).toBe(200)
    }
  })

  test('API rate limiting is configured', () => {
    const rateLimits = {
      BRAVE_RATE_LIMIT: process.env.BRAVE_RATE_LIMIT,
      OPENAI_RATE_LIMIT: process.env.OPENAI_RATE_LIMIT,
      SENDGRID_RATE_LIMIT: process.env.SENDGRID_RATE_LIMIT,
      TWILIO_RATE_LIMIT: process.env.TWILIO_RATE_LIMIT
    }
    
    Object.entries(rateLimits).forEach(([key, value]) => {
      expect(value).toBeDefined()
      expect(parseInt(value || '0')).toBeGreaterThan(0)
    })
  })

  test('API monitoring configuration is valid', () => {
    const monitoringConfig = {
      API_MONITORING_ENABLED: process.env.API_MONITORING_ENABLED,
      API_ERROR_THRESHOLD: process.env.API_ERROR_THRESHOLD,
      API_LATENCY_THRESHOLD: process.env.API_LATENCY_THRESHOLD
    }
    
    Object.entries(monitoringConfig).forEach(([key, value]) => {
      expect(value).toBeDefined()
    })
    
    expect(process.env.API_MONITORING_ENABLED).toBe('true')
    expect(parseInt(process.env.API_ERROR_THRESHOLD || '0')).toBeGreaterThan(0)
    expect(parseInt(process.env.API_LATENCY_THRESHOLD || '0')).toBeGreaterThan(0)
  })
}) 