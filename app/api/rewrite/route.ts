import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { textToRewrite, directive, sectionType = 'Headline' } = await req.json();

    if (!textToRewrite) {
      return new Response(JSON.stringify({ error: 'Missing text to rewrite' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const isMock = !openaiApiKey && !anthropicApiKey;

    if (isMock) {
      // Mock rewrite
      const mockRewrites = [
        `✨ **Option 1 (Benefit-Focused):** Get instant conversion audits without the agency fees. Scan in 15 seconds.`,
        `🚀 **Option 2 (Direct-Response):** Stop losing money on paid ads. Spot and fix landing page mismatches automatically.`,
        `💡 **Option 3 (Social Proof):** Join 1,200+ growth marketers scanning ad alignment. Try AdFit free.`
      ];

      return new Response(JSON.stringify({ rewrites: mockRewrites.join('\n\n') }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `You are an elite CRO copywriting expert. Rewrite the provided text for the "${sectionType}" section of a landing page. Directive: "${directive}". Keep it high-converting, crisp, and direct. Output your top 3 variation suggestions in Markdown.`;

    let content = '';

    if (openaiApiKey) {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Text to rewrite: "${textToRewrite}"` }
        ]
      });
      content = response.choices[0].message.content || '';
    } else if (anthropicApiKey) {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Text to rewrite: "${textToRewrite}"` }]
      });
      content = response.content[0].type === 'text' ? response.content[0].text : '';
    }

    return new Response(JSON.stringify({ rewrites: content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[API Rewrite] Error:', err);
    return new Response(JSON.stringify({ error: err.message || err }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
