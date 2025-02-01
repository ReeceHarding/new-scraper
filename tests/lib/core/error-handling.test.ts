import { ConfigError, AnalysisError } from '../../../src/lib/errors'

describe('Error Handling', () => {
  it('should create ConfigError with message', () => {
    const error = new ConfigError('test error')
    expect(error.message).toBe('test error')
    expect(error).toBeInstanceOf(ConfigError)
  })

  it('should create AnalysisError with message', () => {
    const error = new AnalysisError('test error')
    expect(error.message).toBe('test error')
    expect(error).toBeInstanceOf(AnalysisError)
  })
}) 