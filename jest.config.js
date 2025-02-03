const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Global timeout of 30 seconds for all tests
  testTimeout: 30000,
  // Force exit after tests complete
  forceExit: true,
  // Run tests in sequence instead of parallel
  maxWorkers: 1,
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],
  // Detect open handles
  detectOpenHandles: true,
  // More verbose output
  verbose: true,
  // Fail fast to identify issues quickly
  bail: false,
  // Show test results as they happen
  reporters: [
    "default",
    ["jest-summary-reporter", { "failuresOnly": true }]
  ],
  // Run all tests regardless of location
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)"
  ],
  // Don't stop on errors
  passWithNoTests: false
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig) 