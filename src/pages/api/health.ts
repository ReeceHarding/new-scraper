import { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '@/lib/logging'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Basic health check response
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV
    }

    logger.info('Health check successful', healthStatus)
    return res.status(200).json(healthStatus)
  } catch (error) {
    logger.error('Health check failed', { error })
    return res.status(500).json({ error: 'Internal server error' })
  }
} 