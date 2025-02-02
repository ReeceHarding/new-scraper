// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import 'isomorphic-fetch'

// Add setImmediate polyfill for winston
global.setImmediate = (callback) => setTimeout(callback, 0)

// Add any other global test setup here 