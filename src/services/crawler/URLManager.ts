import { logger } from '../../lib/logging';

interface QueueItem {
  url: string;
  depth: number;
  priority: number;
}

export class URLManager {
  private readonly MAX_DEPTH = 2;
  private queue: QueueItem[] = [];
  private seenUrls = new Set<string>();

  // List of valid top-level domains
  private validTLDs = new Set([
    'com', 'org', 'net', 'edu', 'gov', 'mil',
    'int', 'eu', 'uk', 'us', 'ca', 'au', 'de',
    'fr', 'jp', 'ru', 'ch', 'it', 'nl', 'se',
    'no', 'es', 'pl', 'br', 'in', 'cn'
  ]);

  // List of blocked protocols
  private blockedProtocols = new Set([
    'ftp:', 'mailto:', 'javascript:', 'data:',
    'file:', 'tel:', 'sms:', 'ws:', 'wss:'
  ]);

  /**
   * Validates a URL by checking:
   * - Valid URL format
   * - Allowed protocols (http/https only)
   * - Valid TLD
   * - Valid port number if present
   * - No malicious protocols
   */
  validateURL(url: string): boolean {
    try {
      // Check for empty URL
      if (!url || url.trim() === '') {
        logger.debug('Validating URL', {
          url,
          isValid: false,
          reason: 'Empty URL'
        });
        return false;
      }

      // Basic URL format check
      const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
      if (!urlRegex.test(url)) {
        logger.debug('Validating URL', {
          url,
          isValid: false,
          reason: 'Invalid URL format'
        });
        return false;
      }

      // Parse the URL
      const parsedUrl = new URL(url);

      // Check protocol
      if (this.blockedProtocols.has(parsedUrl.protocol.toLowerCase())) {
        logger.debug('Validating URL', {
          url,
          isValid: false,
          reason: 'Blocked protocol'
        });
        return false;
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol.toLowerCase())) {
        logger.debug('Validating URL', {
          url,
          isValid: false,
          reason: 'Invalid protocol'
        });
        return false;
      }

      // Check hostname format
      const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
      if (!hostnameRegex.test(parsedUrl.hostname)) {
        logger.debug('Validating URL', {
          url,
          isValid: false,
          reason: 'Invalid hostname format'
        });
        return false;
      }

      // Check for consecutive dots
      if (parsedUrl.hostname.includes('..')) {
        logger.debug('Validating URL', {
          url,
          isValid: false,
          reason: 'Consecutive dots in hostname'
        });
        return false;
      }

      // Check TLD
      const tld = parsedUrl.hostname.split('.').pop();
      if (!tld || !this.validTLDs.has(tld.toLowerCase())) {
        logger.debug('Validating URL', {
          url,
          isValid: false,
          reason: 'Invalid TLD'
        });
        return false;
      }

      // Check port if present
      if (parsedUrl.port) {
        const port = parseInt(parsedUrl.port, 10);
        if (isNaN(port) || port <= 0 || port > 65535) {
          logger.debug('Validating URL', {
            url,
            isValid: false,
            reason: 'Invalid port number'
          });
          return false;
        }
      }

      logger.debug('Validating URL', {
        url,
        isValid: true
      });

      return true;
    } catch (error) {
      logger.debug('Validating URL', {
        url,
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  /**
   * Normalizes a URL by:
   * - Converting to lowercase
   * - Removing default ports (80 for HTTP, 443 for HTTPS)
   * - Removing fragments (#)
   * - Removing authentication
   * - Resolving relative paths
   * - Removing trailing slashes
   * - Removing duplicate slashes
   */
  normalizeURL(url: string): string {
    try {
      if (!url) {
        throw new Error('Invalid URL');
      }

      // Parse the URL
      const parsedUrl = new URL(url);

      // Only allow HTTP and HTTPS
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid URL: Only HTTP and HTTPS protocols are supported');
      }

      // Convert hostname to lowercase
      parsedUrl.hostname = parsedUrl.hostname.toLowerCase();

      // Remove default ports
      if ((parsedUrl.protocol === 'http:' && parsedUrl.port === '80') ||
          (parsedUrl.protocol === 'https:' && parsedUrl.port === '443')) {
        parsedUrl.port = '';
      }

      // Remove username and password
      parsedUrl.username = '';
      parsedUrl.password = '';

      // Remove hash
      parsedUrl.hash = '';

      // Normalize path
      parsedUrl.pathname = parsedUrl.pathname
        .replace(/\/+/g, '/') // Replace multiple slashes with single slash
        .replace(/\/$/, ''); // Remove trailing slash

      // Convert to string and create new URL to resolve any ../ or ./ in path
      const normalizedUrl = new URL(parsedUrl.toString());
      const result = normalizedUrl.origin + normalizedUrl.pathname + normalizedUrl.search;

      logger.debug('Normalizing URL', {
        original: url,
        normalized: result
      });

      return result;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid URL')) {
          throw error;
        }
        throw new Error('Invalid URL');
      }
      throw new Error('Invalid URL');
    }
  }

  /**
   * Queues a URL for crawling if:
   * - URL is valid
   * - URL hasn't been seen before
   * - Depth is within limits
   * - Priority is valid
   */
  queueURL(url: string, depth: number, priority: number): boolean {
    try {
      // Validate URL
      if (!this.validateURL(url)) {
        logger.debug('Failed to queue URL: Invalid URL', { url });
        return false;
      }

      // Check depth
      if (depth > this.MAX_DEPTH) {
        logger.debug('Failed to queue URL: Exceeds max depth', {
          url,
          depth,
          maxDepth: this.MAX_DEPTH
        });
        return false;
      }

      // Normalize URL for deduplication
      const normalizedUrl = this.normalizeURL(url);

      // Check if URL has been seen
      if (this.seenUrls.has(normalizedUrl)) {
        logger.debug('Failed to queue URL: Already seen', { url: normalizedUrl });
        return false;
      }

      // Add to queue and mark as seen
      this.queue.push({ url: normalizedUrl, depth, priority });
      this.seenUrls.add(normalizedUrl);

      // Sort queue by priority (highest first)
      this.queue.sort((a, b) => b.priority - a.priority);

      logger.debug('Queuing URL', {
        url: normalizedUrl,
        depth,
        priority,
        queueSize: this.queue.length
      });

      return true;
    } catch (error) {
      logger.error('Error queuing URL', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Dequeues the highest priority URL from the queue.
   * Returns null if queue is empty.
   */
  dequeueURL(): string | null {
    if (this.queue.length === 0) {
      return null;
    }

    const item = this.queue.shift();
    if (!item) {
      return null;
    }

    logger.debug('Dequeuing URL', {
      url: item.url,
      queueSize: this.queue.length
    });

    return item.url;
  }

  /**
   * Returns the current size of the URL queue
   */
  getQueueSize(): number {
    return this.queue.length;
  }
} 