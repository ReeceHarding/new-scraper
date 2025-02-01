import { CacheService } from '../../../src/services/cache/CacheService'
import { supabase } from '../../../src/lib/supabase'
import { logger } from '../../../src/services/logging'

// Mock dependencies
jest.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}))

jest.mock('../../../src/services/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}))

describe('CacheService', () => {
  let cacheService: CacheService
  const mockKey = 'test-key'
  const mockValue = { data: 'test-data' }
  const mockResponse = { data: mockValue, error: null }
  const mockError = new Error('Database error')

  beforeEach(() => {
    cacheService = CacheService.getInstance()
    jest.clearAllMocks()
  })

  describe('set', () => {
    it('should set a cache entry successfully', async () => {
      const mockSelect = jest.fn().mockResolvedValue(mockResponse)
      const mockUpsert = jest.fn().mockReturnValue({ select: () => ({ single: mockSelect })})
      ;(supabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert })

      const result = await cacheService.set(mockKey, mockValue)

      expect(result).toEqual(mockValue)
      expect(supabase.from).toHaveBeenCalledWith('query_cache')
      expect(mockUpsert).toHaveBeenCalledWith({
        cache_key: mockKey,
        value: mockValue
      })
      expect(logger.info).toHaveBeenCalledWith('Setting cache entry', { key: mockKey })
    })

    it('should handle set errors', async () => {
      const mockSelect = jest.fn().mockResolvedValue({ data: null, error: mockError })
      const mockUpsert = jest.fn().mockReturnValue({ select: () => ({ single: mockSelect })})
      ;(supabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert })

      await expect(cacheService.set(mockKey, mockValue)).rejects.toThrow('Database error')
      expect(logger.error).toHaveBeenCalledWith('Failed to set cache entry:', mockError)
    })
  })

  describe('get', () => {
    it('should get a cache entry successfully', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: { value: mockValue }, error: null })
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

      const result = await cacheService.get(mockKey)

      expect(result).toEqual(mockValue)
      expect(supabase.from).toHaveBeenCalledWith('query_cache')
      expect(mockSelect).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('cache_key', mockKey)
      expect(logger.debug).toHaveBeenCalledWith('Getting cache entry', { key: mockKey })
    })

    it('should return null for non-existent key', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null })
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

      const result = await cacheService.get(mockKey)

      expect(result).toBeNull()
      expect(logger.debug).toHaveBeenCalledWith('Cache miss', { key: mockKey })
    })

    it('should handle get errors', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError })
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

      await expect(cacheService.get(mockKey)).rejects.toThrow('Database error')
      expect(logger.error).toHaveBeenCalledWith('Failed to get cache entry:', mockError)
    })
  })

  describe('delete', () => {
    it('should delete a cache entry successfully', async () => {
      // Mock get operation
      const mockGetSingle = jest.fn().mockResolvedValue({ data: { value: mockValue }, error: null })
      const mockGetEq = jest.fn().mockReturnValue({ single: mockGetSingle })
      const mockGetSelect = jest.fn().mockReturnValue({ eq: mockGetEq })
      
      // Mock delete operation
      const mockDeleteEq = jest.fn().mockResolvedValue({ data: null, error: null })
      const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq })
      
      ;(supabase.from as jest.Mock).mockReturnValue({
        select: mockGetSelect,
        delete: mockDelete
      })

      const result = await cacheService.delete(mockKey)

      expect(result).toEqual(mockValue)
      expect(supabase.from).toHaveBeenCalledWith('query_cache')
      expect(mockDelete).toHaveBeenCalled()
      expect(mockDeleteEq).toHaveBeenCalledWith('cache_key', mockKey)
      expect(logger.info).toHaveBeenCalledWith('Deleting cache entry', { key: mockKey })
    })

    it('should handle delete errors', async () => {
      // Mock get operation
      const mockGetSingle = jest.fn().mockResolvedValue({ data: { value: mockValue }, error: null })
      const mockGetEq = jest.fn().mockReturnValue({ single: mockGetSingle })
      const mockGetSelect = jest.fn().mockReturnValue({ eq: mockGetEq })
      
      // Mock delete operation with error
      const mockDeleteEq = jest.fn().mockResolvedValue({ data: null, error: mockError })
      const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq })
      
      ;(supabase.from as jest.Mock).mockReturnValue({
        select: mockGetSelect,
        delete: mockDelete
      })

      await expect(cacheService.delete(mockKey)).rejects.toThrow('Database error')
      expect(logger.error).toHaveBeenCalledWith('Failed to delete cache entry:', mockError)
    })
  })

  describe('cleanup', () => {
    it('should cleanup old cache entries successfully', async () => {
      const mockLt = jest.fn().mockResolvedValue({ data: null, error: null })
      const mockDelete = jest.fn().mockReturnValue({ lt: mockLt })
      ;(supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete })

      await cacheService.cleanup(30)

      expect(supabase.from).toHaveBeenCalledWith('query_cache')
      expect(mockDelete).toHaveBeenCalled()
      expect(mockLt).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith('Cleaning up old cache entries', { olderThanDays: 30 })
    })

    it('should handle cleanup errors', async () => {
      const mockLt = jest.fn().mockResolvedValue({ data: null, error: mockError })
      const mockDelete = jest.fn().mockReturnValue({ lt: mockLt })
      ;(supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete })

      await expect(cacheService.cleanup(30)).rejects.toThrow('Database error')
      expect(logger.error).toHaveBeenCalledWith('Failed to cleanup cache:', mockError)
    })
  })
}) 