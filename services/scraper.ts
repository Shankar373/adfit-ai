import { chromium } from 'playwright';
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

export async function scrapeUrl(url: string, id: string): Promise<ScrapedData> {
  console.log(`[Scraper] Starting scrape for ${url} (ID: ${id})`);
  
  // Ensure screenshot directory exists
  const publicDir = path.join(process.cwd(), 'public');
  const screenshotDir = path.join(publicDir, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const screenshotFilename = `screenshot-${id}.png`;
  const relativeScreenshotPath = `/screenshots/${screenshotFilename}`;
  const absoluteScreenshotPath = path.join(screenshotDir, screenshotFilename);

  try {
    // Try Playwright first
    console.log('[Scraper] Attempting Playwright scrape...');
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
    
    // Wait an extra second for dynamic assets
    await page.waitForTimeout(1000);
    
    // Take screenshot of above-the-fold
    await page.screenshot({ path: absoluteScreenshotPath });
    console.log(`[Scraper] Screenshot captured at ${absoluteScreenshotPath}`);

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
      
      // Hero section: look for typical hero classes/ids or fallback to first H1 parent
      const heroEl = document.querySelector('header, .hero, [class*="hero"], [id*="hero"]');
      const heroText = heroEl?.textContent?.trim() || '';

      // CTAs
      const ctas = Array.from(document.querySelectorAll('a[class*="cta"], a[class*="btn"], button[class*="cta"], button[class*="btn"], a[href*="signup"], a[href*="register"], a[href*="get-started"]'))
        .map(el => ({
          text: el.textContent?.trim() || '',
          href: el.getAttribute('href') || ''
        }))
        .filter(c => c.text.length > 0);

      // Buttons text
      const buttons = getTexts('button, input[type="submit"]');

      // Navigation
      const navigation = getTexts('nav a, header a:not([class*="btn"]):not([class*="cta"])').slice(0, 10);

      // Footer
      const footerEl = document.querySelector('footer, .footer, [class*="footer"]');
      const footer = footerEl?.textContent?.trim() || '';

      // Testimonials
      const testimonials = Array.from(document.querySelectorAll('[class*="testimonial"], [class*="review"], blockquote'))
        .map(el => el.textContent?.trim() || '')
        .filter(t => t.length > 10)
        .slice(0, 5);

      // FAQs
      const faqs: { question: string; answer: string }[] = [];
      const faqContainer = document.querySelector('[class*="faq"], [id*="faq"]');
      if (faqContainer) {
        // Try to pair h3/h4/bold items with adjacent text
        const items = Array.from(faqContainer.querySelectorAll('h3, h4, [class*="question"], [class*="trigger"]'));
        items.forEach(item => {
          const question = item.textContent?.trim() || '';
          const next = item.nextElementSibling;
          const answer = next?.textContent?.trim() || '';
          if (question && answer) {
            faqs.push({ question, answer });
          }
        });
      }

      // Pricing
      const pricing = Array.from(document.querySelectorAll('[class*="price"], [class*="pricing"], .plan'))
        .map(el => el.textContent?.trim() || '')
        .filter(t => t.length > 5)
        .slice(0, 5);

      // Images
      const images = Array.from(document.querySelectorAll('img'))
        .map(img => ({
          src: img.getAttribute('src') || '',
          alt: img.getAttribute('alt') || ''
        }))
        .filter(img => img.src && img.src.startsWith('http'))
        .slice(0, 10);

      // Trust badges
      const trustBadges = Array.from(document.querySelectorAll('[class*="trust"], [class*="badge"], [class*="partner"], [class*="logo-cloud"]'))
        .map(el => el.textContent?.trim() || '')
        .filter(t => t.length > 0 && t.length < 50)
        .slice(0, 5);

      // Above the fold (first 800px of text content)
      const aboveFoldContent = document.body.innerText?.slice(0, 2000) || '';

      // Guarantees, Social proof, Risk reversal markers
      const bodyText = document.body.innerText || '';
      
      const guarantees: string[] = [];
      if (/guarantee|money-back|risk-free/i.test(bodyText)) {
        // Find sentences with guarantee
        const sentences = bodyText.split(/[.!?\n]/);
        sentences.forEach(s => {
          if (/guarantee|money-back|risk-free/i.test(s) && s.trim().length > 10) {
            guarantees.push(s.trim());
          }
        });
      }

      const riskReversal: string[] = [];
      if (/cancel anytime|free trial|no credit card required/i.test(bodyText)) {
        const sentences = bodyText.split(/[.!?\n]/);
        sentences.forEach(s => {
          if (/cancel anytime|free trial|no credit card required/i.test(s) && s.trim().length > 10) {
            riskReversal.push(s.trim());
          }
        });
      }

      const socialProof: string[] = [];
      if (/trusted by|join over|used by|customers/i.test(bodyText)) {
        const sentences = bodyText.split(/[.!?\n]/);
        sentences.forEach(s => {
          if (/trusted by|join over|used by/i.test(s) && s.trim().length > 10) {
            socialProof.push(s.trim());
          }
        });
      }

      return {
        title,
        metaDescription,
        h1s,
        h2s,
        heroText,
        ctas,
        testimonials,
        faqs,
        pricing,
        images,
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
  } catch (playwrightError) {
    console.error('[Scraper] Playwright scrape failed. Error Details:', playwrightError);
    console.log('[Scraper] Falling back to Cheerio scrape...');

    try {
      // Cheerio Fallback
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
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

      // Testimonials, FAQs, pricing basic extract from text search
      const bodyText = $('body').text();
      const testimonials: string[] = [];
      $('.testimonial, .review, blockquote').each((_, el) => {
        testimonials.push($(el).text().trim());
      });

      // Build fallback data
      return {
        title,
        metaDescription,
        h1s: h1s.filter(Boolean),
        h2s: h2s.filter(Boolean),
        heroText,
        ctas: ctas.filter(c => c.text),
        testimonials: testimonials.filter(Boolean).slice(0, 5),
        faqs: [],
        pricing: [],
        images: [],
        buttons: buttons.filter(Boolean).slice(0, 10),
        navigation: navigation.filter(Boolean),
        footer,
        trustBadges: [],
        aboveFoldContent: bodyText.slice(0, 2000),
        socialProof: [],
        guarantees: [],
        riskReversal: [],
        screenshotPath: undefined, // No screenshot in Cheerio fallback
        error: `Playwright error: ${playwrightError instanceof Error ? playwrightError.message : String(playwrightError)}`
      };
    } catch (cheerioError) {
      console.error('[Scraper] Cheerio fallback failed too:', cheerioError);
      throw new Error(`Failed to scrape page: Both Playwright and Cheerio fetch failed.`);
    }
  }
}
