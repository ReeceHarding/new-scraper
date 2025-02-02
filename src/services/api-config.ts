import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios'
import rateLimit from 'axios-rate-limit'

interface ApiConfig {
  baseURL: string
  headers: Record<string, string>
  rateLimit: number
}

interface RequestConfigWithMetadata extends InternalAxiosRequestConfig {
  metadata?: {
    startTime: number
  }
}

interface ResponseWithConfig extends AxiosResponse {
  config: RequestConfigWithMetadata
}

class ApiConfigService {
  private static instance: ApiConfigService
  private configs: Map<string, ApiConfig>

  private constructor() {
    this.configs = new Map()
    this.initializeConfigs()
  }

  public static getInstance(): ApiConfigService {
    if (!ApiConfigService.instance) {
      ApiConfigService.instance = new ApiConfigService()
    }
    return ApiConfigService.instance
  }

  private initializeConfigs() {
    // Brave Search API
    this.configs.set('brave', {
      baseURL: 'https://api.search.brave.com/res/v1',
      headers: {
        'X-Subscription-Token': process.env.BRAVE_API_KEY || ''
      },
      rateLimit: parseInt(process.env.BRAVE_RATE_LIMIT || '60')
    })

    // OpenAI API
    this.configs.set('openai', {
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`
      },
      rateLimit: parseInt(process.env.OPENAI_RATE_LIMIT || '60')
    })

    // SendGrid API
    this.configs.set('sendgrid', {
      baseURL: 'https://api.sendgrid.com/v3',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY || ''}`
      },
      rateLimit: parseInt(process.env.SENDGRID_RATE_LIMIT || '100')
    })

    // Twilio API
    this.configs.set('twilio', {
      baseURL: `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}`,
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64')}`
      },
      rateLimit: parseInt(process.env.TWILIO_RATE_LIMIT || '100')
    })
  }

  public getApiClient(apiName: string) {
    const config = this.configs.get(apiName)
    if (!config) {
      throw new Error(`API configuration not found for ${apiName}`)
    }

    const client = rateLimit(
      axios.create({
        baseURL: config.baseURL,
        headers: config.headers
      }),
      { maxRequests: config.rateLimit, perMilliseconds: 60000 }
    )

    // Add response interceptor for monitoring
    client.interceptors.response.use(
      (response: ResponseWithConfig) => {
        this.monitorApiResponse(apiName, response)
        return response
      },
      (error: AxiosError) => {
        this.monitorApiError(apiName, error)
        return Promise.reject(error)
      }
    )

    return client
  }

  private monitorApiResponse(apiName: string, response: ResponseWithConfig) {
    if (process.env.API_MONITORING_ENABLED !== 'true') return

    const latency = response.config.metadata?.startTime
      ? Date.now() - response.config.metadata.startTime
      : 0

    if (latency > parseInt(process.env.API_LATENCY_THRESHOLD || '2000')) {
      console.warn(`High latency detected for ${apiName} API: ${latency}ms`)
    }
  }

  private monitorApiError(apiName: string, error: AxiosError) {
    if (process.env.API_MONITORING_ENABLED !== 'true') return

    console.error(`API Error for ${apiName}:`, {
      status: error.response?.status,
      message: error.message,
      endpoint: error.config?.url
    })
  }

  public validateApiKeys(): boolean {
    return Array.from(this.configs.values()).every(config => 
      Object.values(config.headers).every(value => value && value !== 'Bearer ' && value !== 'Basic ')
    )
  }

  public getApiStatus(apiName: string) {
    const client = this.getApiClient(apiName)
    const endpoints = {
      brave: '/status',
      openai: '/models',
      sendgrid: '/user/credits',
      twilio: '/Keys.json'
    }

    return client.get(endpoints[apiName as keyof typeof endpoints])
  }
}

export const apiConfig = ApiConfigService.getInstance()
export default apiConfig