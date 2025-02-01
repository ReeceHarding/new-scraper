import { NextApiRequest, NextApiResponse } from 'next'
import { logger } from '@/services/logging'
import { QueryGenerator } from '@/services/search/QueryGenerator'
import { BraveSearch } from '@/services/search/BraveSearch'
import { QueryStorage } from '@/services/search/QueryStorage'
import { QueryCache } from '@/services/search/QueryCache'
import { ValidationError } from '@/lib/errors'

interface ProcessGoalRequest {
  goal: string
  location?: string
  maxResults?: number
  prioritizeLocal?: boolean
  excludeKeywords?: string[]
  includeKeywords?: string[]
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      goal,
      location,
      maxResults = 20,
      prioritizeLocal = true,
      excludeKeywords = [],
      includeKeywords = []
    } = req.body as ProcessGoalRequest

    // Validate request
    if (!goal || typeof goal !== 'string') {
      throw new ValidationError('Business goal is required and must be a string')
    }

    if (maxResults && (maxResults < 1 || maxResults > 50)) {
      throw new ValidationError('maxResults must be between 1 and 50')
    }

    // Initialize services
    const queryGenerator = new QueryGenerator()
    const braveSearch = new BraveSearch()
    const queryStorage = new QueryStorage()
    const queryCache = new QueryCache()

    // Generate search queries
    const queryResult = await queryGenerator.generateQueries(goal, {
      location,
      maxQueries: Math.ceil(maxResults / 2), // Generate fewer queries to account for results per query
      prioritizeLocal,
      excludeKeywords,
      includeKeywords
    })

    // Save the query for analytics
    const queryId = await queryStorage.saveQuery(goal, {
      targetIndustry: queryResult.targetIndustry,
      serviceOffering: queryResult.serviceOffering,
      location: queryResult.location,
      maxResults
    })

    // Execute searches for each generated query
    const searchPromises = queryResult.queries.map(async (query) => {
      // Check cache first
      const cachedResults = await queryCache.get(query, {
        targetIndustry: queryResult.targetIndustry,
        serviceOffering: queryResult.serviceOffering,
        location: queryResult.location,
        maxResults: Math.ceil(maxResults / queryResult.queries.length)
      })

      if (cachedResults) {
        logger.debug('Using cached results for query', { query })
        return cachedResults
      }

      // Execute search if not in cache
      const results = await braveSearch.search(query, {
        maxResults: Math.ceil(maxResults / queryResult.queries.length)
      })

      // Cache the results
      await queryCache.set(query, {
        targetIndustry: queryResult.targetIndustry,
        serviceOffering: queryResult.serviceOffering,
        location: queryResult.location,
        maxResults: Math.ceil(maxResults / queryResult.queries.length)
      }, results)

      return results
    })

    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises)

    // Flatten and deduplicate results
    const uniqueResults = Array.from(
      new Map(
        searchResults
          .flat()
          .map(result => [result.url, result])
      ).values()
    ).slice(0, maxResults)

    // Save results
    await queryStorage.saveResults(queryId, uniqueResults)

    // Return response
    res.status(200).json({
      queryId,
      targetIndustry: queryResult.targetIndustry,
      serviceOffering: queryResult.serviceOffering,
      location: queryResult.location,
      metadata: queryResult.metadata,
      results: uniqueResults
    })
  } catch (error: unknown) {
    logger.error('Error processing business goal:', error)

    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message })
    }

    res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
    })
  }
} 