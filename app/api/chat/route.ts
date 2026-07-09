import { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  try {
    const { analysisId, chatId, message, provider = 'openai', model } = await req.json();

    if (!analysisId || !chatId || !message) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Load analysis context
    const analysis = await storage.getAnalysis(analysisId);
    if (!analysis || !analysis.report) {
      return new Response(JSON.stringify({ error: 'Report not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Load existing chat history
    const existingChats = analysis.chats?.find(c => c.id === chatId);
    const messagesHistory = existingChats?.messages || [];

    // Save User message immediately
    await storage.addChatMessage(analysisId, chatId, 'user', message);

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    
    let selectedProvider: 'openai' | 'anthropic' | 'mock' = 'mock';
    if (openaiApiKey && anthropicApiKey) {
      selectedProvider = provider;
    } else if (openaiApiKey) {
      selectedProvider = 'openai';
    } else if (anthropicApiKey) {
      selectedProvider = 'anthropic';
    }

    if (selectedProvider === 'mock') {
      // Mock streaming response for guest mode
      (async () => {
        const mockResponses = [
          `Regarding your landing page at **${analysis.landingPageUrl}**, the first issue to address is definitely the CTA alignment.\n\n`,
          `Currently, your ad focuses on "free instant trial" while your page demands a sales demo call. `,
          `To improve conversions, I recommend changing the H1 to match your ad headline and introducing a secondary CTA: **"Start 14-day free trial"** directly below the main "Book a Demo" button.\n\n`,
          `This change will lower friction and capture self-serve users who would otherwise bounce. Let me know if you would like me to rewrite the hero section copy for this variation!`
        ];

        for (const chunk of mockResponses) {
          writer.write(encoder.encode(chunk));
          await new Promise(r => setTimeout(r, 400));
        }

        // Save Assistant message to history
        const fullResponse = mockResponses.join('');
        await storage.addChatMessage(analysisId, chatId, 'assistant', fullResponse);
        writer.close();
      })();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        }
      });
    }

    // Direct SDK execution with context injection
    const systemPrompt = `
You are AdFit AI, an elite Conversion Rate Optimization (CRO) copywriter and growth consultant assistant.
You are assisting a client with their Ad-to-Landing Page Fit Audit Report.

REPORT CONTEXT:
Target URL: ${analysis.landingPageUrl}
Fit Score: ${analysis.report.score}/100
Confidence: ${analysis.report.confidence}

SUMMARY FINDINGS:
${analysis.report.summary}

PRIORITIZED PROBLEMS:
${analysis.report.problems.map((p, i) => `${i + 1}. [RICE: ${p.riceScore}] ${p.problem}\n   - Evidence: ${p.evidence}\n   - Fix: ${p.suggestedFix}`).join('\n')}

COPY REWRITES PROVIDED:
- Headline: ${analysis.report.copywriting.headline}
- Subheadline: ${analysis.report.copywriting.subheadline}
- CTA: ${analysis.report.copywriting.cta}

Instructions:
- Use the report context to answer conversion queries.
- Keep your answers conversion-focused, actionable, and visually clear (use markdown formatting).
- Limit responses to relevant scope. Focus on headline matches, pricing, CTAs, and trust building.
`;

    const chatMessages = [
      ...messagesHistory.map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    let fullAssistantResponse = '';

    if (selectedProvider === 'openai') {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      (async () => {
        try {
          const stream = await openai.chat.completions.create({
            model: model || 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              ...chatMessages as any
            ],
            stream: true
          });

          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || '';
            fullAssistantResponse += text;
            writer.write(encoder.encode(text));
          }

          // Save assistant reply
          await storage.addChatMessage(analysisId, chatId, 'assistant', fullAssistantResponse);
          writer.close();
        } catch (streamErr: any) {
          writer.write(encoder.encode(`\n[Error during stream: ${streamErr.message}]`));
          writer.close();
        }
      })();
    } else {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      (async () => {
        try {
          const stream = await anthropic.messages.create({
            model: model || 'claude-3-5-sonnet-20240620',
            max_tokens: 1500,
            system: systemPrompt,
            messages: chatMessages.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content
            })),
            stream: true
          });

          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const text = event.delta.text;
              fullAssistantResponse += text;
              writer.write(encoder.encode(text));
            }
          }

          // Save assistant reply
          await storage.addChatMessage(analysisId, chatId, 'assistant', fullAssistantResponse);
          writer.close();
        } catch (streamErr: any) {
          writer.write(encoder.encode(`\n[Error during stream: ${streamErr.message}]`));
          writer.close();
        }
      })();
    }

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    });

  } catch (err: any) {
    console.error('[API Chat] Error in Chat API:', err);
    return new Response(JSON.stringify({ error: err.message || err }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
