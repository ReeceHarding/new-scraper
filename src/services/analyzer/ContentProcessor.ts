import { JSDOM } from 'jsdom'
import { convert, HtmlToTextOptions } from 'html-to-text'
import { createLogger } from '@/lib/logging'
import { ProcessingError } from '@/lib/errors'

interface ProcessedContent {
  text: string
  html: string
  xml: string
  title: string
  description: string
  links: Array<{
    url: string
    text: string
  }>
  images: Array<{
    url: string
    alt: string
  }>
}

export class ContentProcessor {
  private readonly logger = createLogger('content-processor')
  
  private readonly htmlToTextOptions: HtmlToTextOptions = {
    wordwrap: null,
    preserveNewlines: true,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' }
    ]
  }

  /**
   * Processes raw HTML content and extracts useful information
   */
  async processContent(html: string, baseUrl: string): Promise<ProcessedContent> {
    try {
      if (!html?.trim()) {
        this.logger.error('Failed to process content: Empty HTML')
        throw new ProcessingError('Empty HTML')
      }

      if (!baseUrl?.trim()) {
        this.logger.error('Failed to process content: Invalid base URL')
        throw new ProcessingError('Invalid base URL')
      }

      try {
        new URL(baseUrl)
      } catch (error) {
        this.logger.error('Failed to process content: Invalid base URL format')
        throw new ProcessingError('Invalid base URL format')
      }

      const dom = new JSDOM(html, { url: baseUrl })
      const document = dom.window.document

      if (!document || !document.documentElement) {
        this.logger.error('Failed to process content: Invalid HTML structure')
        throw new ProcessingError('Invalid HTML structure')
      }

      // Clean the DOM
      this.removeUnwantedElements(document)

      // Extract content
      const text = this.extractText(document)
      const cleanHtml = this.cleanHtml(document)
      const xml = this.convertToXml(document)
      const links = this.extractLinks(document, baseUrl)
      const images = this.extractImages(document, baseUrl)
      const { title, description } = this.extractMetadata(document)

      this.logger.info('Content processed successfully', {
        contentLength: text.length,
        linksCount: links.length,
        imagesCount: images.length
      })

      return {
        text: text || '',
        html: cleanHtml || '',
        xml: xml || '',
        title: title || '',
        description: description || '',
        links: links || [],
        images: images || []
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (!(error instanceof ProcessingError)) {
        this.logger.error(`Failed to process content: ${message}`, { error })
      }
      throw error instanceof ProcessingError ? error : new ProcessingError(`Failed to process content: ${message}`)
    }
  }

  /**
   * Removes unwanted elements from the DOM
   */
  private removeUnwantedElements(document: Document): void {
    const unwantedSelectors = [
      'script',
      'style',
      'iframe',
      'noscript',
      '[aria-hidden="true"]',
      '.hidden',
      '#cookie-banner',
      '.cookie-notice',
      '.advertisement',
      '.social-share'
    ]

    unwantedSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        element.remove()
      })
    })
  }

  /**
   * Extracts clean text content from the document
   */
  private extractText(document: Document): string {
    return convert(document.documentElement.outerHTML, this.htmlToTextOptions)
      .trim()
      .replace(/[\r\n]+/g, '\n')
  }

  /**
   * Cleans HTML by removing unnecessary attributes and normalizing structure
   */
  private cleanHtml(document: Document): string {
    const clone = document.cloneNode(true) as Document
    const unwantedAttributes = [
      'style',
      'class',
      'id',
      'onclick',
      'onload',
      'onmouseover',
      'onmouseout',
      'data-*'
    ]

    const walk = document.createTreeWalker(
      clone.documentElement,
      NodeFilter.SHOW_ELEMENT
    )

    let node = walk.nextNode() as Element
    while (node) {
      unwantedAttributes.forEach(attr => {
        if (attr.endsWith('*')) {
          const prefix = attr.slice(0, -1)
          Array.from(node.attributes)
            .filter(({ name }) => name.startsWith(prefix))
            .forEach(({ name }) => node.removeAttribute(name))
        } else {
          node.removeAttribute(attr)
        }
      })
      node = walk.nextNode() as Element
    }

    return clone.documentElement.outerHTML
  }

  /**
   * Converts the document to a simplified XML format
   */
  private convertToXml(document: Document): string {
    const clone = document.cloneNode(true) as Document
    const root = clone.createElement('content')
    
    // Extract main content sections
    const sections = Array.from(clone.querySelectorAll('main, article, section, .content'))
      .filter(el => {
        const text = el.textContent?.trim() || ''
        return text.length > 100 // Only keep substantial sections
      })

    if (sections.length === 0) {
      // Fallback to body if no main content sections found
      sections.push(clone.body)
    }

    sections.forEach((section, index) => {
      const sectionEl = clone.createElement('section')
      sectionEl.setAttribute('id', `section-${index + 1}`)
      sectionEl.innerHTML = section.innerHTML
      root.appendChild(sectionEl)
    })

    return root.outerHTML
  }

  /**
   * Extracts and normalizes all links from the document
   */
  private extractLinks(document: Document, baseUrl: string): Array<{ url: string, text: string }> {
    const links: Array<{ url: string, text: string }> = []
    const base = new URL(baseUrl)

    document.querySelectorAll('a[href]').forEach(anchor => {
      try {
        const href = anchor.getAttribute('href')
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
          return
        }

        const url = new URL(href, baseUrl)
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          // Remove trailing slash for comparison
          const normalizedUrl = url.href.replace(/\/$/, '')
          links.push({
            url: normalizedUrl,
            text: anchor.textContent?.trim() || ''
          })
        }
      } catch (error) {
        // Invalid URL, skip
      }
    })

    return links
  }

  /**
   * Extracts image information from the document
   */
  private extractImages(document: Document, baseUrl: string): Array<{ url: string, alt: string }> {
    const validImages = Array.from(document.querySelectorAll('img'))
      .map(img => {
        const src = img.getAttribute('src')
        if (!src) return null

        try {
          const url = new URL(src, baseUrl)
          return {
            url: url.href,
            alt: img.getAttribute('alt') || ''
          }
        } catch (error) {
          return null
        }
      })
      .filter((img): img is { url: string, alt: string } => img !== null)

    return validImages
  }

  /**
   * Extracts metadata from the document
   */
  private extractMetadata(document: Document): { title: string, description: string } {
    const title = document.querySelector('title')?.textContent?.trim() ||
                 document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
                 document.querySelector('h1')?.textContent?.trim() ||
                 ''

    const description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ||
                       document.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() ||
                       ''

    return { title, description }
  }
} 