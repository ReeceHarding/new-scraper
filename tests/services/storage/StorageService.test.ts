import { StorageService } from "../../../src/services/storage/StorageService";
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
    error: jest.fn()
  }
}))

describe("StorageService", () => {
  let storageService: StorageService
  const mockTable = 'content_analysis'
  const mockId = '123'
  const mockData = { title: 'Test', content: 'Content' }
  const mockResponse = { data: mockData, error: null }
  const mockError = new Error('Database error')

  beforeEach(() => {
    storageService = StorageService.getInstance()
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should create a record successfully', async () => {
      const mockSelect = jest.fn().mockResolvedValue(mockResponse)
      const mockInsert = jest.fn().mockReturnValue({ select: () => ({ single: mockSelect })})
      ;(supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert })

      const result = await storageService.create(mockTable, mockData)

      expect(result).toEqual(mockData)
      expect(supabase.from).toHaveBeenCalledWith(mockTable)
      expect(mockInsert).toHaveBeenCalledWith(mockData)
      expect(logger.info).toHaveBeenCalledWith(`Creating record in ${mockTable}`, { data: mockData })
    })

    it('should handle create errors', async () => {
      const mockSelect = jest.fn().mockResolvedValue({ data: null, error: mockError })
      const mockInsert = jest.fn().mockReturnValue({ select: () => ({ single: mockSelect })})
      ;(supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert })

      await expect(storageService.create(mockTable, mockData)).rejects.toThrow('Database error')
      expect(logger.error).toHaveBeenCalledWith(`Failed to create record in ${mockTable}:`, mockError)
    })
  })

  describe('read', () => {
    it('should read a record successfully', async () => {
      const mockSingle = jest.fn().mockResolvedValue(mockResponse)
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

      const result = await storageService.read(mockTable, mockId)

      expect(result).toEqual(mockData)
      expect(supabase.from).toHaveBeenCalledWith(mockTable)
      expect(mockSelect).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', mockId)
      expect(logger.info).toHaveBeenCalledWith(`Reading record from ${mockTable}`, { id: mockId })
    })

    it('should handle read errors', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError })
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

      await expect(storageService.read(mockTable, mockId)).rejects.toThrow('Database error')
      expect(logger.error).toHaveBeenCalledWith(`Failed to read record from ${mockTable}:`, mockError)
    })
  })

  describe('update', () => {
    it('should update a record successfully', async () => {
      const mockSingle = jest.fn().mockResolvedValue(mockResponse)
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle })
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect })
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate })

      const result = await storageService.update(mockTable, mockId, mockData)

      expect(result).toEqual(mockData)
      expect(supabase.from).toHaveBeenCalledWith(mockTable)
      expect(mockUpdate).toHaveBeenCalledWith(mockData)
      expect(mockEq).toHaveBeenCalledWith('id', mockId)
      expect(logger.info).toHaveBeenCalledWith(`Updating record in ${mockTable}`, { id: mockId, data: mockData })
    })

    it('should handle update errors', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError })
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle })
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect })
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate })

      await expect(storageService.update(mockTable, mockId, mockData)).rejects.toThrow('Database error')
      expect(logger.error).toHaveBeenCalledWith(`Failed to update record in ${mockTable}:`, mockError)
    })
  })

  describe('delete', () => {
    it('should delete a record successfully', async () => {
      const mockSingle = jest.fn().mockResolvedValue(mockResponse)
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle })
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect })
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete })

      const result = await storageService.delete(mockTable, mockId)

      expect(result).toEqual(mockData)
      expect(supabase.from).toHaveBeenCalledWith(mockTable)
      expect(mockDelete).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', mockId)
      expect(logger.info).toHaveBeenCalledWith(`Deleting record from ${mockTable}`, { id: mockId })
    })

    it('should handle delete errors', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError })
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle })
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect })
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete })

      await expect(storageService.delete(mockTable, mockId)).rejects.toThrow('Database error')
      expect(logger.error).toHaveBeenCalledWith(`Failed to delete record from ${mockTable}:`, mockError)
    })
  })

  describe('batchCreate', () => {
    it('should create multiple records successfully', async () => {
      const mockSelect = jest.fn().mockResolvedValue({ data: [mockData], error: null })
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect })
      ;(supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert })

      const result = await storageService.batchCreate(mockTable, [mockData])

      expect(result).toEqual([mockData])
      expect(supabase.from).toHaveBeenCalledWith(mockTable)
      expect(mockInsert).toHaveBeenCalledWith([mockData])
      expect(logger.info).toHaveBeenCalledWith(`Batch creating records in ${mockTable}`, { count: 1 })
    })

    it('should handle batch create errors', async () => {
      const mockSelect = jest.fn().mockResolvedValue({ data: null, error: mockError })
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect })
      ;(supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert })

      await expect(storageService.batchCreate(mockTable, [mockData])).rejects.toThrow('Database error')
      expect(logger.error).toHaveBeenCalledWith(`Failed to batch create records in ${mockTable}:`, mockError)
    })
  })

  describe('query', () => {
    it('should query records successfully', async () => {
      const mockEq = jest.fn().mockReturnValue({ data: [mockData], error: null })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

      const result = await storageService.query(mockTable, { title: 'Test' })

      expect(result).toEqual([mockData])
      expect(supabase.from).toHaveBeenCalledWith(mockTable)
      expect(mockSelect).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('title', 'Test')
      expect(logger.info).toHaveBeenCalledWith(`Querying records from ${mockTable}`, { filter: { title: 'Test' }, options: {} })
    })

    it('should handle query errors', async () => {
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: mockError })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

      await expect(storageService.query(mockTable, { title: 'Test' })).rejects.toThrow('Database error')
      expect(logger.error).toHaveBeenCalledWith(`Failed to query records from ${mockTable}:`, mockError)
    })
  })
})
