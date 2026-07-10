import { NextRequest } from 'next/server';
import { z } from 'zod';
import { scrapeUrl } from '@/services/scraper';
import { analyzeFit, AnalysisReport } from '@/services/analyzer';
import { storage, LocalAnalysis } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const analyzeSchema = z.object({
  adCopy: z.string().optional(),
  screenshotUrl: z.string().optional(),
  landingPageUrl: z.string().url('Invalid landing page URL'),
  competitorUrl: z.string().url('Invalid competitor URL').optional().or(z.literal('')),
  model: z.string().optional()
});

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Helper to send SSE messages
  const sendEvent = (type: string, data: any) => {
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    writer.write(encoder.encode(payload));
  };

  // Run the analysis asynchronously to stream events
  (async () => {
    try {
      const body = await req.json();
      const validation = analyzeSchema.safeParse(body);
      
      if (!validation.success) {
        sendEvent('error', { message: 'Validation failed', errors: validation.error.format() });
        writer.close();
        return;
      }

      const input = validation.data;
      const analysisId = crypto.randomUUID();

      // 1. Scraping Landing Page
      sendEvent('progress', { status: 'Scraping landing page with Playwright...' });
      console.log(`[API Analyze] Scraping landing page: ${input.landingPageUrl}`);
      let scrapedLanding;
      try {
        scrapedLanding = await scrapeUrl(input.landingPageUrl, analysisId);
      } catch (scrapeError: any) {
        console.error('[API Analyze] Scraper failed:', scrapeError);
        sendEvent('error', { message: `Scraping failed: ${scrapeError.message || scrapeError}` });
        writer.close();
        return;
      }

      // 2. Scraping Competitor (if specified)
      let scrapedCompetitor = null;
      if (input.competitorUrl) {
        sendEvent('progress', { status: 'Scraping competitor landing page...' });
        console.log(`[API Analyze] Scraping competitor: ${input.competitorUrl}`);
        try {
          scrapedCompetitor = await scrapeUrl(input.competitorUrl, `${analysisId}-competitor`);
        } catch (compError) {
          console.warn('[API Analyze] Competitor scraping failed, proceeding without competitor info', compError);
        }
      }

      // 3. Run fit comparison
      let finalReport: AnalysisReport | null = null;
      try {
        finalReport = await analyzeFit(
          {
            adCopy: input.adCopy,
            screenshotUrl: input.screenshotUrl,
            landingPageUrl: input.landingPageUrl,
            competitorUrl: input.competitorUrl || undefined,
            model: input.model
          },
          scrapedLanding,
          scrapedCompetitor,
          (status, markdownChunk) => {
            sendEvent('progress', { status, chunk: markdownChunk });
          }
        );
      } catch (analysisError: any) {
        console.error('[API Analyze] Analysis core failed:', analysisError);
        sendEvent('error', { message: `Analysis failed: ${analysisError.message || analysisError}` });
        writer.close();
        return;
      }

      if (!finalReport) {
        sendEvent('error', { message: 'Failed to generate fit report.' });
        writer.close();
        return;
      }

      // 4. Save to Storage
      sendEvent('progress', { status: 'Saving results to history...' });
      const record: LocalAnalysis = {
        id: analysisId,
        adCopy: input.adCopy,
        screenshotUrl: input.screenshotUrl || scrapedLanding.screenshotPath, // Fallback to Playwright screenshot of landing page if uploaded ad screenshot doesn't exist
        landingPageUrl: input.landingPageUrl,
        competitorUrl: input.competitorUrl || undefined,
        createdAt: new Date().toISOString(),
        report: {
          score: finalReport.score,
          confidence: finalReport.confidence,
          summary: finalReport.summary,
          details: finalReport.details,
          problems: finalReport.problems,
          copywriting: finalReport.copywriting,
        },
        competitor: finalReport.competitor,
        experiments: finalReport.experiments,
        chats: []
      };

      await storage.saveAnalysis(record);

      // 5. Complete
      sendEvent('complete', { id: analysisId, report: record });
      writer.close();
    } catch (err: any) {
      console.error('[API Analyze] Unexpected error:', err);
      sendEvent('error', { message: `Internal server error: ${err.message || err}` });
      writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
