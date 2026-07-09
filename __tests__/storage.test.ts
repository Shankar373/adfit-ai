import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { storage, LocalAnalysis } from '../lib/storage';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'db.json');

describe('Hybrid Storage Engine Tests', () => {
  // Save original database file content if it exists
  let originalDbContent: string | null = null;

  beforeEach(() => {
    if (fs.existsSync(dbPath)) {
      originalDbContent = fs.readFileSync(dbPath, 'utf-8');
    }
    // Set up a clean empty local test db
    fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
  });

  afterEach(() => {
    // Restore original database state
    if (originalDbContent !== null) {
      fs.writeFileSync(dbPath, originalDbContent);
    } else if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should save and retrieve analyses successfully', async () => {
    const mockAnalysis: LocalAnalysis = {
      id: 'test-id-123',
      landingPageUrl: 'https://example.com/target',
      adCopy: 'Best coding product ever!',
      createdAt: new Date().toISOString(),
      report: {
        score: 85,
        confidence: 'High',
        summary: 'Aligns closely.',
        details: {
          headline: 90,
          offer: 80,
          cta: 85,
          trust: 70,
          socialProof: 75,
          objectionHandling: 60,
          aboveFold: 90,
          pricing: 80
        },
        problems: [],
        copywriting: {
          headline: 'Awesome Code Tool',
          subheadline: 'Subheading',
          cta: 'Sign Up',
          hero: 'Hero Area Text',
          benefits: 'Benefits list',
          faq: 'FAQs',
          testimonials: 'Reviews',
          guarantee: 'Guarantee Copy',
          pricingCopy: 'Pricing Copy'
        }
      },
      experiments: [],
      chats: []
    };

    await storage.saveAnalysis(mockAnalysis);
    
    const retrieved = await storage.getAnalysis('test-id-123');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.landingPageUrl).toBe('https://example.com/target');
    expect(retrieved?.report?.score).toBe(85);
  });

  it('should calculate aggregated stats correctly', async () => {
    const list = await storage.getAnalyses();
    expect(list.length).toBe(0);

    const reportA: LocalAnalysis = {
      id: 'id-a',
      landingPageUrl: 'https://page-a.com',
      createdAt: new Date().toISOString(),
      report: {
        score: 90,
        confidence: 'High',
        summary: 'Excellent.',
        details: { headline: 90, offer: 90, cta: 90, trust: 90, socialProof: 90, objectionHandling: 90, aboveFold: 90, pricing: 90 },
        problems: [{ problem: 'Small CTA issue', evidence: '', explanation: '', businessImpact: '', suggestedFix: '', confidence: 'High', priority: 'Low', impact: 3, effort: 1, riceScore: 30 }],
        copywriting: {} as any
      },
      experiments: [],
      chats: []
    };

    const reportB: LocalAnalysis = {
      id: 'id-b',
      landingPageUrl: 'https://page-b.com',
      createdAt: new Date().toISOString(),
      report: {
        score: 60,
        confidence: 'Medium',
        summary: 'Moderate discrepancies.',
        details: { headline: 60, offer: 60, cta: 60, trust: 60, socialProof: 60, objectionHandling: 60, aboveFold: 60, pricing: 60 },
        problems: [{ problem: 'Headline mismatch', evidence: '', explanation: '', businessImpact: '', suggestedFix: '', confidence: 'High', priority: 'High', impact: 8, effort: 2, riceScore: 40 }],
        copywriting: {} as any
      },
      experiments: [],
      chats: []
    };

    await storage.saveAnalysis(reportA);
    await storage.saveAnalysis(reportB);

    const stats = await storage.getStats();
    expect(stats.totalAnalyses).toBe(2);
    expect(stats.averageScore).toBe(75); // (90 + 60) / 2 = 75
    expect(stats.commonIssuesCount['Headline mismatch']).toBe(1);
  });

  it('should duplicate analyses cleanly', async () => {
    const item: LocalAnalysis = {
      id: 'id-source',
      landingPageUrl: 'https://source-url.com',
      createdAt: new Date().toISOString(),
      experiments: [],
      chats: []
    };

    await storage.saveAnalysis(item);
    
    const duplicate = await storage.duplicateAnalysis('id-source', 'id-duplicate');
    expect(duplicate).not.toBeNull();
    expect(duplicate?.id).toBe('id-duplicate');
    expect(duplicate?.landingPageUrl).toBe('https://source-url.com');
  });

  it('should delete analyses correctly', async () => {
    const item: LocalAnalysis = {
      id: 'id-delete-me',
      landingPageUrl: 'https://delete-me.com',
      createdAt: new Date().toISOString(),
      experiments: [],
      chats: []
    };

    await storage.saveAnalysis(item);
    let check = await storage.getAnalysis('id-delete-me');
    expect(check).not.toBeNull();

    await storage.deleteAnalysis('id-delete-me');
    check = await storage.getAnalysis('id-delete-me');
    expect(check).toBeNull();
  });
});
