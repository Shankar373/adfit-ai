import { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const list = await storage.getAnalyses();
    const stats = await storage.getStats();
    const isDemoMode = !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY;

    return new Response(JSON.stringify({ analyses: list, stats, isDemoMode }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('[API History] GET error:', err);
    return new Response(JSON.stringify({ error: err.message || err }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      // Try parsing body
      try {
        const body = await req.json();
        if (body.id) {
          await storage.deleteAnalysis(body.id);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch {}
      return new Response(JSON.stringify({ error: 'Missing ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await storage.deleteAnalysis(id);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('[API History] DELETE error:', err);
    return new Response(JSON.stringify({ error: err.message || err }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id } = body;

    if (action === 'duplicate') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing ID to duplicate' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const newId = crypto.randomUUID();
      const duplicate = await storage.duplicateAnalysis(id, newId);
      if (!duplicate) {
        return new Response(JSON.stringify({ error: 'Source report not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true, duplicate }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('[API History] POST error:', err);
    return new Response(JSON.stringify({ error: err.message || err }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
