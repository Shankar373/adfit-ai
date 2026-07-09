import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ScrapedData } from './scraper';

// Setup API clients
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

const getAnthropicClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
};

export interface AnalysisInput {
  adCopy?: string;
  screenshotUrl?: string; // Base64 or Supabase Storage URL
  landingPageUrl: string;
  competitorUrl?: string;
  provider?: 'openai' | 'anthropic';
  model?: string;
}

// Structured analysis output shape
export interface AnalysisReport {
  score: number;
  confidence: string;
  summary: string; // Executive summary (Markdown)
  details: {
    headline: number;
    offer: number;
    cta: number;
    trust: number;
    socialProof: number;
    objectionHandling: number;
    aboveFold: number;
    pricing: number;
  };
  problems: Array<{
    problem: string;
    evidence: string;
    explanation: string;
    businessImpact: string;
    suggestedFix: string;
    confidence: string; // High, Medium, Low
    priority: string; // High, Medium, Low
    impact: number; // 1-10
    effort: number; // 1-10
    riceScore: number;
    region?: { x: number; y: number; width: number; height: number; label: string };
  }>;
  copywriting: {
    headline: string;
    subheadline: string;
    cta: string;
    hero: string;
    benefits: string;
    faq: string;
    testimonials: string;
    guarantee: string;
    pricingCopy: string;
  };
  competitor?: {
    headline: string;
    offer: string;
    pricing: string;
    trust: string;
    cta: string;
    positioning: string;
    strengths: string;
    weaknesses: string;
    recommendations: string;
  };
  experiments: Array<{
    hypothesis: string;
    variantA: string;
    variantB: string;
    metric: string;
    traffic: string;
    duration: string;
  }>;
}

export async function analyzeFit(
  input: AnalysisInput,
  scrapedLanding: ScrapedData,
  scrapedCompetitor: ScrapedData | null,
  onProgress: (status: string, markdownChunk?: string) => void
): Promise<AnalysisReport> {
  const openai = getOpenAIClient();
  const anthropic = getAnthropicClient();

  let selectedProvider: 'openai' | 'anthropic' | 'mock' = 'mock';

  if (openai && anthropic) {
    selectedProvider = input.provider || 'openai';
  } else if (openai) {
    selectedProvider = 'openai';
  } else if (anthropic) {
    selectedProvider = 'anthropic';
  }

  if (selectedProvider === 'mock') {
    console.log('[Analyzer] Running in MOCK Mode...');
    return runMockAnalysis(input, scrapedLanding, scrapedCompetitor, onProgress);
  }

  // Pre-process screenshot if Vision is available
  let screenshotAnalysis = '';
  if (input.screenshotUrl) {
    onProgress('Parsing screenshot visuals with AI Vision...');
    try {
      screenshotAnalysis = await analyzeScreenshotVision(input.screenshotUrl, selectedProvider);
      console.log('[Analyzer] Vision OCR Output:', screenshotAnalysis);
    } catch (visionError) {
      console.error('[Analyzer] Vision OCR failed:', visionError);
      screenshotAnalysis = 'Vision OCR failed: Check if image format is supported.';
    }
  }

  const contextPrompt = `
You are a world-class Conversion Rate Optimization (CRO) Expert. Your task is to analyze the "Fit" (alignment) between a paid Advertisement and the target Landing Page.

ADVERTISEMENT DETAILS:
${input.adCopy ? `Ad Copy: "${input.adCopy}"` : ''}
${screenshotAnalysis ? `Screenshot Visual & Text OCR Analysis:\n${screenshotAnalysis}` : ''}

LANDING PAGE SCRAPED DATA:
URL: ${input.landingPageUrl}
Title: ${scrapedLanding.title}
Meta Description: ${scrapedLanding.metaDescription}
Hero Section: ${scrapedLanding.heroText}
H1 headers: ${JSON.stringify(scrapedLanding.h1s)}
H2 headers: ${JSON.stringify(scrapedLanding.h2s)}
CTAs: ${JSON.stringify(scrapedLanding.ctas)}
Testimonials: ${JSON.stringify(scrapedLanding.testimonials)}
FAQ: ${JSON.stringify(scrapedLanding.faqs)}
Pricing Details: ${JSON.stringify(scrapedLanding.pricing)}
Trust Badges: ${JSON.stringify(scrapedLanding.trustBadges)}
Above fold text snippet: "${scrapedLanding.aboveFoldContent.slice(0, 1500)}"
Social proof: ${JSON.stringify(scrapedLanding.socialProof)}
Guarantees: ${JSON.stringify(scrapedLanding.guarantees)}
Risk Reversal: ${JSON.stringify(scrapedLanding.riskReversal)}

${scrapedCompetitor ? `COMPETITOR LANDING PAGE SCRAPED DATA (URL: ${input.competitorUrl}):
Title: ${scrapedCompetitor.title}
Meta Description: ${scrapedCompetitor.metaDescription}
Hero Section: ${scrapedCompetitor.heroText}
H1s: ${JSON.stringify(scrapedCompetitor.h1s)}
CTAs: ${JSON.stringify(scrapedCompetitor.ctas)}
Pricing: ${JSON.stringify(scrapedCompetitor.pricing)}
` : ''}
`;

  // Step 1: Stream the executive summary
  onProgress('Analyzing fit and generating Executive Summary...');
  const summaryPrompt = `
Based on the ad and landing page details, generate a marketing executive summary.
Identify mismatches in:
- Message mismatch (Headline & promise match)
- Offer mismatch (Does landing page offer match the ad promise?)
- Audience Persona mismatch
- Pricing mismatch

Guidelines:
- Write in a highly professional, direct, client-ready tone.
- Output ONLY the executive summary in Markdown.
- Keep it to 300-400 words.
- Provide a summary score estimate.
  `;

  let executiveSummary = '';
  if (selectedProvider === 'openai' && openai) {
    const stream = await openai.chat.completions.create({
      model: input.model || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an elite CRO auditor. Output Markdown only.' },
        { role: 'user', content: contextPrompt + '\n' + summaryPrompt }
      ],
      stream: true
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      executiveSummary += text;
      onProgress('Generating Executive Summary...', text);
    }
  } else if (selectedProvider === 'anthropic' && anthropic) {
    const stream = await anthropic.messages.create({
      model: input.model || 'claude-3-5-sonnet-20240620',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: contextPrompt + '\n' + summaryPrompt }
      ],
      stream: true
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        executiveSummary += text;
        onProgress('Generating Executive Summary...', text);
      }
    }
  }

  // Step 2: Generate structured audit details (scores, problems, copywriting, experiments)
  onProgress('Structuring conversion recommendations and experiments...');
  const structuredPrompt = `
Based on the ad-to-landing page context provided earlier, output a strictly structured JSON block.
The JSON must match the following TypeScript interface exactly:

interface AnalysisReport {
  score: number; // Overall fit score 0-100
  confidence: "High" | "Medium" | "Low";
  details: {
    headline: number; // 0-100 score
    offer: number; // 0-100 score
    cta: number; // 0-100 score
    trust: number; // 0-100 score
    socialProof: number; // 0-100 score
    objectionHandling: number; // 0-100 score
    aboveFold: number; // 0-100 score
    pricing: number; // 0-100 score
  };
  problems: Array<{
    problem: string;
    evidence: string;
    explanation: string;
    businessImpact: string;
    suggestedFix: string;
    confidence: "High" | "Medium" | "Low";
    priority: "High" | "Medium" | "Low";
    impact: number; // 1-10
    effort: number; // 1-10
    riceScore: number; // (Impact * ConfidenceWeight * 10) / Effort. ConfidenceWeights: High=1.0, Medium=0.8, Low=0.5
    region?: { x: number; y: number; width: number; height: number; label: string }; // Optional mock percentage coordinates (e.g. x:10, y:20, width:40, height:10) pointing to landing page layout mismatch area.
  }>;
  copywriting: {
    headline: string;
    subheadline: string;
    cta: string;
    hero: string;
    benefits: string;
    faq: string;
    testimonials: string;
    guarantee: string;
    pricingCopy: string;
  };
  competitor?: {
    headline: string;
    offer: string;
    pricing: string;
    trust: string;
    cta: string;
    positioning: string;
    strengths: string;
    weaknesses: string;
    recommendations: string;
  };
  experiments: Array<{
    hypothesis: string;
    variantA: string;
    variantB: string;
    metric: string;
    traffic: string;
    duration: string;
  }>;
}

Guidelines:
- Sort problems by RICE score descending.
- Ensure all values are filled in completely.
- Output ONLY the JSON block. Do not wrap in markdown \`\`\`json blocks.
  `;

  let jsonText = '';
  if (selectedProvider === 'openai' && openai) {
    const response = await openai.chat.completions.create({
      model: input.model || 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an elite CRO auditor. Output JSON only.' },
        { role: 'user', content: contextPrompt + '\n' + structuredPrompt }
      ]
    });
    jsonText = response.choices[0].message.content || '{}';
  } else if (selectedProvider === 'anthropic' && anthropic) {
    const response = await anthropic.messages.create({
      model: input.model || 'claude-3-5-sonnet-20240620',
      max_tokens: 3000,
      messages: [
        { role: 'user', content: contextPrompt + '\n' + structuredPrompt }
      ]
    });
    // Extract json from response text
    jsonText = response.content[0].type === 'text' ? response.content[0].text : '{}';
  }

  onProgress('Finalizing report compilation...');
  
  try {
    const reportData = JSON.parse(jsonText);
    reportData.summary = executiveSummary;
    return reportData as AnalysisReport;
  } catch (e) {
    console.error('[Analyzer] Failed to parse JSON report. Raw JSON text:', jsonText);
    throw new Error('LLM did not return valid structured analysis JSON.');
  }
}

// Multimodal Screenshot VisionOCR
async function analyzeScreenshotVision(imageUrl: string, provider: 'openai' | 'anthropic'): Promise<string> {
  const openai = getOpenAIClient();
  const anthropic = getAnthropicClient();

  // If url is local base64, clean it up
  let base64Data = '';
  let mediaType = 'image/png';
  if (imageUrl.startsWith('data:image')) {
    const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mediaType = matches[1];
      base64Data = matches[2];
    }
  }

  if (provider === 'openai' && openai) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all ad copy, headlines, offers, CTAs, benefits, and analyze color palette, urgency, visual hierarchy, and emotional tone of this ad screenshot.' },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl.startsWith('data:') ? imageUrl : imageUrl
              }
            }
          ]
        }
      ]
    });
    return response.choices[0].message.content || '';
  } else if (provider === 'anthropic' && anthropic && base64Data) {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as any,
                data: base64Data
              }
            },
            {
              type: 'text',
              text: 'Extract all ad copy, headlines, offers, CTAs, benefits, and analyze color palette, urgency, visual hierarchy, and emotional tone of this ad screenshot.'
            }
          ]
        }
      ]
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  return 'Local mode: Vision analysis skipped.';
}

// Mock Analysis Generator for local development guest mode
async function runMockAnalysis(
  input: AnalysisInput,
  scrapedLanding: ScrapedData,
  scrapedCompetitor: ScrapedData | null,
  onProgress: (status: string, markdownChunk?: string) => void
): Promise<AnalysisReport> {
  const steps = [
    { status: 'Reading landing page layout...', duration: 1500 },
    { status: 'Running match heuristic checks...', duration: 1500 },
    { status: 'Generating Executive Summary...', duration: 2500 }
  ];

  for (const step of steps) {
    onProgress(step.status);
    await new Promise(resolve => setTimeout(resolve, step.duration));
  }

  // Stream in the summary
  const summaryChunks = [
    "# Executive Summary: AdFit Audit for " + scrapedLanding.title + "\n\n",
    "## Key Findings\n",
    "- **Headline Mismatch (Critical)**: The advertisement promises instant setup and 'no-code deployment', while the landing page immediately funnels users to book a demo call and contact sales.\n",
    "- **Offer Inconsistency**: The ad mentions a '14-day free trial', but the pricing table on the landing page displays no trial option, starting directly at $49/month.\n",
    "- **Audience Shift**: The ad copy targets freelancer and independent creators, whereas the landing page messaging pivots heavily toward corporate security features and enterprise scale, alienating the primary ad traffic.\n\n",
    "## Business Impact & Strategic Next Steps\n",
    "By alignment of these key messaging pathways, we predict a **28% - 35% conversion rate lift**. Eliminating the friction between the ad's micro-promise and the landing page's macro-ask is the highest priority optimization."
  ];

  for (const chunk of summaryChunks) {
    onProgress('Generating Executive Summary...', chunk);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  onProgress('Formulating A/B experiment variants...');
  await new Promise(resolve => setTimeout(resolve, 1500));

  const score = Math.round(55 + Math.random() * 20);

  const report: AnalysisReport = {
    score,
    confidence: 'Medium',
    summary: summaryChunks.join(''),
    details: {
      headline: 45,
      offer: 60,
      cta: 50,
      trust: 75,
      socialProof: 80,
      objectionHandling: 55,
      aboveFold: 40,
      pricing: 50
    },
    problems: [
      {
        problem: 'Direct Ask Call-to-Action Mismatch',
        evidence: `The advertisement copy promises "Try for Free, Instantly", but the primary CTA above the fold is "Book an Enterprise Demo".`,
        explanation: 'Users click ads expecting immediate access. Forcing them into a high-friction sales demo funnel immediately causes a high bounce rate.',
        businessImpact: 'Sinks conversion rates by roughly 40% for self-serve traffic.',
        suggestedFix: 'Implement a split funnel: show "Start Free Trial" as the primary action and "Talk to Sales" as a secondary option.',
        confidence: 'High',
        priority: 'High',
        impact: 9,
        effort: 3,
        riceScore: 30, // (9 * 1.0 * 10) / 3 = 30
        region: { x: 55, y: 15, width: 35, height: 10, label: 'Above-the-fold CTA' }
      },
      {
        problem: 'Trial Pricing Inconsistency',
        evidence: 'Ad promises "14-day Free Trial", but landing page pricing shows no mention of a free trial and starts with a credit card capture.',
        explanation: 'Pricing conflicts break user trust immediately, leading to cart abandonment and high bounce rates.',
        businessImpact: 'Decreases cart conversion by 18%.',
        suggestedFix: 'Clearly show "14 days free, then $49/mo" next to the payment terms.',
        confidence: 'High',
        priority: 'High',
        impact: 8,
        effort: 2,
        riceScore: 40, // (8 * 1.0 * 10) / 2 = 40
        region: { x: 20, y: 65, width: 60, height: 15, label: 'Pricing Section' }
      },
      {
        problem: 'Headline Core Value Mismatch',
        evidence: `Ad headline focuses on "Automated Ad Fitting in Seconds", whereas landing page H1 says "Supercharge Your B2B Marketing Operations".`,
        explanation: 'The landing page H1 is too generic and fails to echo the specific value proposition that motivated the click.',
        businessImpact: 'Increases bounce rate by 22% in the first 3 seconds.',
        suggestedFix: 'Change H1 to "The Automated Fit Analyzer for Paid Ads".',
        confidence: 'Medium',
        priority: 'Medium',
        impact: 7,
        effort: 2,
        riceScore: 28, // (7 * 0.8 * 10) / 2 = 28
        region: { x: 15, y: 5, width: 70, height: 12, label: 'Hero H1' }
      }
    ].sort((a, b) => b.riceScore - a.riceScore),
    copywriting: {
      headline: 'Stop Guessing Ad Fit. Analyze Instantly.',
      subheadline: 'Paste your ad copy and scan your landing page to discover visual, pricing, and message mismatches in seconds.',
      cta: 'Analyze Fit Free',
      hero: 'The automated CRO audit tool that makes every paid click count. Instantly spot mismatches and fix conversion leaks.',
      benefits: '• Instant visual & message audits\n• RICE-prioritized suggestions\n• Auto A/B test generator\n• Competitor comparison dashboards',
      faq: 'Q: How does the analyzer scrape pages?\nA: We run Playwright to capture the page content and check visual details.',
      testimonials: '“AdFit AI identified a critical pricing mismatch that boosted our conversions by 32% in one week.” - Sarah K., CMO',
      guarantee: '100% money-back guarantee. If you don’t spot actionable CRO leaks, we will refund your plan.',
      pricingCopy: '$49/month for unlimited campaigns. No credit card required to start.'
    },
    experiments: [
      {
        hypothesis: 'Adding a secondary self-serve CTA above-the-fold will capture low-friction traffic that bounces on the Demo form.',
        variantA: 'Primary CTA: "Book a Demo"',
        variantB: 'Primary CTA: "Book a Demo" + Secondary CTA: "Try Free Trial"',
        metric: 'Click-Through Rate to sign up',
        traffic: '50% split to 10k users',
        duration: '14 days'
      },
      {
        hypothesis: 'Echoing the exact ad title in the H1 headline will lower instant bounce rates.',
        variantA: 'H1: "Supercharge Your Marketing Ops"',
        variantB: 'H1: "Automate Your Ad Fit Analysis in Seconds"',
        metric: 'Above-the-fold bounce rate',
        traffic: '50% split to 5k users',
        duration: '10 days'
      }
    ]
  };

  if (scrapedCompetitor) {
    report.competitor = {
      headline: `Competitor uses a highly specific value statement: "${scrapedCompetitor.h1s[0] || 'Optimized Conversions'}". Your page is currently too generic.`,
      offer: 'Competitor highlights a free-forever tier, whereas you offer no trial or free level.',
      pricing: 'Competitor pricing starts at $29/mo, giving them a slight edge on cost.',
      trust: 'Competitor showcases 5 enterprise logos; your landing page displays no trust badges or partner logos.',
      cta: 'Competitor uses high-contrast orange buttons; your buttons blend into the background.',
      positioning: 'Competitor positions as an affordable self-serve utility, while you are enterprise-focused.',
      strengths: 'Clear pricing, rich social proof, and fast page load times.',
      weaknesses: 'Lacks AI-driven custom reports, and has a complex signup flow.',
      recommendations: 'Add client logo clouds and matching CTAs immediately to capture budget-sensitive users.'
    };
  }

  onProgress('Completed');
  return report;
}
