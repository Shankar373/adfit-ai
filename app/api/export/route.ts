import { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';
import PDFDocument from 'pdfkit';

export const dynamic = 'force-dynamic';

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

    // Generate PDF using PDFKit
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Branding Header
      doc.fillColor('#0f172a').rect(0, 0, 595.28, 60).fill(); // Slate-900 header block
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('AdFit AI', 50, 20);
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text('AI-Powered Ad-to-Landing Page Fit Audit', 150, 26);
      
      // Meta Information
      doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('AUDIT SUMMARY', 50, 80);
      doc.fontSize(10).font('Helvetica')
         .text(`Target URL: ${landingPageUrl || 'N/A'}`, 50, 100)
         .text(`Created on: ${createdAt ? new Date(createdAt).toLocaleDateString() : new Date().toLocaleDateString()}`, 50, 115)
         .text(`Overall Fit Score: ${report.score || 0}/100 (${report.confidence || 'Medium'} Confidence)`, 50, 130);
      
      if (competitorUrl) {
        doc.text(`Competitor URL: ${competitorUrl}`, 50, 145);
      }

      doc.moveTo(50, 165).lineTo(545, 165).strokeColor('#e2e8f0').stroke();

      // Category Scores
      doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('CATEGORY ALIGNMENT SCORES', 50, 180);
      let yOffset = 205;
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

      categories.forEach((cat, index) => {
        const col = index % 2 === 0 ? 50 : 300;
        if (index > 0 && index % 2 === 0) {
          yOffset += 30;
        }
        // Draw progress bar outline
        doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(`${cat.label}: ${cat.val}/100`, col, yOffset);
        doc.rect(col, yOffset + 12, 200, 8).fillColor('#f1f5f9').fill();
        const fillWidth = (Math.max(0, Math.min(100, cat.val)) / 100) * 200;
        const color = cat.val > 70 ? '#10b981' : cat.val > 45 ? '#f59e0b' : '#ef4444';
        doc.rect(col, yOffset + 12, fillWidth, 8).fillColor(color).fill();
      });

      doc.moveTo(50, yOffset + 40).lineTo(545, yOffset + 40).strokeColor('#e2e8f0').stroke();

      // Executive Summary
      doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('MARKETING EXECUTIVE SUMMARY', 50, yOffset + 55);
      
      // Clean Markdown tags for simple PDF display
      const cleanSummary = (report.summary || '')
        .replace(/#+\s+/g, '') // remove headings markers
        .replace(/\*\*/g, '')  // remove bold markers
        .replace(/\*/g, '')    // remove bullets/italics markers
        .trim();

      doc.fillColor('#334155').fontSize(10).font('Helvetica')
         .text(cleanSummary || 'No summary description provided.', 50, yOffset + 75, { width: 495, align: 'left', lineGap: 3 });

      // Add a page for Problems & Recommendations
      const problems = report.problems || [];
      if (problems.length > 0) {
        doc.addPage();
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('RICE-PRIORITIZED OPTIMIZATION ISSUES', 50, 40);
        
        let problemY = 70;
        problems.forEach((p, index) => {
          // Prevent overflow
          if (problemY > 650) {
            doc.addPage();
            problemY = 40;
          }

          doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${p.problem || 'Conversion Issue'}`, 50, problemY);
          doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(`Priority: ${p.priority || 'Medium'} | RICE: ${p.riceScore || 0} (Impact: ${p.impact || 0}, Effort: ${p.effort || 0})`, 50, problemY + 15);
          
          doc.fillColor('#334155').fontSize(9).font('Helvetica')
             .text(`Evidence: ${p.evidence || 'N/A'}`, 50, problemY + 30, { width: 495 })
             .text(`Explanation: ${p.explanation || 'N/A'}`, 50, doc.y + 4, { width: 495 })
             .text(`Business Impact: ${p.businessImpact || 'N/A'}`, 50, doc.y + 4, { width: 495 })
             .text(`Suggested Fix: ${p.suggestedFix || 'N/A'}`, 50, doc.y + 4, { width: 495 });

          problemY = doc.y + 20;
          doc.moveTo(50, problemY - 10).lineTo(545, problemY - 10).strokeColor('#f1f5f9').stroke();
        });
      }

      // Add page for Copywriting & Experiments
      const copywriting = report.copywriting || {};
      doc.addPage();
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('AI COPYWRITER REVISIONS', 50, 40);
      
      let copyY = 70;
      const copySections = [
        { title: 'Headline Rewrite', val: copywriting.headline },
        { title: 'Subheadline Rewrite', val: copywriting.subheadline },
        { title: 'CTA Button Rewrite', val: copywriting.cta },
        { title: 'Hero Area Rewrite', val: copywriting.hero },
        { title: 'Benefit Rephrasing', val: copywriting.benefits },
        { title: 'Pricing Copy', val: copywriting.pricingCopy }
      ];

      copySections.forEach((c) => {
        if (c.val) {
          if (copyY > 700) {
            doc.addPage();
            copyY = 40;
          }
          doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(c.title, 50, copyY);
          doc.fillColor('#334155').fontSize(9).font('Helvetica-Oblique').text(`"${c.val}"`, 60, copyY + 14, { width: 485 });
          copyY = doc.y + 15;
        }
      });

      // Experiments Section
      const safeExperiments = experiments || [];
      if (safeExperiments.length > 0) {
        copyY += 20;
        if (copyY > 650) {
          doc.addPage();
          copyY = 40;
        }
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('RECOMMENDED A/B EXPERIMENTS', 50, copyY);
        copyY += 25;

        safeExperiments.forEach((exp, idx) => {
          if (copyY > 650) {
            doc.addPage();
            copyY = 40;
          }
          doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(`Experiment ${idx + 1}: ${exp.hypothesis || 'CRO Hypothesis'}`, 50, copyY, { width: 495 });
          doc.fillColor('#334155').fontSize(9).font('Helvetica')
             .text(`Variant A (Control): ${exp.variantA || 'Current design'}`, 60, copyY + 16, { width: 485 })
             .text(`Variant B (Challenger): ${exp.variantB || 'Optimized design'}`, 60, doc.y + 4, { width: 485 })
             .text(`Success Metric: ${exp.metric || 'Conversion Rate'} | Duration: ${exp.duration || '7 days'}`, 60, doc.y + 4, { width: 485 });
          copyY = doc.y + 20;
        });
      }

      // End of document
      doc.end();
    });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="AdFit_Report_${id}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (err: any) {
    console.error('[API Export] PDF Generation failed:', err);
    return new Response(JSON.stringify({ error: `Failed to export PDF: ${err.message || err}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
