import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Instantiate PrismaClient dynamically
let prisma: PrismaClient | null = null;
const isDbConfigured = !!process.env.DATABASE_URL;

if (isDbConfigured) {
  try {
    prisma = new PrismaClient();
  } catch (err) {
    console.error('[Storage] Failed to initialize Prisma Client:', err);
  }
}

const LOCAL_DB_PATH = path.join(process.cwd(), 'db.json');

// Interface types
export interface LocalAnalysis {
  id: string;
  adCopy?: string;
  screenshotUrl?: string;
  landingPageUrl: string;
  competitorUrl?: string;
  createdAt: string;
  report?: {
    score: number;
    confidence: string;
    summary: string;
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
      confidence: string;
      priority: string;
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
  chats: Array<{
    id: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      createdAt: string;
    }>;
  }>;
}

// Local File Helper Functions
let memoryDb: LocalAnalysis[] = [];
let hasLoadedMemory = false;

function readLocalDb(): LocalAnalysis[] {
  if (memoryDb.length > 0) {
    return memoryDb;
  }

  if (!fs.existsSync(LOCAL_DB_PATH)) {
    try {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify([], null, 2));
    } catch (e) {
      console.warn('[Storage] Read-only environment, unable to create db.json on disk. Using in-memory store.');
    }
    return memoryDb;
  }
  try {
    const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    const parsed = JSON.parse(content || '[]');
    if (!hasLoadedMemory) {
      memoryDb = parsed;
      hasLoadedMemory = true;
    }
    return memoryDb;
  } catch (e) {
    console.error('[Storage] Error reading local db.json, returning empty array', e);
    return memoryDb;
  }
}

function writeLocalDb(data: LocalAnalysis[]) {
  memoryDb = data;
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('[Storage] Write failed (probably serverless read-only filesystem). Saving in-memory only.', e);
  }
}

// Unified Storage API
export const storage = {
  async getAnalyses(): Promise<LocalAnalysis[]> {
    if (prisma && isDbConfigured) {
      try {
        const dbAnalyses = await prisma.analysis.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            report: true,
            competitor: true,
            experiments: true,
            chats: {
              include: { messages: { orderBy: { createdAt: 'asc' } } }
            }
          }
        });

        return dbAnalyses.map(a => ({
          id: a.id,
          adCopy: a.adCopy || undefined,
          screenshotUrl: a.screenshotUrl || undefined,
          landingPageUrl: a.landingPageUrl,
          competitorUrl: a.competitorUrl || undefined,
          createdAt: a.createdAt.toISOString(),
          report: a.report ? {
            score: a.report.score,
            confidence: a.report.confidence,
            summary: a.report.summary,
            details: a.report.details as any,
            problems: a.report.problems as any,
            copywriting: a.report.copywriting as any,
          } : undefined,
          competitor: a.competitor ? (a.competitor.data as any) : undefined,
          experiments: a.experiments.map(e => ({
            hypothesis: e.hypothesis,
            variantA: e.variantA,
            variantB: e.variantB,
            metric: e.metric,
            traffic: e.traffic,
            duration: e.duration
          })),
          chats: a.chats.map(c => ({
            id: c.id,
            messages: c.messages.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
              createdAt: m.createdAt.toISOString()
            }))
          }))
        }));
      } catch (err) {
        console.error('[Storage] Database query failed, falling back to local file:', err);
      }
    }
    return readLocalDb();
  },

  async getAnalysis(id: string): Promise<LocalAnalysis | null> {
    if (prisma && isDbConfigured) {
      try {
        const a = await prisma.analysis.findUnique({
          where: { id },
          include: {
            report: true,
            competitor: true,
            experiments: true,
            chats: {
              include: { messages: { orderBy: { createdAt: 'asc' } } }
            }
          }
        });
        if (a) {
          return {
            id: a.id,
            adCopy: a.adCopy || undefined,
            screenshotUrl: a.screenshotUrl || undefined,
            landingPageUrl: a.landingPageUrl,
            competitorUrl: a.competitorUrl || undefined,
            createdAt: a.createdAt.toISOString(),
            report: a.report ? {
              score: a.report.score,
              confidence: a.report.confidence,
              summary: a.report.summary,
              details: a.report.details as any,
              problems: a.report.problems as any,
              copywriting: a.report.copywriting as any,
            } : undefined,
            competitor: a.competitor ? (a.competitor.data as any) : undefined,
            experiments: a.experiments.map(e => ({
              hypothesis: e.hypothesis,
              variantA: e.variantA,
              variantB: e.variantB,
              metric: e.metric,
              traffic: e.traffic,
              duration: e.duration
            })),
            chats: a.chats.map(c => ({
              id: c.id,
              messages: c.messages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
                createdAt: m.createdAt.toISOString()
              }))
            }))
          };
        }
      } catch (err) {
        console.error(`[Storage] Failed to retrieve analysis ${id} from DB, falling back to local file:`, err);
      }
    }
    const local = readLocalDb();
    return local.find(a => a.id === id) || null;
  },

  async saveAnalysis(analysis: LocalAnalysis): Promise<void> {
    if (prisma && isDbConfigured) {
      try {
        // Upsert analysis
        await prisma.analysis.upsert({
          where: { id: analysis.id },
          create: {
            id: analysis.id,
            adCopy: analysis.adCopy,
            screenshotUrl: analysis.screenshotUrl,
            landingPageUrl: analysis.landingPageUrl,
            competitorUrl: analysis.competitorUrl,
            createdAt: new Date(analysis.createdAt)
          },
          update: {
            adCopy: analysis.adCopy,
            screenshotUrl: analysis.screenshotUrl,
            landingPageUrl: analysis.landingPageUrl,
            competitorUrl: analysis.competitorUrl
          }
        });

        // Save report if exists
        if (analysis.report) {
          await prisma.report.upsert({
            where: { analysisId: analysis.id },
            create: {
              analysisId: analysis.id,
              score: analysis.report.score,
              confidence: analysis.report.confidence,
              summary: analysis.report.summary,
              details: analysis.report.details as any,
              problems: analysis.report.problems as any,
              copywriting: analysis.report.copywriting as any
            },
            update: {
              score: analysis.report.score,
              confidence: analysis.report.confidence,
              summary: analysis.report.summary,
              details: analysis.report.details as any,
              problems: analysis.report.problems as any,
              copywriting: analysis.report.copywriting as any
            }
          });
        }

        // Save competitor if exists
        if (analysis.competitor) {
          await prisma.competitor.upsert({
            where: { analysisId: analysis.id },
            create: {
              analysisId: analysis.id,
              data: analysis.competitor as any
            },
            update: {
              data: analysis.competitor as any
            }
          });
        }

        // Clear and recreate experiments
        await prisma.experiment.deleteMany({ where: { analysisId: analysis.id } });
        if (analysis.experiments && analysis.experiments.length > 0) {
          await prisma.experiment.createMany({
            data: analysis.experiments.map(e => ({
              analysisId: analysis.id,
              hypothesis: e.hypothesis,
              variantA: e.variantA,
              variantB: e.variantB,
              metric: e.metric,
              traffic: e.traffic,
              duration: e.duration
            }))
          });
        }

        // Handle Chat syncing
        if (analysis.chats && analysis.chats.length > 0) {
          for (const chat of analysis.chats) {
            await prisma.chat.upsert({
              where: { id: chat.id },
              create: {
                id: chat.id,
                analysisId: analysis.id
              },
              update: {}
            });

            await prisma.chatMessage.deleteMany({ where: { chatId: chat.id } });
            if (chat.messages && chat.messages.length > 0) {
              await prisma.chatMessage.createMany({
                data: chat.messages.map(m => ({
                  chatId: chat.id,
                  role: m.role,
                  content: m.content,
                  createdAt: new Date(m.createdAt)
                }))
              });
            }
          }
        }
        return;
      } catch (err) {
        console.error('[Storage] Failed to save analysis to database, falling back to local file:', err);
      }
    }

    const local = readLocalDb();
    const idx = local.findIndex(a => a.id === analysis.id);
    if (idx >= 0) {
      local[idx] = analysis;
    } else {
      local.unshift(analysis);
    }
    writeLocalDb(local);
  },

  async deleteAnalysis(id: string): Promise<void> {
    if (prisma && isDbConfigured) {
      try {
        await prisma.analysis.delete({ where: { id } });
        return;
      } catch (err) {
        console.error(`[Storage] Failed to delete analysis ${id} from DB, falling back to local file:`, err);
      }
    }

    const local = readLocalDb();
    const filtered = local.filter(a => a.id !== id);
    writeLocalDb(filtered);
  },

  async duplicateAnalysis(id: string, newId: string): Promise<LocalAnalysis | null> {
    const source = await this.getAnalysis(id);
    if (!source) return null;

    const copy: LocalAnalysis = {
      ...source,
      id: newId,
      createdAt: new Date().toISOString(),
      chats: [], // Clear chats for duplicated analyses
    };

    await this.saveAnalysis(copy);
    return copy;
  },

  async addChatMessage(analysisId: string, chatId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    if (prisma && isDbConfigured) {
      try {
        // Ensure Chat exists
        await prisma.chat.upsert({
          where: { id: chatId },
          create: {
            id: chatId,
            analysisId: analysisId
          },
          update: {}
        });

        // Add message
        await prisma.chatMessage.create({
          data: {
            chatId,
            role,
            content,
            createdAt: new Date()
          }
        });
        return;
      } catch (err) {
        console.error('[Storage] Failed to write chat message to database, falling back to local file:', err);
      }
    }

    const local = readLocalDb();
    const aIdx = local.findIndex(a => a.id === analysisId);
    if (aIdx >= 0) {
      const analysis = local[aIdx];
      if (!analysis.chats) analysis.chats = [];
      let chat = analysis.chats.find(c => c.id === chatId);
      if (!chat) {
        chat = { id: chatId, messages: [] };
        analysis.chats.push(chat);
      }
      chat.messages.push({
        role,
        content,
        createdAt: new Date().toISOString()
      });
      writeLocalDb(local);
    }
  },

  async getStats(): Promise<{
    totalAnalyses: number;
    averageScore: number;
    commonIssuesCount: Record<string, number>;
    dailyUsage: Array<{ date: string; count: number }>;
  }> {
    const list = await this.getAnalyses();
    const total = list.length;
    
    if (total === 0) {
      return {
        totalAnalyses: 0,
        averageScore: 0,
        commonIssuesCount: {},
        dailyUsage: []
      };
    }

    let sumScores = 0;
    const issues: Record<string, number> = {};
    const usage: Record<string, number> = {};

    list.forEach(a => {
      if (a.report) {
        sumScores += a.report.score;
        a.report.problems.forEach(p => {
          issues[p.problem] = (issues[p.problem] || 0) + 1;
        });
      }
      const day = a.createdAt.split('T')[0];
      usage[day] = (usage[day] || 0) + 1;
    });

    const dailyUsage = Object.keys(usage)
      .sort()
      .map(date => ({ date, count: usage[date] }));

    return {
      totalAnalyses: total,
      averageScore: Math.round(sumScores / total),
      commonIssuesCount: issues,
      dailyUsage
    };
  },

  _resetMemoryDb() {
    memoryDb = [];
    hasLoadedMemory = false;
  }
};
