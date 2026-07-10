import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

export interface ScrapedData {
  title: string;
  metaDescription: string;
  h1s: string[];
  h2s: string[];
  heroText: string;
  ctas: { text: string; href: string }[];
  testimonials: string[];
  faqs: { question: string; answer: string }[];
  pricing: string[];
  images: { src: string; alt: string }[];
  buttons: string[];
  navigation: string[];
  footer: string;
  trustBadges: string[];
  aboveFoldContent: string;
  socialProof: string[];
  guarantees: string[];
  riskReversal: string[];
  screenshotPath?: string;
  error?: string;
}

// Reusable Cheerio Scrape Engine - safe for Vercel Serverless
async function runCheerioScrape(url: string, warningMessage: string): Promise<ScrapedData> {
  console.log(`[Scraper] Executing Cheerio scrape for ${url}...`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('title').text() || '';
    const metaDescription = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    
    const h1s: string[] = [];
    $('h1').each((_, el) => { h1s.push($(el).text().trim()); });
    
    const h2s: string[] = [];
    $('h2').each((_, el) => { h2s.push($(el).text().trim()); });

    const heroText = $('header, .hero, #hero').first().text().trim() || h1s[0] || '';

    const ctas: { text: string; href: string }[] = [];
    $('a[href*="signup"], a[href*="get-started"], a.btn, a.cta, button.cta').each((_, el) => {
      ctas.push({
        text: $(el).text().trim(),
        href: $(el).attr('href') || ''
      });
    });

    const buttons: string[] = [];
    $('button, input[type="submit"]').each((_, el) => { buttons.push($(el).text().trim()); });

    const navigation: string[] = [];
    $('nav a').slice(0, 10).each((_, el) => { navigation.push($(el).text().trim()); });

    const footer = $('footer').text().trim() || '';

    // Extract testimonials/reviews from body content
    const testimonials: string[] = [];
    $('.testimonial, .review, blockquote').each((_, el) => {
      testimonials.push($(el).text().trim());
    });

    const bodyText = $('body').text() || '';

    return {
      title: title.trim(),
      metaDescription: metaDescription.trim(),
      h1s: h1s.filter(Boolean),
      h2s: h2s.filter(Boolean),
      heroText: heroText.trim(),
      ctas: ctas.filter(c => c.text),
      testimonials: testimonials.filter(Boolean).slice(0, 5),
      faqs: [],
      pricing: [],
      images: [],
      buttons: buttons.filter(Boolean).slice(0, 10),
      navigation: navigation.filter(Boolean),
      footer: footer.trim(),
      trustBadges: [],
      aboveFoldContent: bodyText.slice(0, 2000).trim(),
      socialProof: [],
      guarantees: [],
      riskReversal: [],
      screenshotPath: undefined,
      error: warningMessage
    };
  } catch (cheerioError: any) {
    console.error('[Scraper] Cheerio scrape failed:', cheerioError);
    throw new Error(`Failed to scrape target landing page: ${cheerioError.message || cheerioError}`);
  }
}

export async function scrapeUrl(url: string, id: string): Promise<ScrapedData> {
  console.log(`[Scraper] Starting scrape for ${url} (ID: ${id})`);
  
  const isVercel = !!process.env.VERCEL;

  // On Vercel, skip Playwright entirely to prevent bundler reference errors
  if (isVercel) {
    console.log('[Scraper] Vercel detected. Bypassing browser launch and using Cheerio.');
    return runCheerioScrape(url, 'Rendered using lightweight HTML scraper because browser automation was unavailable.');
  }

  const publicDir = path.join(process.cwd(), 'public');
  const screenshotDir = path.join(publicDir, 'screenshots');

  // Ensure screenshot directory exists
  try {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  } catch (e) {
    console.warn('[Scraper] Read-only directory structure detected. Screenshot storage skipped.');
  }

  const screenshotFilename = `screenshot-${id}.png`;
  const relativeScreenshotPath = `/screenshots/${screenshotFilename}`;
  const absoluteScreenshotPath = path.join(screenshotDir, screenshotFilename);

  try {
    console.log('[Scraper] Attempting Playwright dynamic import...');
    // Dynamically import Playwright at runtime only (Local Dev Mode)
    const { chromium } = await import('playwright');
    
    console.log('[Scraper] Launching browser automation...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // Set timeout to 15s to keep it fast
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    
    // Take screenshot of above-the-fold
    try {
      await page.screenshot({ path: absoluteScreenshotPath });
      console.log(`[Scraper] Screenshot captured at ${absoluteScreenshotPath}`);
    } catch (err) {
      console.warn('[Scraper] Screenshot file write skipped (read-only filesystem).');
    }

    // Evaluate and extract content
    const data = await page.evaluate(() => {
      const getMeta = (name: string) => {
        return document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute('content') || '';
      };

      const getTexts = (selector: string) => {
        return Array.from(document.querySelectorAll(selector))
          .map(el => el.textContent?.trim() || '')
          .filter(t => t.length > 0);
      };

      const title = document.title || '';
      const metaDescription = getMeta('description') || getMeta('og:description') || '';
      const h1s = getTexts('h1');
      const h2s = getTexts('h2');
      
      const heroEl = document.querySelector('header, .hero, [class*="hero"], [id*="hero"]');
      const heroText = heroEl?.textContent?.trim() || '';

      const ctas = Array.from(document.querySelectorAll('a[class*="cta"], a[class*="btn"], button[class*="cta"], button[class*="btn"], a[href*="signup"], a[href*="register"], a[href*="get-started"]'))
        .map(el => ({
          text: el.textContent?.trim() || '',
          href: el.getAttribute('href') || ''
        }))
        .filter(c => c.text.length > 0);

      const buttons = getTexts('button, input[type="submit"]');
      const navigation = getTexts('nav a').slice(0, 10);
      const footer = document.querySelector('footer')?.textContent?.trim() || '';

      const testimonials: string[] = [];
      document.querySelectorAll('.testimonial, .review, blockquote').forEach(el => {
        testimonials.push(el.textContent?.trim() || '');
      });

      const faqs: { question: string; answer: string }[] = [];
      const trustBadges: string[] = [];
      const aboveFoldContent = document.body.innerText.slice(0, 2000);

      const socialProof: string[] = [];
      const guarantees: string[] = [];
      const riskReversal: string[] = [];

      return {
        title,
        metaDescription,
        h1s,
        h2s,
        heroText,
        ctas,
        testimonials,
        faqs,
        pricing: [],
        images: [],
        buttons,
        navigation,
        footer,
        trustBadges,
        aboveFoldContent,
        socialProof: socialProof.slice(0, 5),
        guarantees: guarantees.slice(0, 3),
        riskReversal: riskReversal.slice(0, 3)
      };
    });

    await browser.close();

    return {
      ...data,
      screenshotPath: relativeScreenshotPath
    };
  } catch (playwrightError: any) {
    console.warn('[Scraper] Local Playwright scrape failed, falling back to Cheerio...', playwrightError);
    return runCheerioScrape(url, 'Rendered using lightweight HTML scraper because browser automation was unavailable.');
  }
}
