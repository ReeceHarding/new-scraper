import { mockLogger, mockFormat } from '../../utils/test-utils';

// Mock winston before any imports
jest.mock('winston', () => ({
  format: mockFormat,
  transports: {
    Console: jest.fn().mockImplementation(() => ({
      log: jest.fn()
    })),
    File: jest.fn().mockImplementation(() => ({
      log: jest.fn()
    }))
  },
  createLogger: jest.fn().mockReturnValue(mockLogger),
  addColors: jest.fn()
}));

// Mock logging before imports
jest.mock('@/lib/logging', () => ({
  logger: mockLogger,
  baseLogger: mockLogger,
  createLogger: () => mockLogger,
  createContextLogger: () => mockLogger,
  initializeLogger: jest.fn().mockResolvedValue(undefined),
  __esModule: true
}));

// Imports after mocks
import { ContentProcessor } from '../../../src/services/analyzer/ContentProcessor';
import { JSDOM } from 'jsdom';
import type { ContentToAnalyze } from '@/types/analyzer';
import { ProcessingError } from '@/lib/errors';

// Add NodeFilter to global
global.NodeFilter = {
  SHOW_ELEMENT: 1,
  SHOW_TEXT: 4,
  FILTER_ACCEPT: 1,
  FILTER_REJECT: 2,
  FILTER_SKIP: 3
} as unknown as typeof NodeFilter;

describe('ContentProcessor', () => {
  let processor: ContentProcessor;
  let dom: JSDOM;
  const baseUrl = 'https://example.com';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mock document
    dom = new JSDOM(`
      <html>
        <body>
          <div id="content">
            <h1>Test Title</h1>
            <p>Test paragraph</p>
          </div>
        </body>
      </html>
    `);

    processor = new ContentProcessor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processContent', () => {
    it('should process HTML content correctly', async () => {
      const html = '<div><h1>Test</h1><p>Content</p></div>';
      const result = await processor.processContent(html, baseUrl);
      
      expect(result).toBeDefined();
      expect(result.text.toLowerCase()).toContain('test');
      expect(result.text.toLowerCase()).toContain('content');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should process valid HTML content', async () => {
      const validHtml = '<html><head><title>Test</title></head><body><div>Test Content</div></body></html>';
      const result = await processor.processContent(validHtml, baseUrl);

      expect(result).toBeDefined();
      expect(result.title).toBe('Test');
      expect(result.text).toContain('Test Content');
      expect(result.html).toBeDefined();
      expect(result.xml).toBeDefined();
    });

    it('should handle empty content', async () => {
      await expect(processor.processContent('', baseUrl))
        .rejects
        .toThrow(ProcessingError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process content: Empty HTML'
      );
    });

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<div>Test</div><p>Unclosed paragraph';
      
      const result = await processor.processContent(malformedHtml, baseUrl);
      
      expect(result).toBeDefined();
      expect(result.text).toContain('Test');
      expect(result.text).toContain('Unclosed paragraph');
      expect(result.html).toContain('<html>');
      expect(result.html).toContain('</html>');
      expect(result.html).toContain('<body>');
      expect(result.html).toContain('</body>');
    });

    it('should extract links correctly', async () => {
      const htmlWithLinks = `
        <html>
          <body>
            <a href="/relative">Relative Link</a>
            <a href="https://external.com">External Link</a>
          </body>
        </html>
      `;

      const result = await processor.processContent(htmlWithLinks, baseUrl);
      expect(result.links).toHaveLength(2);
      expect(result.links).toContainEqual({
        url: 'https://example.com/relative',
        text: 'Relative Link'
      });
      expect(result.links).toContainEqual({
        url: 'https://external.com',
        text: 'External Link'
      });
    });

    it('should extract images correctly', async () => {
      const htmlWithImages = `
        <html>
          <body>
            <img src="/image.jpg" alt="Test Image">
            <img src="https://external.com/image.png" alt="External Image">
          </body>
        </html>
      `;

      const result = await processor.processContent(htmlWithImages, baseUrl);
      expect(result.images).toHaveLength(2);
      expect(result.images).toContainEqual({
        url: 'https://example.com/image.jpg',
        alt: 'Test Image'
      });
      expect(result.images).toContainEqual({
        url: 'https://external.com/image.png',
        alt: 'External Image'
      });
    });

    it('should handle invalid HTML gracefully', async () => {
      const invalidHtml = '<div>Unclosed div';
      const result = await processor.processContent(invalidHtml, baseUrl);
      
      expect(result).toBeDefined();
      expect(result.text).toContain('Unclosed div');
      expect(result.html).toContain('<html>');
      expect(result.html).toContain('</html>');
    });
  });
});