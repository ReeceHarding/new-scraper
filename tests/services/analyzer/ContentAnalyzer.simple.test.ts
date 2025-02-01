import { ContentAnalyzer } from '../../../src/services/analyzer/ContentAnalyzer'
import { OpenAIService } from '../../../src/services/openai/OpenAIService'

jest.mock('../../../src/services/openai/OpenAIService', () => ({
  OpenAIService: {
    getInstance: jest.fn().mockReturnValue({
      createChatCompletion: jest.fn()
    })
  }
}))

describe('ContentAnalyzer Simple Tests', () => {
  it('should be instantiable', () => {
    const analyzer = new ContentAnalyzer()
    expect(analyzer).toBeInstanceOf(ContentAnalyzer)
  })
}) 