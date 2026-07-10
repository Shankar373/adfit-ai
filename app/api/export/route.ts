import { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const dynamic = 'force-dynamic';

// Text wrapping utility using actual font width metrics
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    // Add empty line for spacing between paragraphs if split
    if (paragraphs.length > 1) {
      lines.push('');
    }
  }
  // Trim trailing empty line if any
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing analysis ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await storage.getAnalysis(id);
    if (!data || !data.report) {
      return new Response(JSON.stringify({ error: 'Report not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { report, landingPageUrl, competitorUrl, createdAt, experiments } = data;

    // Create pdf-lib PDF Document
    const pdfDoc = await PDFDocument.create();
    
    // Embed Helvetica standard font families (Built-in, requires no FS lookup)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // Add first page
    let page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    let y = 780; // Starting Y coordinate (Next.js/PDF coordinate origin is bottom-left)

    // Colors
    const colorTitle = rgb(15/255, 23/255, 42/255); // Slate-900
    const colorBody = rgb(30/255, 41/255, 59/255); // Slate-800
    const colorMuted = rgb(100/255, 116/255, 139/255); // Slate-500
    const colorBorder = rgb(226/255, 232/255, 240/255); // Slate-200
    const colorProgressBg = rgb(241/255, 245/255, 249/255); // Slate-100

    // Branding Header Block
    page.drawRectangle({
      x: 0,
      y: 790,
      width: 595.28,
      height: 52,
      color: colorTitle
    });

    page.drawText('AdFit AI', { x: 50, y: 810, size: 20, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText('AI-Powered Ad-to-Landing Page Fit Audit', { x: 140, y: 814, size: 10, font: fontRegular, color: rgb(0.8, 0.8, 0.8) });

    // Meta Section
    page.drawText('AUDIT SUMMARY', { x: 50, y: 750, size: 12, font: fontBold, color: colorTitle });
    page.drawText(`Target URL: ${landingPageUrl || 'N/A'}`, { x: 50, y: 730, size: 10, font: fontRegular, color: colorBody });
    
    const dateStr = createdAt ? new Date(createdAt).toLocaleDateString() : new Date().toLocaleDateString();
    page.drawText(`Created on: ${dateStr}`, { x: 50, y: 715, size: 10, font: fontRegular, color: colorBody });
    
    const scoreVal = report.score || 0;
    const confidenceVal = report.confidence || 'Medium';
    page.drawText(`Overall Fit Score: ${scoreVal}/100 (${confidenceVal} Confidence)`, { x: 50, y: 700, size: 10, font: fontRegular, color: colorBody });

    if (competitorUrl) {
      page.drawText(`Competitor URL: ${competitorUrl}`, { x: 50, y: 685, size: 10, font: fontRegular, color: colorBody });
    }

    y = competitorUrl ? 665 : 680;
    page.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 1,
      color: colorBorder
    });

    // Category Scores
    y -= 25;
    page.drawText('CATEGORY ALIGNMENT SCORES', { x: 50, y, size: 12, font: fontBold, color: colorTitle });
    
    const details = report.details || {};
    const categories = [
      { label: 'Headline Match', val: details.headline ?? 0 },
      { label: 'Offer Consistency', val: details.offer ?? 0 },
      { label: 'Call-To-Action Fit', val: details.cta ?? 0 },
      { label: 'Trust signals', val: details.trust ?? 0 },
      { label: 'Social Proof Presence', val: details.socialProof ?? 0 },
      { label: 'Objection Handling', val: details.objectionHandling ?? 0 },
      { label: 'Above-the-fold Quality', val: details.aboveFold ?? 0 },
      { label: 'Pricing Transparency', val: details.pricing ?? 0 }
    ];

    y -= 25;
    categories.forEach((cat, index) => {
      const isLeft = index % 2 === 0;
      const colX = isLeft ? 50 : 310;
      
      // Category Text
      page.drawText(`${cat.label}: ${cat.val}/100`, { x: colX, y, size: 9, font: fontRegular, color: colorMuted });
      
      // Progress Bar Backtrack
      page.drawRectangle({
        x: colX,
        y: y - 12,
        width: 220,
        height: 7,
        color: colorProgressBg
      });

      // Progress Bar Fill
      const fillW = (Math.max(0, Math.min(100, cat.val)) / 100) * 220;
      const fillCol = cat.val > 70 ? rgb(16/255, 185/255, 129/255) : cat.val > 45 ? rgb(245/255, 158/255, 11/255) : rgb(239/255, 68/255, 68/255);
      
      page.drawRectangle({
        x: colX,
        y: y - 12,
        width: fillW,
        height: 7,
        color: fillCol
      });

      if (!isLeft) {
        y -= 28;
      }
    });

    y -= 15;
    page.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 1,
      color: colorBorder
    });

    // Executive Summary
    y -= 25;
    page.drawText('MARKETING EXECUTIVE SUMMARY', { x: 50, y, size: 12, font: fontBold, color: colorTitle });
    
    const cleanSummary = (report.summary || '')
      .replace(/#+\s+/g, '') // remove markdown titles
      .replace(/\*\*/g, '')  // remove markdown bolds
      .replace(/\*/g, '')    // remove markdown bullets
      .trim();

    y -= 20;
    const summaryLines = wrapText(cleanSummary || 'No executive summary provided.', fontRegular, 9, 495);
    for (const sLine of summaryLines) {
      if (y < 50) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = 780;
      }
      if (sLine !== '') {
        page.drawText(sLine, { x: 50, y, size: 9, font: fontRegular, color: colorBody });
      }
      y -= 13;
    }

    // Problems & Recommendations Section
    const problemsList = report.problems || [];
    if (problemsList.length > 0) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 780;
      
      page.drawText('RICE-PRIORITIZED OPTIMIZATION CHECKLIST', { x: 50, y, size: 14, font: fontBold, color: colorTitle });
      y -= 25;

      problemsList.forEach((p, idx) => {
        if (y < 120) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = 780;
        }

        page.drawText(`${idx + 1}. ${p.problem || 'Conversion Leak'}`, { x: 50, y, size: 10, font: fontBold, color: colorTitle });
        y -= 14;

        const infoText = `Priority: ${p.priority || 'Medium'} | RICE Score: ${p.riceScore || 0} (Impact: ${p.impact || 0}, Effort: ${p.effort || 0})`;
        page.drawText(infoText, { x: 50, y, size: 8, font: fontRegular, color: colorMuted });
        y -= 15;

        // Wrapped detail fields
        const detailsFields = [
          { prefix: 'Evidence: ', txt: p.evidence || 'N/A' },
          { prefix: 'Explanation: ', txt: p.explanation || 'N/A' },
          { prefix: 'Business Impact: ', txt: p.businessImpact || 'N/A' },
          { prefix: 'Suggested Fix: ', txt: p.suggestedFix || 'N/A' }
        ];

        detailsFields.forEach((field) => {
          const fieldTxt = `${field.prefix}${field.txt}`;
          const wrappedF = wrapText(fieldTxt, fontRegular, 8.5, 495);
          for (const line of wrappedF) {
            if (y < 50) {
              page = pdfDoc.addPage([595.28, 841.89]);
              y = 780;
            }
            page.drawText(line, { x: 55, y, size: 8.5, font: fontRegular, color: colorBody });
            y -= 12;
          }
        });

        y -= 8;
        page.drawLine({
          start: { x: 50, y },
          end: { x: 545, y },
          thickness: 1,
          color: colorProgressBg
        });
        y -= 18;
      });
    }

    // AI copywriting page
    const copywriting = report.copywriting || {};
    page = pdfDoc.addPage([595.28, 841.89]);
    y = 780;

    page.drawText('AI COPYWRITER RECOMMENDATIONS', { x: 50, y, size: 14, font: fontBold, color: colorTitle });
    y -= 25;

    const copyList = [
      { title: 'Headline Rewrite', val: copywriting.headline },
      { title: 'Subheadline Rewrite', val: copywriting.subheadline },
      { title: 'CTA Button Rewrite', val: copywriting.cta },
      { title: 'Hero Section Rewrite', val: copywriting.hero },
      { title: 'Benefits List Rewrite', val: copywriting.benefits },
      { title: 'Pricing Section Copy', val: copywriting.pricingCopy }
    ];

    copyList.forEach((c) => {
      if (!c.val) return;
      if (y < 80) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = 780;
      }

      page.drawText(c.title, { x: 50, y, size: 10, font: fontBold, color: colorTitle });
      y -= 14;

      const formattedVal = `"${c.val}"`;
      const wrappedVal = wrapText(formattedVal, fontOblique, 9, 480);
      for (const line of wrappedVal) {
        if (y < 50) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = 780;
        }
        page.drawText(line, { x: 60, y, size: 9, font: fontOblique, color: colorBody });
        y -= 12;
      }
      y -= 14;
    });

    // Experiments Page
    const safeExperiments = experiments || [];
    if (safeExperiments.length > 0) {
      if (y < 120) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = 780;
      } else {
        y -= 10;
      }

      page.drawText('RECOMMENDED A/B TESTING EXPERIMENTS', { x: 50, y, size: 12, font: fontBold, color: colorTitle });
      y -= 22;

      safeExperiments.forEach((exp, idx) => {
        if (y < 100) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = 780;
        }

        page.drawText(`Experiment ${idx + 1}: ${exp.hypothesis || 'CRO Hypothesis'}`, { x: 50, y, size: 9.5, font: fontBold, color: colorTitle });
        y -= 14;

        page.drawText(`Variant A (Control): ${exp.variantA || 'Current layout'}`, { x: 60, y, size: 8.5, font: fontRegular, color: colorBody });
        y -= 12;
        page.drawText(`Variant B (Challenger): ${exp.variantB || 'Optimized layout'}`, { x: 60, y, size: 8.5, font: fontBold, color: rgb(99/255, 102/255, 241/255) }); // Indigo color
        y -= 12;
        page.drawText(`Success Metric: ${exp.metric || 'Conversion Rate'} | Duration: ${exp.duration || '7 days'}`, { x: 60, y, size: 8.5, font: fontRegular, color: colorMuted });
        y -= 18;
      });
    }

    // Save PDF as base64 string or Uint8Array
    const pdfBytes = await pdfDoc.save();

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="AdFit_Report_${id}.pdf"`,
        'Content-Length': pdfBytes.length.toString()
      }
    });

  } catch (err: any) {
    console.error('[API Export] PDF Generation via pdf-lib failed:', err);
    return new Response(JSON.stringify({ error: `Failed to export PDF: ${err.message || err}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
