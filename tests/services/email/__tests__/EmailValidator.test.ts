import { EmailValidator } from '../../../../src/services/email/EmailValidator';
import { OpenAIService } from '../../../../src/services/openai/OpenAIService';
import { createClient } from '@supabase/supabase-js';

// Mock OpenAI service
jest.mock('../../../../src/services/openai/OpenAIService', () => {
  const mockCreateChatCompletion = jest.fn();
  return {
    OpenAIService: {
      getInstance: jest.fn(() => ({
        createChatCompletion: mockCreateChatCompletion
      }))
    }
  };
});

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: null,
            error: null
          }))
        }))
      }))
    }))
  }))
}));

// Mock fetch for link validation
global.fetch = jest.fn();

describe('EmailValidator', () => {
  let validator: EmailValidator;
  let mockOpenAI: jest.Mocked<OpenAIService>;

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new EmailValidator();
    mockOpenAI = OpenAIService.getInstance() as jest.Mocked<OpenAIService>;
  });

  describe('validateEmail', () => {
    const validSubject = 'Test Subject';
    const validBody = 'This is a test email body.';

    it('should validate email successfully with all checks enabled', async () => {
      const mockResponses = [
        '0.1', // spam score
        JSON.stringify({
          tone: 'professional',
          confidence: 0.9,
          suggestions: ['Good tone']
        }),
        JSON.stringify({
          errors: []
        }),
        JSON.stringify({
          errors: []
        })
      ];

      mockResponses.forEach(response => {
        mockOpenAI.createChatCompletion.mockResolvedValueOnce(response);
      });

      const result = await validator.validateEmail(validSubject, validBody, {
        checkGrammar: true,
        checkSpelling: true,
        validateLinks: true,
        generatePreview: true
      });

      expect(result.isValid).toBe(true);
      expect(result.formatValid).toBe(true);
      expect(result.spamScore).toBe(0.1);
      expect(result.toneAnalysis).toEqual({
        tone: 'professional',
        confidence: 0.9,
        suggestions: ['Good tone']
      });
      expect(result.grammarCheck.errors).toEqual([]);
      expect(result.spellCheck.errors).toEqual([]);
      expect(result.links).toEqual([]);
      expect(result.preview.plainText).toBe(validBody);
      expect(result.preview.html).toContain(validBody);
    });

    it('should detect spam content', async () => {
      const spamSubject = 'URGENT: ACT NOW!!!';
      const spamBody = '100% FREE GUARANTEED WINNER';

      const mockResponses = [
        '0.9', // spam score
        JSON.stringify({
          tone: 'aggressive',
          confidence: 0.95,
          suggestions: ['Avoid urgent language']
        })
      ];

      mockResponses.forEach(response => {
        mockOpenAI.createChatCompletion.mockResolvedValueOnce(response);
      });

      const result = await validator.validateEmail(spamSubject, spamBody);

      expect(result.isValid).toBe(false);
      expect(result.formatValid).toBe(false);
    });

    it('should validate links in email body', async () => {
      const bodyWithLinks = 'Check out https://example.com and https://test.com';
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      const mockResponses = [
        '0.1', // spam score
        JSON.stringify({
          tone: 'professional',
          confidence: 0.9,
          suggestions: []
        })
      ];

      mockResponses.forEach(response => {
        mockOpenAI.createChatCompletion.mockResolvedValueOnce(response);
      });

      const result = await validator.validateEmail(validSubject, bodyWithLinks, {
        validateLinks: true
      });

      expect(result.links).toEqual([
        { url: 'https://example.com', isValid: true },
        { url: 'https://test.com', isValid: false, error: 'HTTP 404' }
      ]);
    });

    it('should handle grammar and spelling checks', async () => {
      const mockResponses = [
        '0.1', // spam score
        JSON.stringify({
          tone: 'professional',
          confidence: 0.9,
          suggestions: []
        }),
        JSON.stringify({
          errors: [{
            type: 'grammar',
            message: 'Incorrect verb tense',
            suggestion: 'Use past tense'
          }]
        }),
        JSON.stringify({
          errors: [{
            word: 'teh',
            suggestions: ['the']
          }]
        })
      ];

      mockResponses.forEach(response => {
        mockOpenAI.createChatCompletion.mockResolvedValueOnce(response);
      });

      const result = await validator.validateEmail(validSubject, validBody, {
        checkGrammar: true,
        checkSpelling: true
      });

      expect(result.grammarCheck.errors).toEqual([{
        type: 'grammar',
        message: 'Incorrect verb tense',
        suggestion: 'Use past tense'
      }]);
      expect(result.spellCheck.errors).toEqual([{
        word: 'teh',
        suggestions: ['the']
      }]);
    });

    it('should handle errors gracefully', async () => {
      mockOpenAI.createChatCompletion.mockRejectedValueOnce(new Error('API error'));

      await expect(validator.validateEmail(validSubject, validBody))
        .rejects
        .toThrow('Email validation failed: API error');
    });
  });
}); 