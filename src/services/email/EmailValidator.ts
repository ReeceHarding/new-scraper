import { logger } from '@/services/logging';
import { ValidationError } from '@/lib/errors';
import { OpenAIService, ChatMessage } from '@/services/openai/OpenAIService';
import { createClient } from '@supabase/supabase-js';

export interface EmailValidationResult {
  isValid: boolean;
  formatValid: boolean;
  spamScore: number;
  toneAnalysis: {
    tone: string;
    confidence: number;
    suggestions: string[];
  };
  grammarCheck: {
    errors: Array<{
      type: string;
      message: string;
      suggestion: string;
    }>;
  };
  spellCheck: {
    errors: Array<{
      word: string;
      suggestions: string[];
    }>;
  };
  links: Array<{
    url: string;
    isValid: boolean;
    error?: string;
  }>;
  preview: {
    plainText: string;
    html: string;
  };
}

export class EmailValidator {
  private readonly openai: OpenAIService;
  private readonly supabase;

  constructor() {
    this.openai = OpenAIService.getInstance();
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async validateEmail(
    subject: string,
    body: string,
    options: {
      checkGrammar?: boolean;
      checkSpelling?: boolean;
      validateLinks?: boolean;
      generatePreview?: boolean;
    } = {}
  ): Promise<EmailValidationResult> {
    try {
      logger.info('Starting email validation');

      const [
        formatCheck,
        spamScore,
        toneAnalysis,
        grammarCheck,
        spellCheck,
        linksValidation,
        preview
      ] = await Promise.all([
        this.checkFormat(subject, body),
        this.calculateSpamScore(subject, body),
        this.analyzeTone(subject, body),
        options.checkGrammar ? this.checkGrammar(body) : { errors: [] },
        options.checkSpelling ? this.checkSpelling(body) : { errors: [] },
        options.validateLinks ? this.validateLinks(body) : [],
        options.generatePreview ? this.generatePreview(subject, body) : { plainText: body, html: body }
      ]);

      const result: EmailValidationResult = {
        isValid: formatCheck && spamScore < 0.7,
        formatValid: formatCheck,
        spamScore,
        toneAnalysis,
        grammarCheck,
        spellCheck,
        links: linksValidation,
        preview
      };

      await this.logValidationResult(result);
      logger.info('Email validation completed');

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Email validation failed', { error: errorMessage });
      throw new ValidationError('Email validation failed: ' + errorMessage);
    }
  }

  private async checkFormat(subject: string, body: string): Promise<boolean> {
    // Basic format validation
    if (!subject?.trim()) {
      return false;
    }

    if (!body?.trim()) {
      return false;
    }

    // Check subject length
    if (subject.length > 100) {
      return false;
    }

    // Check for common spam patterns
    const spamPatterns = [
      /^\s*URGENT/i,
      /^\s*ACT NOW/i,
      /100% FREE/i,
      /GUARANTEED WINNER/i
    ];

    for (const pattern of spamPatterns) {
      if (pattern.test(subject) || pattern.test(body)) {
        return false;
      }
    }

    return true;
  }

  private async calculateSpamScore(subject: string, body: string): Promise<number> {
    const messages: ChatMessage[] = [
      {
        role: 'system' as const,
        content: 'You are an expert at detecting spam emails. Analyze the given email and return a spam score between 0 and 1, where 0 is definitely not spam and 1 is definitely spam.'
      },
      {
        role: 'user' as const,
        content: `Subject: ${subject}\n\nBody: ${body}`
      }
    ];

    const response = await this.openai.createChatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 50
    });

    return parseFloat(response) || 0;
  }

  private async analyzeTone(subject: string, body: string): Promise<EmailValidationResult['toneAnalysis']> {
    const messages: ChatMessage[] = [
      {
        role: 'system' as const,
        content: `Analyze the tone of the email and provide suggestions for improvement. Return JSON in the format:
        {
          "tone": "professional|casual|aggressive|friendly|etc",
          "confidence": number between 0 and 1,
          "suggestions": ["suggestion1", "suggestion2", ...]
        }`
      },
      {
        role: 'user' as const,
        content: `Subject: ${subject}\n\nBody: ${body}`
      }
    ];

    const response = await this.openai.createChatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 500
    });

    return JSON.parse(response);
  }

  private async checkGrammar(text: string): Promise<EmailValidationResult['grammarCheck']> {
    const messages: ChatMessage[] = [
      {
        role: 'system' as const,
        content: `Check the text for grammar errors and provide suggestions. Return JSON in the format:
        {
          "errors": [
            {
              "type": "grammar type",
              "message": "error description",
              "suggestion": "suggested correction"
            }
          ]
        }`
      },
      {
        role: 'user' as const,
        content: text
      }
    ];

    const response = await this.openai.createChatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 500
    });

    return JSON.parse(response);
  }

  private async checkSpelling(text: string): Promise<EmailValidationResult['spellCheck']> {
    const messages: ChatMessage[] = [
      {
        role: 'system' as const,
        content: `Check the text for spelling errors and provide suggestions. Return JSON in the format:
        {
          "errors": [
            {
              "word": "misspelled word",
              "suggestions": ["suggestion1", "suggestion2", ...]
            }
          ]
        }`
      },
      {
        role: 'user' as const,
        content: text
      }
    ];

    const response = await this.openai.createChatCompletion(messages, {
      temperature: 0.3,
      maxTokens: 500
    });

    return JSON.parse(response);
  }

  private async validateLinks(body: string): Promise<EmailValidationResult['links']> {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = body.match(urlRegex) || [];
    const uniqueUrls = [...new Set(matches)];

    return await Promise.all(
      uniqueUrls.map(async (url) => {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          return {
            url,
            isValid: response.ok,
            error: response.ok ? undefined : `HTTP ${response.status}`
          };
        } catch (error) {
          return {
            url,
            isValid: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );
  }

  private async generatePreview(subject: string, body: string): Promise<EmailValidationResult['preview']> {
    // Convert markdown/text to HTML
    const html = body
      .split('\n')
      .map(line => `<p>${line}</p>`)
      .join('');

    return {
      plainText: body,
      html: `
        <html>
          <head>
            <title>${subject}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
            </style>
          </head>
          <body>
            <h1>${subject}</h1>
            ${html}
          </body>
        </html>
      `
    };
  }

  private async logValidationResult(result: EmailValidationResult): Promise<void> {
    try {
      await this.supabase
        .from('email_validation_logs')
        .insert([{
          timestamp: new Date(),
          result: result,
          metadata: {
            version: '1.0',
            features: {
              formatCheck: true,
              spamScore: true,
              toneAnalysis: true,
              grammarCheck: result.grammarCheck.errors.length > 0,
              spellCheck: result.spellCheck.errors.length > 0,
              linkValidation: result.links.length > 0,
              preview: true
            }
          }
        }]);
    } catch (error) {
      logger.error('Failed to log validation result', { error });
      // Don't throw error here as it's not critical
    }
  }
} 