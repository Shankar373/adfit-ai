import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

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

    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      // Mock rewrite for Demo Mode
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

    const groq = new Groq({ apiKey: groqApiKey });
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Text to rewrite: "${textToRewrite}"` }
      ]
    });
    const content = response.choices[0]?.message?.content || '';

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
