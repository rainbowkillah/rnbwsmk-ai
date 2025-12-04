/**
 * BrowserService
 * Web scraping and crawling using Cloudflare Browser Rendering
 * Phase 7: Advanced Features
 */

import puppeteer from '@cloudflare/puppeteer';

export interface CrawlOptions {
  waitFor?: string; // CSS selector to wait for
  screenshot?: boolean;
  extractLinks?: boolean;
  timeout?: number; // milliseconds
  userAgent?: string;
}

export interface CrawlResult {
  url: string;
  title: string;
  text: string;
  html?: string;
  links?: string[];
  screenshot?: string; // base64 encoded
  metadata: {
    statusCode: number;
    contentType?: string;
    crawledAt: number;
    loadTime: number;
  };
}

export class BrowserService {
  private browser: Fetcher;

  constructor(browser: Fetcher) {
    this.browser = browser;
  }

  /**
   * Crawl a website and extract content
   */
  async crawlWebsite(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
    const startTime = Date.now();

    try {
      // Launch browser session
      const browserInstance = await puppeteer.launch(this.browser);
      const page = await browserInstance.newPage();

      // Set user agent if provided
      if (options.userAgent) {
        await page.setUserAgent(options.userAgent);
      }

      // Set timeout
      const timeout = options.timeout || 30000;
      page.setDefaultTimeout(timeout);

      // Navigate to URL
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout
      });

      // Wait for specific element if requested
      if (options.waitFor) {
        await page.waitForSelector(options.waitFor, { timeout: 10000 });
      }

      // Extract page title
      const title = await page.title();

      // Extract text content (visible text only)
      const text = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach(el => el.remove());

        // Get text content
        return document.body.innerText || document.body.textContent || '';
      });

      // Extract links if requested
      let links: string[] | undefined;
      if (options.extractLinks) {
        links = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a[href]'));
          return anchors
            .map(a => (a as HTMLAnchorElement).href)
            .filter(href => href.startsWith('http'));
        });
      }

      // Take screenshot if requested
      let screenshot: string | undefined;
      if (options.screenshot) {
        const screenshotBuffer = await page.screenshot({
          type: 'png',
          fullPage: false // Just viewport
        });
        screenshot = Buffer.from(screenshotBuffer).toString('base64');
      }

      // Get HTML if needed (optional, can be large)
      const html = await page.content();

      await browserInstance.close();

      const loadTime = Date.now() - startTime;

      return {
        url,
        title,
        text: text.trim(),
        html: html.substring(0, 50000), // Limit HTML size
        links,
        screenshot,
        metadata: {
          statusCode: response?.status() || 200,
          contentType: response?.headers()['content-type'],
          crawledAt: Date.now(),
          loadTime
        }
      };
    } catch (error) {
      throw new Error(`Failed to crawl ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract structured data from a webpage
   */
  async extractStructuredData(url: string): Promise<{
    jsonLd?: any[];
    openGraph?: Record<string, string>;
    meta?: Record<string, string>;
  }> {
    const browserInstance = await puppeteer.launch(this.browser);
    const page = await browserInstance.newPage();

    await page.goto(url, { waitUntil: 'networkidle2' });

    const structured = await page.evaluate(() => {
      // Extract JSON-LD
      const jsonLdScripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      );
      const jsonLd = jsonLdScripts
        .map(script => {
          try {
            return JSON.parse(script.textContent || '');
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // Extract Open Graph tags
      const ogTags = Array.from(document.querySelectorAll('meta[property^="og:"]'));
      const openGraph: Record<string, string> = {};
      ogTags.forEach(tag => {
        const property = tag.getAttribute('property');
        const content = tag.getAttribute('content');
        if (property && content) {
          openGraph[property.replace('og:', '')] = content;
        }
      });

      // Extract meta tags
      const metaTags = Array.from(document.querySelectorAll('meta[name]'));
      const meta: Record<string, string> = {};
      metaTags.forEach(tag => {
        const name = tag.getAttribute('name');
        const content = tag.getAttribute('content');
        if (name && content) {
          meta[name] = content;
        }
      });

      return { jsonLd, openGraph, meta };
    });

    await browserInstance.close();

    return structured;
  }

  /**
   * Check if a URL is accessible
   */
  async checkUrl(url: string): Promise<{
    accessible: boolean;
    statusCode?: number;
    error?: string;
  }> {
    try {
      const browserInstance = await puppeteer.launch(this.browser);
      const page = await browserInstance.newPage();

      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      const statusCode = response?.status() || 0;

      await browserInstance.close();

      return {
        accessible: statusCode >= 200 && statusCode < 400,
        statusCode
      };
    } catch (error) {
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get page preview/metadata
   */
  async getPagePreview(url: string): Promise<{
    title: string;
    description?: string;
    image?: string;
    favicon?: string;
  }> {
    const browserInstance = await puppeteer.launch(this.browser);
    const page = await browserInstance.newPage();

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    const preview = await page.evaluate(() => {
      // Get title
      const title = document.title;

      // Get description from meta tags
      const descMeta = document.querySelector('meta[name="description"]');
      const ogDesc = document.querySelector('meta[property="og:description"]');
      const description = descMeta?.getAttribute('content') ||
        ogDesc?.getAttribute('content') ||
        undefined;

      // Get image
      const ogImage = document.querySelector('meta[property="og:image"]');
      const image = ogImage?.getAttribute('content') || undefined;

      // Get favicon
      const faviconLink = document.querySelector('link[rel="icon"]') ||
        document.querySelector('link[rel="shortcut icon"]');
      const favicon = faviconLink?.getAttribute('href') || undefined;

      return { title, description, image, favicon };
    });

    await browserInstance.close();

    return preview;
  }

  /**
   * Crawl multiple URLs in parallel
   */
  async crawlMultiple(urls: string[], options: CrawlOptions = {}): Promise<CrawlResult[]> {
    // Limit concurrent requests to avoid overwhelming the browser
    const maxConcurrent = 3;
    const results: CrawlResult[] = [];

    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch.map(url => this.crawlWebsite(url, options))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Crawl failed:', result.reason);
        }
      }
    }

    return results;
  }
}
