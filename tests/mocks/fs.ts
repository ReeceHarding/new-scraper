import { PathLike } from 'fs'
import path from 'path'

// Create a mock filesystem object
const mockFs = {
  existsSync: jest.fn(),
  promises: {
    mkdir: jest.fn(),
    access: jest.fn()
  }
}

// Reset mock filesystem to initial state
const resetMockFs = () => {
  mockFs.existsSync.mockReset()
  mockFs.promises.mkdir.mockReset()
  mockFs.promises.access.mockReset()
  
  // Default implementations
  mockFs.existsSync.mockImplementation(() => false)
  mockFs.promises.mkdir.mockImplementation(() => Promise.resolve())
  mockFs.promises.access.mockImplementation(() => Promise.resolve())
}

// Helper to resolve paths
const resolvePath = (p: PathLike) => path.resolve(p.toString())

// Initialize with default implementations
resetMockFs()

// Export mock objects and utilities
export { mockFs, resetMockFs, resolvePath }

// Mock fs module
const mockFsModule = {
  ...mockFs,
  default: mockFs,
  __esModule: true,
  constants: {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1
  }
}

export default mockFsModule 