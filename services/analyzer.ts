import Groq from 'groq-sdk';
import { ScrapedData } from './scraper';

// Setup Groq API client
const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
};

export interface AnalysisInput {
  adCopy?: string;
  screenshotUrl?: string; // Base64 image
  landingPageUrl: string;
  competitorUrl?: string;
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
    expectedConversionLift: string;
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
  const groq = getGroqClient();

  if (!groq) {
    console.log('[Analyzer] No GROQ_API_KEY found. Automatically running in DEMO Mode...');
    return runMockAnalysis(input, scrapedLanding, scrapedCompetitor, onProgress);
  }

  // 1. Vision OCR for ad screenshot if provided
  let screenshotAnalysis = '';
  if (input.screenshotUrl) {
    onProgress('Analyzing ad screenshot layout with Llama Vision...');
    try {
      screenshotAnalysis = await analyzeScreenshotVision(input.screenshotUrl);
      console.log('[Analyzer] Groq Llama Vision OCR Output success');
    } catch (visionError: any) {
      console.error('[Analyzer] Llama Vision failed:', visionError);
      screenshotAnalysis = `Vision Analysis skipped: ${visionError.message || String(visionError)}`;
    }
  }

  const contextPrompt = `
You are a world-class Conversion Rate Optimization (CRO) Expert. Your task is to analyze the "Fit" (alignment) between a paid Advertisement and the target Landing Page.

ADVERTISEMENT DETAILS:
${input.adCopy ? `Ad Copy: "${input.adCopy}"` : ''}
${screenshotAnalysis ? `Screenshot Vision Analysis:\n${screenshotAnalysis}` : ''}

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

  // Step 2: Stream the executive summary
  onProgress('Analyzing fit alignment and generating Executive Summary...');
  const summaryPrompt = `
Based on the ad and landing page details, generate a marketing executive summary.
Identify mismatches in:
- Message mismatch (Headline & promise match)
- Offer mismatch (Does landing page offer match the ad promise?)
- Audience Persona mismatch
- Pricing mismatch

Guidelines:
- Write in a highly professional, direct, growth agency audit tone.
- Output ONLY the executive summary in Markdown.
- Keep it to 300-400 words.
- Provide a summary score estimate.
  `;

  let executiveSummary = '';
  try {
    const stream = await groq.chat.completions.create({
      model: input.model || 'llama-3.3-70b-versatile',
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
  } catch (err: any) {
    console.error('[Analyzer] Executive Summary generation failed:', err);
    throw new Error(`Groq API failure: ${err.message || String(err)}. Check your GROQ_API_KEY rate limits.`);
  }

  // Step 3: Generate structured JSON report
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
    expectedConversionLift: string; // expected lift, e.g. "+15% lift"
    confidence: "High" | "Medium" | "Low";
    priority: "High" | "Medium" | "Low";
    impact: number; // 1-10
    effort: number; // 1-10
    riceScore: number; // (Impact * ConfidenceWeight * 10) / Effort
    region?: { x: number; y: number; width: number; height: number; label: string }; // Optional percentage coordinates (e.g. x:20, y:30, width:60, height:10) pointing to landing page layout mismatch area.
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
  try {
    const response = await groq.chat.completions.create({
      model: input.model || 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an elite CRO auditor. Output JSON only.' },
        { role: 'user', content: contextPrompt + '\n' + structuredPrompt }
      ]
    });
    jsonText = response.choices[0]?.message?.content || '{}';
  } catch (err: any) {
    console.error('[Analyzer] Structured JSON generation failed:', err);
    throw new Error(`Groq JSON format failure: ${err.message || String(err)}`);
  }

  onProgress('Finalizing report compilation...');
  
  try {
    const reportData = JSON.parse(jsonText);
    reportData.summary = executiveSummary;
    return reportData as AnalysisReport;
  } catch (e) {
    console.error('[Analyzer] Failed to parse JSON report. Raw text:', jsonText);
    throw new Error('Groq model did not return a valid structured JSON report structure.');
  }
}

// Llama Multimodal Screenshot VisionOCR
async function analyzeScreenshotVision(imageUrl: string): Promise<string> {
  const groq = getGroqClient();
  if (!groq) throw new Error('Groq API Key is not set.');

  let base64Data = '';
  let mediaType = 'image/png';
  if (imageUrl.startsWith('data:image')) {
    const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mediaType = matches[1];
      base64Data = matches[2];
    }
  } else {
    throw new Error('Image format must be a base64 data URI.');
  }

  const response = await groq.chat.completions.create({
    model: 'llama-3.2-11b-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this ad screenshot. Extract all copy headlines, hook offers, CTAs, colors, emotional tone, and layout details.' },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mediaType};base64,${base64Data}`
            }
          }
        ]
      }
    ]
  });

  return response.choices[0]?.message?.content || '';
}

// Mock Analysis Generator (Demo Mode) - Always safe and never throws
async function runMockAnalysis(
  input: AnalysisInput,
  scrapedLanding: ScrapedData,
  scrapedCompetitor: ScrapedData | null,
  onProgress: (status: string, markdownChunk?: string) => void
): Promise<AnalysisReport> {
  const steps = [
    { status: 'Scraping page elements...', duration: 1000 },
    { status: 'Running match checks...', duration: 1000 },
    { status: 'Compiling executive brief...', duration: 1500 }
  ];

  for (const step of steps) {
    onProgress(step.status);
    await new Promise(resolve => setTimeout(resolve, step.duration));
  }

  // Stream in the summary
  const summaryChunks = [
    "# Executive Summary: Fit Audit for " + scrapedLanding.title + " [Demo Mode]\n\n",
    "## Mismatches Found\n",
    "- **Headline Match**: The landing page headline is too generic compared to the specific ad hooks.\n",
    "- **Call-to-Action**: The ad promises frictionless start, but the landing page routes to demo calls.\n",
    "- **Pricing Transparency**: The pricing details are hidden or lack trial options promised by the ad.\n\n",
    "## Business Impact\n",
    "Fixing these alignment leaks is estimated to yield a **+25% to +35% lift in page conversion rates**."
  ];

  for (const chunk of summaryChunks) {
    onProgress('Generating Executive Summary...', chunk);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  onProgress('Assembling RICE recommendations...');
  await new Promise(resolve => setTimeout(resolve, 800));

  const score = Math.round(58 + Math.random() * 20);

  const report: AnalysisReport = {
    score,
    confidence: 'High',
    summary: summaryChunks.join(''),
    details: {
      headline: 55,
      offer: 65,
      cta: 50,
      trust: 70,
      socialProof: 75,
      objectionHandling: 50,
      aboveFold: 45,
      pricing: 60
    },
    problems: [
      {
        problem: 'Direct CTA Funnel Mismatch',
        evidence: 'Ad copy promises "Get started in 10 seconds", but landing page CTA is "Talk to Enterprise Sales".',
        explanation: 'Users clicking direct ads expect low friction. High friction funnels immediately trigger bounces.',
        businessImpact: 'Wastes roughly 30% of paid ad budget.',
        suggestedFix: 'Replace CTA with "Start Free Trial" and link directly to signup.',
        expectedConversionLift: '+35% conversion lift',
        confidence: 'High',
        priority: 'High',
        impact: 9,
        effort: 2,
        riceScore: 45,
        region: { x: 55, y: 15, width: 35, height: 10, label: 'Hero CTA Button' }
      },
      {
        problem: 'Headline Promise Disalignment',
        evidence: 'Ad states "AI Fit Analyzer in 1 Click", but H1 on page is "Scale Your Operations Easily".',
        explanation: 'Page fails to immediately confirm the value proposition that motivated the click.',
        businessImpact: 'Causes instant bounce in the first 3 seconds.',
        suggestedFix: 'Rephrase H1 to: "The 1-Click AI Fit Analyzer".',
        expectedConversionLift: '+15% retention lift',
        confidence: 'High',
        priority: 'High',
        impact: 8,
        effort: 1,
        riceScore: 80,
        region: { x: 15, y: 5, width: 70, height: 12, label: 'Hero H1 Title' }
      }
    ],
    copywriting: {
      headline: 'Automate Ad Fit Analysis Instantly.',
      subheadline: 'Paste ad materials and scan landing pages to identify conversion leaks in seconds.',
      cta: 'Audit Fit Free',
      hero: 'Convert more paid clicks. Instantly identify visual and pricing mismatches.',
      benefits: '• Instant visual audits\n• RICE recommendations\n• A/B test templates',
      faq: 'Q: How does it work?\nA: We run Playwright or Cheerio to scrape and check layout parameters.',
      testimonials: '“Boosted our page conversions by 28% in 3 days.” - Growth Lead',
      guarantee: '100% satisfaction guarantee or support audit checks.',
      pricingCopy: '$29/mo for unlimited analysis scans.'
    },
    experiments: [
      {
        hypothesis: 'Changing H1 to mirror the ad copy headline will lower bounce rates.',
        variantA: 'H1: "Scale Operations Easily"',
        variantB: 'H1: "Automated Fit Analyzer in 1 Click"',
        metric: 'Above-fold bounce rate',
        traffic: '50% split (5k users)',
        duration: '7 days'
      }
    ]
  };

  if (scrapedCompetitor) {
    report.competitor = {
      headline: `Competitor headline: "${scrapedCompetitor.h1s[0] || 'Optimized Campaigns'}". Your H1 is less direct.`,
      offer: 'Competitor highlights a free tier; you start at paid tiers.',
      pricing: 'Competitor pricing is more visible.',
      trust: 'Competitor showcases trust logos; your page has none.',
      cta: 'Competitor buttons are higher contrast.',
      positioning: 'Self-serve CRO utility vs your B2B model.',
      strengths: 'Clear price grids and logos.',
      weaknesses: 'Cluttered mobile rendering.',
      recommendations: 'Add client logo clouds and matching CTAs.'
    };
  }

  onProgress('Completed');
  return report;
}
