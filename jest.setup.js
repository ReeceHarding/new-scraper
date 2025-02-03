// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import 'isomorphic-fetch'

// Add setImmediate polyfill for winston
global.setImmediate = (callback) => setTimeout(callback, 0)

// Increase timeout for async operations
jest.setTimeout(30000)

// Ensure we get proper test output
beforeAll(async () => {
  // Suppress console output during tests
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  
  // Wait for any pending operations
  await new Promise(resolve => setTimeout(resolve, 500))
})

// Clean up after each test
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks()
  
  // Wait for any pending operations
  await new Promise(resolve => setTimeout(resolve, 500))
})

// Add global error handler for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

afterAll(async () => {
  // Restore console
  jest.restoreAllMocks()
  
  // Cleanup and wait for any remaining operations
  await new Promise(resolve => setTimeout(resolve, 1000))
})

// Add any other global test setup here 