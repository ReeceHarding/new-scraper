import { EmailValidator } from '../EmailValidator';
import { OpenAIService } from '@/services/openai/OpenAIService';
import { createClient } from '@supabase/supabase-js';

// Mock OpenAI service
jest.mock('@/services/openai/OpenAIService', () => ({
  OpenAIService: {
    getInstance: jest.fn(() => ({
      createChatCompletion: jest.fn()
    }))
  }
}));

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
      mockOpenAI.createChatCompletion
        .mockResolvedValueOnce('0.1') // spam score
        .mockResolvedValueOnce(JSON.stringify({
          tone: 'professional',
          confidence: 0.9,
          suggestions: ['Good tone']
        }))
        .mockResolvedValueOnce(JSON.stringify({
          errors: []
        }))
        .mockResolvedValueOnce(JSON.stringify({
          errors: []
        }));

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

      const result = await validator.validateEmail(spamSubject, spamBody);

      expect(result.isValid).toBe(false);
      expect(result.formatValid).toBe(false);
    });

    it('should validate links in email body', async () => {
      const bodyWithLinks = 'Check out https://example.com and https://test.com';
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      mockOpenAI.createChatCompletion
        .mockResolvedValueOnce('0.1')
        .mockResolvedValueOnce(JSON.stringify({
          tone: 'professional',
          confidence: 0.9,
          suggestions: []
        }));

      const result = await validator.validateEmail(validSubject, bodyWithLinks, {
        validateLinks: true
      });

      expect(result.links).toEqual([
        { url: 'https://example.com', isValid: true },
        { url: 'https://test.com', isValid: false, error: 'HTTP 404' }
      ]);
    });

    it('should handle grammar and spelling checks', async () => {
      mockOpenAI.createChatCompletion
        .mockResolvedValueOnce('0.1')
        .mockResolvedValueOnce(JSON.stringify({
          tone: 'professional',
          confidence: 0.9,
          suggestions: []
        }))
        .mockResolvedValueOnce(JSON.stringify({
          errors: [{
            type: 'grammar',
            message: 'Incorrect verb tense',
            suggestion: 'Use past tense'
          }]
        }))
        .mockResolvedValueOnce(JSON.stringify({
          errors: [{
            word: 'teh',
            suggestions: ['the']
          }]
        }));

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
      mockOpenAI.createChatCompletion.mockRejectedValue(new Error('API error'));

      await expect(validator.validateEmail(validSubject, validBody))
        .rejects
        .toThrow('Email validation failed: API error');
    });
  });
}); 