import { NextRequest } from 'next/server';
import { scrapeUrl } from '@/services/scraper';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { landingPageUrl, competitorUrl } = await req.json();

    if (!landingPageUrl || !competitorUrl) {
      return new Response(JSON.stringify({ error: 'Missing URLs' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const uuid = crypto.randomUUID();
    
    // Scrape both pages
    let landingScraped;
    let competitorScraped;

    try {
      landingScraped = await scrapeUrl(landingPageUrl, `${uuid}-main`);
      competitorScraped = await scrapeUrl(competitorUrl, `${uuid}-comp`);
    } catch (scrapeErr: any) {
      return new Response(JSON.stringify({ error: `Scraping failed: ${scrapeErr.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const isMock = !openaiApiKey && !anthropicApiKey;

    if (isMock) {
      // Mock comparison
      const mockComparison = {
        headline: `Competitor uses a Benefit-Led H1: "${competitorScraped.h1s[0] || 'Double Your Leads'}", while your page has: "${landingScraped.h1s[0] || 'Welcome to Our Product'}".`,
        offer: 'Competitor highlights a free tier; your landing page offers no trial or free level.',
        pricing: 'Competitor starts at $29/mo; yours is unlisted (contact sales).',
        trust: 'Competitor displays G2 badges; your page has no social proof.',
        cta: 'Competitor has clear orange CTA buttons; yours are dark gray and low-contrast.',
        positioning: 'Competitor positions as an accessible self-serve tool; you position as B2B enterprise.',
        strengths: 'Clear pricing tier, trust badges, and shorter copy.',
        weaknesses: 'Competitor page has low readability on small screens.',
        recommendations: 'Add social proof logos above the fold and offer a 7-day trial tier.'
      };

      return new Response(JSON.stringify({ comparison: mockComparison }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const prompt = `
Compare these two scraped landing pages and generate a structured JSON object representing the comparative conversion audit.

YOUR PAGE:
H1: ${JSON.stringify(landingScraped.h1s)}
Hero Text: ${landingScraped.heroText}
CTAs: ${JSON.stringify(landingScraped.ctas)}
Pricing: ${JSON.stringify(landingScraped.pricing)}
Trust Badges: ${JSON.stringify(landingScraped.trustBadges)}

COMPETITOR PAGE:
H1: ${JSON.stringify(competitorScraped.h1s)}
Hero Text: ${competitorScraped.heroText}
CTAs: ${JSON.stringify(competitorScraped.ctas)}
Pricing: ${JSON.stringify(competitorScraped.pricing)}
Trust Badges: ${JSON.stringify(competitorScraped.trustBadges)}

Output ONLY a JSON block adhering to this structure:
{
  "headline": "headline comparison text",
  "offer": "offer comparison text",
  "pricing": "pricing comparison text",
  "trust": "trust comparison text",
  "cta": "cta comparison text",
  "positioning": "positioning comparison text",
  "strengths": "competitor strengths",
  "weaknesses": "competitor weaknesses",
  "recommendations": "actionable recommendations to beat them"
}
    `;

    let jsonResponse = '';

    if (openaiApiKey) {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      });
      jsonResponse = response.choices[0].message.content || '{}';
    } else if (anthropicApiKey) {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      });
      jsonResponse = response.content[0].type === 'text' ? response.content[0].text : '{}';
    }

    const comparison = JSON.parse(jsonResponse);
    return new Response(JSON.stringify({ comparison }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[API Compare] Error:', err);
    return new Response(JSON.stringify({ error: err.message || err }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
