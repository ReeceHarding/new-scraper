import { URLManager } from '../../../src/services/crawler/URLManager';
import { logger } from '../../../src/lib/logging';

describe('URLManager', () => {
  let urlManager: URLManager;

  beforeEach(() => {
    urlManager = new URLManager();
    jest.clearAllMocks();
  });

  describe('normalizeURL', () => {
    it('should normalize URLs correctly', () => {
      const testCases = [
        {
          input: 'HTTP://ExAmPlE.CoM/path/../test?q=1#hash',
          expected: 'http://example.com/test?q=1'
        },
        {
          input: 'https://example.com//double/slash/',
          expected: 'https://example.com/double/slash'
        },
        {
          input: 'http://example.com/./path/',
          expected: 'http://example.com/path'
        },
        {
          input: 'http://example.com:80/path',
          expected: 'http://example.com/path'
        },
        {
          input: 'https://example.com:443/path',
          expected: 'https://example.com/path'
        },
        {
          input: 'http://user:pass@example.com/path',
          expected: 'http://example.com/path'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(urlManager.normalizeURL(input)).toBe(expected);
      });
    });

    it('should handle invalid URLs', () => {
      const invalidURLs = [
        '',
        'not a url',
        'http://',
        'ftp://example.com'
      ];

      invalidURLs.forEach(url => {
        expect(() => urlManager.normalizeURL(url)).toThrow('Invalid URL');
      });
    });

    it('should log normalization operations', () => {
      const spy = jest.spyOn(logger, 'debug');
      const url = 'HTTP://ExAmPlE.CoM/path/';
      urlManager.normalizeURL(url);
      
      expect(spy).toHaveBeenCalledWith('Normalizing URL', {
        original: url,
        normalized: 'http://example.com/path'
      });
    });
  });

  describe('validateURL', () => {
    it('should validate URLs correctly', () => {
      const validURLs = [
        'https://example.com',
        'http://example.com/path',
        'https://sub.example.com/path?query=1',
        'http://example.com/path#fragment',
        'https://example.com:8080/path'
      ];

      validURLs.forEach(url => {
        expect(urlManager.validateURL(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidURLs = [
        '',
        'not a url',
        'http://',
        'ftp://example.com',
        'mailto:test@example.com',
        'javascript:alert(1)',
        'data:text/plain,hello',
        'file:///path/to/file',
        '//example.com',
        'https:/example.com',
        'https://example..com',
        'https://example.com:abc',
        'https://example.com:-80'
      ];

      invalidURLs.forEach(url => {
        expect(urlManager.validateURL(url)).toBe(false);
      });
    });

    it('should validate URLs with specific TLDs', () => {
      const validTLDs = [
        'https://example.com',
        'https://example.org',
        'https://example.net',
        'https://example.edu',
        'https://example.gov'
      ];

      validTLDs.forEach(url => {
        expect(urlManager.validateURL(url)).toBe(true);
      });
    });

    it('should reject URLs with invalid TLDs', () => {
      const invalidTLDs = [
        'https://example.invalid',
        'https://example.test',
        'https://example.local',
        'https://example.internal'
      ];

      invalidTLDs.forEach(url => {
        expect(urlManager.validateURL(url)).toBe(false);
      });
    });

    it('should validate URLs with common subdomains', () => {
      const validSubdomains = [
        'https://www.example.com',
        'https://blog.example.com',
        'https://api.example.com',
        'https://dev.example.com',
        'https://staging.example.com'
      ];

      validSubdomains.forEach(url => {
        expect(urlManager.validateURL(url)).toBe(true);
      });
    });

    it('should log validation operations', () => {
      const spy = jest.spyOn(logger, 'debug');
      const url = 'https://example.com';
      urlManager.validateURL(url);
      
      expect(spy).toHaveBeenCalledWith('Validating URL', {
        url,
        isValid: true
      });
    });
  });

  describe('queueURL', () => {
    it('should queue valid URLs', () => {
      const url = 'https://example.com';
      const depth = 1;
      const priority = 1;

      expect(urlManager.queueURL(url, depth, priority)).toBe(true);
      expect(urlManager.getQueueSize()).toBe(1);
    });

    it('should not queue invalid URLs', () => {
      const url = 'not a url';
      const depth = 1;
      const priority = 1;

      expect(urlManager.queueURL(url, depth, priority)).toBe(false);
      expect(urlManager.getQueueSize()).toBe(0);
    });

    it('should not queue URLs beyond max depth', () => {
      const url = 'https://example.com';
      const depth = 3; // Max depth is 2
      const priority = 1;

      expect(urlManager.queueURL(url, depth, priority)).toBe(false);
      expect(urlManager.getQueueSize()).toBe(0);
    });

    it('should queue URLs with different priorities', () => {
      const urls = [
        { url: 'https://example1.com', depth: 1, priority: 2 },
        { url: 'https://example2.com', depth: 1, priority: 1 },
        { url: 'https://example3.com', depth: 1, priority: 3 }
      ];

      urls.forEach(({ url, depth, priority }) => {
        expect(urlManager.queueURL(url, depth, priority)).toBe(true);
      });

      expect(urlManager.getQueueSize()).toBe(3);
      
      // URLs should be dequeued in priority order (highest first)
      expect(urlManager.dequeueURL()).toBe('https://example3.com/');
      expect(urlManager.dequeueURL()).toBe('https://example1.com/');
      expect(urlManager.dequeueURL()).toBe('https://example2.com/');
    });

    it('should handle duplicate URLs', () => {
      const url = 'https://example.com';
      const depth = 1;
      const priority = 1;

      expect(urlManager.queueURL(url, depth, priority)).toBe(true);
      expect(urlManager.queueURL(url, depth, priority)).toBe(false); // Duplicate
      expect(urlManager.getQueueSize()).toBe(1);
    });

    it('should log queuing operations', () => {
      const spy = jest.spyOn(logger, 'debug');
      const url = 'https://example.com';
      const depth = 1;
      const priority = 1;

      urlManager.queueURL(url, depth, priority);
      
      const calls = spy.mock.calls;
      const queueCall = calls.find(call => call[0] === 'Queuing URL');
      expect(queueCall).toBeTruthy();
      expect(queueCall![1]).toEqual({
        url: 'https://example.com/',
        depth,
        priority,
        queueSize: 1
      });
    });
  });

  describe('dequeueURL', () => {
    it('should return null for empty queue', () => {
      expect(urlManager.dequeueURL()).toBeNull();
    });

    it('should dequeue URLs in priority order', () => {
      const urls = [
        { url: 'https://example1.com', depth: 1, priority: 1 },
        { url: 'https://example2.com', depth: 1, priority: 2 }
      ];

      urls.forEach(({ url, depth, priority }) => {
        urlManager.queueURL(url, depth, priority);
      });

      expect(urlManager.dequeueURL()).toBe('https://example2.com/');
      expect(urlManager.dequeueURL()).toBe('https://example1.com/');
      expect(urlManager.dequeueURL()).toBeNull();
    });

    it('should log dequeuing operations', () => {
      const spy = jest.spyOn(logger, 'debug');
      const url = 'https://example.com';
      const depth = 1;
      const priority = 1;

      urlManager.queueURL(url, depth, priority);
      urlManager.dequeueURL();
      
      const calls = spy.mock.calls;
      const dequeueCall = calls.find(call => call[0] === 'Dequeuing URL');
      expect(dequeueCall).toBeTruthy();
      expect(dequeueCall![1]).toEqual({
        url: 'https://example.com/',
        queueSize: 0
      });
    });
  });

  describe('getQueueSize', () => {
    it('should return correct queue size', () => {
      expect(urlManager.getQueueSize()).toBe(0);

      urlManager.queueURL('https://example1.com', 1, 1);
      expect(urlManager.getQueueSize()).toBe(1);

      urlManager.queueURL('https://example2.com', 1, 1);
      expect(urlManager.getQueueSize()).toBe(2);

      urlManager.dequeueURL();
      expect(urlManager.getQueueSize()).toBe(1);

      urlManager.dequeueURL();
      expect(urlManager.getQueueSize()).toBe(0);
    });
  });
}); 