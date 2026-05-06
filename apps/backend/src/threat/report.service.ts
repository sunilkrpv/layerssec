import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ThreatSeverity, ThreatStatus, IdentifiedBy } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import { PrismaService } from '../prisma/prisma.service';

// ── Colour palette ─────────────────────────────────────────────────────────────

const BRAND_DARK = '#1e3a5f';
const BRAND_BLUE = '#2563eb';
const ACCENT_RED = '#dc2626';

const SEVERITY_COLOR: Record<ThreatSeverity, string> = {
  CRITICAL: '#b91c1c',
  HIGH: '#c2410c',
  MEDIUM: '#b45309',
  LOW: '#15803d',
  INFO: '#475569',
};

const SEVERITY_BG: Record<ThreatSeverity, string> = {
  CRITICAL: '#fef2f2',
  HIGH: '#fff7ed',
  MEDIUM: '#fffbeb',
  LOW: '#f0fdf4',
  INFO: '#f8fafc',
};

const STATUS_LABEL: Record<ThreatStatus, string> = {
  IDENTIFIED: 'Identified',
  IN_PROGRESS: 'In Progress',
  MITIGATED: 'Mitigated',
  ACCEPTED: 'Accepted',
  FALSE_POSITIVE: 'Dismissed',
};

const STRIDE_LABEL: Record<string, string> = {
  SPOOFING: 'Spoofing',
  TAMPERING: 'Tampering',
  REPUDIATION: 'Repudiation',
  INFORMATION_DISCLOSURE: 'Information Disclosure',
  DENIAL_OF_SERVICE: 'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Privilege',
};

const STRIDE_ORDER = [
  'SPOOFING', 'TAMPERING', 'REPUDIATION',
  'INFORMATION_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE',
];

const SEVERITY_ORDER: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

// ── Types ──────────────────────────────────────────────────────────────────────

interface AttackStep {
  stepNumber: number;
  action: string;
  attackTechnique: string;
  description: string;
  successLikelihood: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface AttackPath {
  pathId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  likelihood: 'HIGH' | 'MEDIUM' | 'LOW';
  entryPointLabel: string;
  steps: AttackStep[];
  summary: string;
  mitigations: string[];
}

const ATTACK_SEV_COLOR: Record<string, string> = {
  CRITICAL: '#b91c1c',
  HIGH:     '#c2410c',
  MEDIUM:   '#b45309',
  LOW:      '#15803d',
};

const ATTACK_SEV_BG: Record<string, string> = {
  CRITICAL: '#fef2f2',
  HIGH:     '#fff7ed',
  MEDIUM:   '#fffbeb',
  LOW:      '#f0fdf4',
};

const LIKELIHOOD_COLOR: Record<string, string> = {
  HIGH:   '#dc2626',
  MEDIUM: '#d97706',
  LOW:    '#64748b',
};

function parseAttackPaths(content: string): AttackPath[] | null {
  try {
    const cleaned = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as AttackPath[];
    if (parsed && Array.isArray((parsed as { paths?: unknown[] }).paths)) {
      return (parsed as { paths: AttackPath[] }).paths;
    }
    return null;
  } catch {
    return null;
  }
}

interface ThreatRow {
  id: string;
  title: string;
  description: string | null;
  targetLabel: string | null;
  strideCategory: string;
  severity: ThreatSeverity;
  status: ThreatStatus;
  identifiedBy: IdentifiedBy;
  mitigationNotes: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateProjectReport(projectId: string, userId: string): Promise<Buffer> {
    // Ownership check
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, name: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException();

    // Fetch all threats + threat model summaries
    const [threats, threatModels] = await Promise.all([
      this.prisma.threat.findMany({
        where: { threatModel: { projectId } },
        include: { threatModel: { select: { name: true, diagramVersion: true } } },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.threatModel.findMany({
        where: { projectId },
        select: { name: true, diagramVersion: true },
        orderBy: { savedAt: 'desc' },
      }),
    ]);

    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    return this.buildPdf(project.name, reportDate, threats, threatModels);
  }

  // ── PDF builder ─────────────────────────────────────────────────────────────

  private buildPdf(
    projectName: string,
    reportDate: string,
    threats: ThreatRow[],
    models: { name: string; diagramVersion: number }[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width - 100; // usable width (margins 50 each side)

      // ── Summary stats ──────────────────────────────────────────────────────
      const active = threats.filter((t) => t.status !== ThreatStatus.FALSE_POSITIVE);
      const summary = {
        total: threats.length,
        active: active.length,
        critical: active.filter((t) => t.severity === ThreatSeverity.CRITICAL).length,
        high: active.filter((t) => t.severity === ThreatSeverity.HIGH).length,
        medium: active.filter((t) => t.severity === ThreatSeverity.MEDIUM).length,
        low: active.filter((t) => t.severity === ThreatSeverity.LOW).length,
        mitigated: active.filter((t) => t.status === ThreatStatus.MITIGATED).length,
        accepted: active.filter((t) => t.status === ThreatStatus.ACCEPTED).length,
        dismissed: threats.filter((t) => t.status === ThreatStatus.FALSE_POSITIVE).length,
      };

      // Security score
      let score = 100;
      for (const t of active) {
        if (t.status === ThreatStatus.MITIGATED) { score += 1; continue; }
        if (t.severity === ThreatSeverity.CRITICAL) score -= 12;
        else if (t.severity === ThreatSeverity.HIGH) score -= 6;
        else if (t.severity === ThreatSeverity.MEDIUM) score -= 2;
        else if (t.severity === ThreatSeverity.LOW) score -= 1;
      }
      score = Math.max(0, Math.min(100, score));
      const scoreLabel =
        score >= 85 ? 'Secure' :
        score >= 70 ? 'Moderate Risk' :
        score >= 50 ? 'Elevated Risk' : 'Critical Risk';
      const scoreColor =
        score >= 85 ? '#16a34a' :
        score >= 70 ? '#d97706' :
        score >= 50 ? '#ea580c' : '#dc2626';

      const mitigationRate = summary.active > 0
        ? Math.round((summary.mitigated / summary.active) * 100) : 100;

      // ── PAGE 1 — Cover ─────────────────────────────────────────────────────

      this.drawPageHeader(doc, W, 'Threat Model Report', projectName, reportDate);

      // CONFIDENTIAL tag
      doc.fontSize(7).fillColor(ACCENT_RED).font('Helvetica-Bold')
        .text('CONFIDENTIAL', 50, 56, { align: 'right', width: W });

      // Title block
      doc.y = 120;
      doc.fontSize(8).fillColor('#dc2626').font('Helvetica-Bold')
        .text('SECURITY ASSESSMENT', 50, doc.y, { characterSpacing: 2 });
      doc.moveDown(0.4);
      doc.fontSize(26).fillColor('#0f172a').font('Helvetica-Bold')
        .text('Threat Model Report', 50, doc.y);
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#475569').font('Helvetica')
        .text('STRIDE Threat Analysis & Risk Assessment', 50, doc.y);
      doc.moveDown(0.8);

      // Divider line (gradient-like: dark to light)
      doc.save();
      doc.rect(50, doc.y, W * 0.6, 2.5).fill(BRAND_DARK);
      doc.rect(50 + W * 0.6, doc.y, W * 0.35, 2.5).fill('#e2e8f0');
      doc.restore();
      doc.moveDown(1.5);

      // Report details box
      const detailsY = doc.y;
      doc.roundedRect(50, detailsY, W, 72, 6).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fontSize(7).fillColor('#64748b').font('Helvetica-Bold')
        .text('REPORT DETAILS', 66, detailsY + 12, { characterSpacing: 1.5 });

      const detailsData = [
        ['Project', projectName],
        ['Report Date', reportDate],
        ['Analysis Models', models.length > 0
          ? models.map((m) => `${m.name} (v${m.diagramVersion})`).join(', ')
          : 'None'],
        ['Threats Analyzed', String(summary.total)],
      ];
      const col2X = 50 + W / 2;
      detailsData.forEach(([label, value], i) => {
        const col = i % 2 === 0 ? 66 : col2X + 16;
        const row = Math.floor(i / 2);
        const y = detailsY + 28 + row * 22;
        doc.fontSize(7).fillColor('#94a3b8').font('Helvetica-Bold')
          .text(label.toUpperCase(), col, y, { characterSpacing: 0.5 });
        doc.fontSize(9).fillColor('#1e293b').font('Helvetica')
          .text(value, col, y + 8, { width: W / 2 - 20, lineBreak: false });
      });
      doc.y = detailsY + 82;

      // Introduction paragraph
      doc.fontSize(9.5).fillColor('#475569').font('Helvetica')
        .text(
          `This report presents a comprehensive STRIDE threat model analysis for the ${projectName} architecture. ` +
          `The analysis was performed using Layers's AI-powered threat modeling engine, systematically evaluating ` +
          `each component and data flow against the six STRIDE threat categories. Threats are classified by severity ` +
          `(Critical, High, Medium, Low) and tracked through their mitigation lifecycle.`,
          50, doc.y, { width: W, lineGap: 2 },
        );
      doc.moveDown(1.2);

      // Security posture box
      const postureY = doc.y;
      const postureH = 70;
      doc.roundedRect(50, postureY, W, postureH, 6)
        .fillAndStroke('#f8fafc', scoreColor + '44');
      doc.fontSize(7).fillColor('#64748b').font('Helvetica-Bold')
        .text('SECURITY POSTURE', 66, postureY + 12, { characterSpacing: 1.5 });

      // Score bar background
      const barX = 66, barY = postureY + 28, barW = W - 100, barH = 10;
      doc.roundedRect(barX, barY, barW, barH, 4).fill('#e2e8f0');
      doc.roundedRect(barX, barY, (barW * score) / 100, barH, 4).fill(scoreColor);

      // Score number
      doc.fontSize(20).fillColor(scoreColor).font('Helvetica-Bold')
        .text(String(score), barX + barW + 10, postureY + 20, { width: 30 });
      doc.fontSize(8).fillColor('#64748b').font('Helvetica')
        .text('/100', barX + barW + 40, postureY + 28);

      // Score label pill + rate
      doc.roundedRect(66, postureY + 44, 80, 14, 4).fill(scoreColor);
      doc.fontSize(7).fillColor('#ffffff').font('Helvetica-Bold')
        .text(scoreLabel.toUpperCase(), 70, postureY + 48, { width: 72, align: 'center', characterSpacing: 0.5 });
      doc.fontSize(8).fillColor('#64748b').font('Helvetica')
        .text(
          `Mitigation rate: ${mitigationRate}%  ·  ${summary.mitigated} of ${summary.active} active threats mitigated`,
          154, postureY + 48,
        );

      doc.y = postureY + postureH + 16;

      // Executive summary stats (2 rows × 4 cols)
      doc.fontSize(7).fillColor('#64748b').font('Helvetica-Bold')
        .text('EXECUTIVE SUMMARY', 50, doc.y, { characterSpacing: 1.5 });
      doc.moveDown(0.5);

      const statsData = [
        { label: 'Total Threats', value: summary.total,    color: '#1e293b', bg: '#f8fafc', border: '#e2e8f0' },
        { label: 'Critical',      value: summary.critical,  color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
        { label: 'High',          value: summary.high,      color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
        { label: 'Mitigated',     value: summary.mitigated, color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
        { label: 'Medium',        value: summary.medium,    color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
        { label: 'Low',           value: summary.low,       color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
        { label: 'Accepted',      value: summary.accepted,  color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
        { label: 'Dismissed',     value: summary.dismissed, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
      ];
      const colW = (W - 18) / 4;
      const rowH = 46;
      const statsBaseY = doc.y;  // capture once — doc.y drifts after each text() call
      statsData.forEach((stat, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 50 + col * (colW + 6);
        const y = statsBaseY + row * (rowH + 6);  // fixed base
        doc.roundedRect(x, y, colW, rowH, 5).fillAndStroke(stat.bg, stat.border);
        doc.fontSize(22).fillColor(stat.color).font('Helvetica-Bold')
          .text(String(stat.value), x, y + 8, { width: colW, align: 'center' });
        doc.fontSize(7).fillColor('#64748b').font('Helvetica-Bold')
          .text(stat.label.toUpperCase(), x, y + 32, {
            width: colW, align: 'center', characterSpacing: 0.3,
          });
      });
      doc.y = statsBaseY + 2 * (rowH + 6);  // skip past the 2-row grid

      // ── PAGE 2 — Threat Catalog ────────────────────────────────────────────
      doc.addPage();
      this.drawPageHeader(doc, W, 'Threat Catalog', projectName, reportDate);
      doc.y = 80;

      doc.fontSize(18).fillColor('#0f172a').font('Helvetica-Bold')
        .text('Threat Catalog', 50, doc.y);
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#64748b').font('Helvetica')
        .text(
          'All identified threats grouped by STRIDE category, sorted by severity. ' +
          'Dismissed threats were reviewed and determined to be false positives.',
          50, doc.y, { width: W },
        );
      doc.moveDown(1);

      if (threats.length === 0) {
        doc.fontSize(11).fillColor('#94a3b8').font('Helvetica')
          .text('No threats have been recorded for this project.', 50, doc.y, {
            width: W, align: 'center',
          });
      } else {
        // Group by STRIDE
        const byStride: Record<string, ThreatRow[]> = {};
        for (const cat of STRIDE_ORDER) byStride[cat] = [];
        for (const t of threats) {
          if (byStride[t.strideCategory]) byStride[t.strideCategory].push(t);
        }
        // Sort each group by severity
        for (const cat of STRIDE_ORDER) {
          byStride[cat].sort(
            (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
          );
        }

        for (const cat of STRIDE_ORDER) {
          const group = byStride[cat];
          if (group.length === 0) continue;

          // Ensure enough space for the category header — add page if < 60pt left
          if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
            doc.addPage();
            this.drawPageHeader(doc, W, 'Threat Catalog (cont.)', projectName, reportDate);
            doc.y = 80;
          }

          // Category header — save Y before any text() calls that would advance doc.y
          const catHeaderH = 34;
          const catHeaderY = doc.y;
          doc.roundedRect(50, catHeaderY, W, catHeaderH, 6).fill(BRAND_DARK);
          doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold')
            .text(STRIDE_LABEL[cat] || cat, 66, catHeaderY + 7);
          doc.fontSize(7.5).fillColor('#93c5fd').font('Helvetica')
            .text(this.strideDescription(cat), 66, catHeaderY + 19, { width: W - 120 });
          // Count badge
          const countText = `${group.length} threat${group.length !== 1 ? 's' : ''}`;
          const badgeW = countText.length * 5 + 12;
          doc.roundedRect(50 + W - badgeW - 10, catHeaderY + 9, badgeW, 16, 8)
            .fillOpacity(0.2).fill('#ffffff').fillOpacity(1);
          doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
            .text(countText, 50 + W - badgeW - 10, catHeaderY + 13, { width: badgeW, align: 'center' });
          doc.y = catHeaderY + catHeaderH;

          // Threats in group
          for (let i = 0; i < group.length; i++) {
            const t = group[i];
            const isLast = i === group.length - 1;
            const isDismissed = t.status === ThreatStatus.FALSE_POSITIVE;

            // Estimate row height: base 46 + description lines
            const descLines = t.description
              ? Math.ceil(t.description.length / 85) : 0;
            const rowH2 = 46 + descLines * 11;

            if (doc.y > doc.page.height - doc.page.margins.bottom - rowH2 - 20) {
              doc.addPage();
              this.drawPageHeader(doc, W, 'Threat Catalog (cont.)', projectName, reportDate);
              doc.y = 80;
              // Redraw category header on continuation page
              const contHY = doc.y;
              doc.roundedRect(50, contHY, W, 26, 6).fill(BRAND_DARK);
              doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
                .text(`${STRIDE_LABEL[cat] || cat} (cont.)`, 66, contHY + 8);
              doc.y = contHY + 26;
            }

            const rowY = doc.y;
            const rowBg = i % 2 === 0 ? '#ffffff' : '#fafafa';
            (isLast
              ? doc.roundedRect(50, rowY, W, rowH2, 6)
              : doc.rect(50, rowY, W, rowH2)
            ).fillAndStroke(rowBg, '#e2e8f0');

            // Severity badge
            doc.roundedRect(66, rowY + 12, 52, 15, 4)
              .fillAndStroke(SEVERITY_BG[t.severity], SEVERITY_COLOR[t.severity] + '44');
            doc.fontSize(7).fillColor(SEVERITY_COLOR[t.severity]).font('Helvetica-Bold')
              .text(t.severity, 66, rowY + 16, { width: 52, align: 'center', characterSpacing: 0.5 });

            // Title
            const titleX = 128;
            doc.fontSize(10).fillColor(isDismissed ? '#94a3b8' : '#0f172a').font('Helvetica-Bold')
              .text(t.title, titleX, rowY + 8, { width: W - titleX + 40, lineBreak: false });

            // Dismissed badge
            if (isDismissed) {
              const titleW = doc.widthOfString(t.title);
              doc.roundedRect(titleX + titleW + 6, rowY + 8, 52, 12, 3)
                .fillAndStroke('#f1f5f9', '#e2e8f0');
              doc.fontSize(6.5).fillColor('#64748b').font('Helvetica-Bold')
                .text('DISMISSED', titleX + titleW + 6, rowY + 12, { width: 52, align: 'center' });
            }

            // Meta row
            const metaY = rowY + 22;
            const meta: [string, string][] = [];
            if (t.targetLabel) meta.push(['Target', t.targetLabel]);
            meta.push(['Status', STATUS_LABEL[t.status]]);
            meta.push(['Source', t.identifiedBy === IdentifiedBy.AI ? 'AI Analysis' : 'Manual Entry']);

            let metaX = titleX;
            for (const [mLabel, mValue] of meta) {
              doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica')
                .text(`${mLabel}: `, metaX, metaY, { continued: true });
              doc.fontSize(7.5).fillColor('#475569').font('Helvetica-Bold')
                .text(mValue, { continued: false });
              metaX += 120;
              if (metaX > 50 + W - 80) break;
            }

            // Description
            if (t.description) {
              doc.fontSize(8.5).fillColor(isDismissed ? '#94a3b8' : '#475569').font('Helvetica')
                .text(t.description, titleX, rowY + 34, { width: W - titleX + 40, lineGap: 1.5 });
            }

            doc.y = rowY + rowH2;
          }

          doc.moveDown(1);
        }
      }

      // ── PAGE 3 — Summary Table ─────────────────────────────────────────────
      if (threats.length > 0) {
        doc.addPage();
        this.drawPageHeader(doc, W, 'Summary Table', projectName, reportDate);
        doc.y = 80;

        doc.fontSize(18).fillColor('#0f172a').font('Helvetica-Bold')
          .text('Summary Table', 50, doc.y);
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor('#64748b').font('Helvetica')
          .text(
            'Complete threat inventory sorted by severity. Use this table as a quick reference during security reviews.',
            50, doc.y, { width: W },
          );
        doc.moveDown(0.8);

        // Table header — column widths must sum to exactly W (495)
        const cols = [
          { label: '#',        w: 18 },
          { label: 'Threat',   w: 150 },
          { label: 'Target',   w: 82 },
          { label: 'STRIDE',   w: 90 },
          { label: 'Severity', w: 52 },
          { label: 'Status',   w: 65 },
          { label: 'Source',   w: 38 },
        ]; // total = 495 = W
        const tableW = cols.reduce((s, c) => s + c.w, 0);
        const tHeaderH = 22;

        // Save Y before drawing — text() calls inside the loop advance doc.y
        let hY = doc.y;
        doc.rect(50, hY, tableW, tHeaderH).fill(BRAND_DARK);
        let cx = 50;
        for (const col of cols) {
          doc.fontSize(7).fillColor('#ffffff').font('Helvetica-Bold')
            .text(col.label, cx + 4, hY + 8, { width: col.w - 8, characterSpacing: 0.5 });
          cx += col.w;
        }
        doc.y = hY + tHeaderH;

        const sorted = [...threats].sort(
          (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
        );

        for (let i = 0; i < sorted.length; i++) {
          const t = sorted[i];
          const rowH3 = 18;

          if (doc.y > doc.page.height - doc.page.margins.bottom - rowH3 - 10) {
            doc.addPage();
            this.drawPageHeader(doc, W, 'Summary Table (cont.)', projectName, reportDate);
            doc.y = 80;
            // Redraw header on new page — save Y before text() calls
            hY = doc.y;
            doc.rect(50, hY, tableW, tHeaderH).fill(BRAND_DARK);
            cx = 50;
            for (const col of cols) {
              doc.fontSize(7).fillColor('#ffffff').font('Helvetica-Bold')
                .text(col.label, cx + 4, hY + 8, { width: col.w - 8, characterSpacing: 0.5 });
              cx += col.w;
            }
            doc.y = hY + tHeaderH;
          }

          const rowY = doc.y;
          const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(50, rowY, tableW, rowH3).fillAndStroke(rowBg, '#f1f5f9');

          cx = 50;
          const rowData = [
            String(i + 1),
            t.title,
            t.targetLabel || '—',
            STRIDE_LABEL[t.strideCategory] || t.strideCategory,
            t.severity,
            STATUS_LABEL[t.status],
            t.identifiedBy === IdentifiedBy.AI ? 'AI' : 'User',
          ];
          const isDismissed2 = t.status === ThreatStatus.FALSE_POSITIVE;

          rowData.forEach((val, ci) => {
            const col = cols[ci];
            let color = '#1e293b';
            if (ci === 0) color = '#94a3b8';
            if (ci === 4) color = SEVERITY_COLOR[t.severity] ?? '#1e293b';
            if (isDismissed2) color = '#94a3b8';

            doc.fontSize(8).fillColor(color).font(ci === 4 ? 'Helvetica-Bold' : 'Helvetica')
              .text(val, cx + 4, rowY + 5, { width: col.w - 8, lineBreak: false });
            cx += col.w;
          });
          doc.y = rowY + rowH3;
        }

        // Footer
        doc.moveDown(1.5);
        this.drawPageFooter(doc, W, reportDate);
      }

      // Add page numbers to all pages
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica')
          .text(
            `Page ${i + 1} of ${totalPages}`,
            50, doc.page.height - doc.page.margins.bottom - 10,
            { align: 'right', width: W },
          );
      }

      doc.end();
    });
  }

  // ── Shared page decorators ─────────────────────────────────────────────────

  private drawPageHeader(
    doc: InstanceType<typeof PDFDocument>,
    W: number,
    title: string,
    projectName: string,
    reportDate: string,
  ) {
    // Logo strip
    doc.rect(50, 40, W, 1).fill(BRAND_DARK);

    // Layers wordmark
    doc.roundedRect(50, 46, 18, 18, 3).fill(BRAND_BLUE);
    doc.fontSize(7.5).fillColor('#ffffff').font('Helvetica-Bold')
      .text('D', 50, 51, { width: 18, align: 'center' });

    doc.fontSize(10).fillColor(BRAND_DARK).font('Helvetica-Bold')
      .text('Layers', 72, 51);

    // Right side: page title + project context
    doc.fontSize(8).fillColor('#64748b').font('Helvetica')
      .text(`${projectName}  ·  ${title}  ·  ${reportDate}`, 50, 51, {
        align: 'right', width: W,
      });

    doc.rect(50, 64, W, 1).fill('#e2e8f0');
  }

  private drawPageFooter(doc: InstanceType<typeof PDFDocument>, W: number, reportDate: string) {
    doc.rect(50, doc.y, W, 1).fill('#e2e8f0');
    doc.moveDown(0.5);
    doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica')
      .text(
        `Generated by Layers  ·  Confidential  ·  ${reportDate}`,
        50, doc.y, { width: W, align: 'center' },
      );
  }

  private strideDescription(cat: string): string {
    const map: Record<string, string> = {
      SPOOFING: 'Identity and authentication threats — impersonating users, services, or components.',
      TAMPERING: 'Data integrity threats — unauthorized modification of data in transit or at rest.',
      REPUDIATION: 'Audit and logging threats — actors denying actions without verifiable evidence.',
      INFORMATION_DISCLOSURE: 'Confidentiality threats — exposure of sensitive data to unauthorized parties.',
      DENIAL_OF_SERVICE: 'Availability threats — disrupting service availability for legitimate users.',
      ELEVATION_OF_PRIVILEGE: 'Authorization threats — gaining elevated permissions beyond intended access levels.',
    };
    return map[cat] ?? '';
  }

  // ── Intel Report ─────────────────────────────────────────────────────────────

  async generateIntelReport(
    projectId: string,
    userId: string,
    params: {
      threatModelId: string;
      postureScoreId: string;
      attackSimulationId?: string;
      executiveSummary?: string;
      priorityActions?: Array<{ rank: number; severity: string; source: string; title: string; detail: string }>;
    },
  ): Promise<Buffer> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, name: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException();

    const [threatModel, postureScore, attackSim] = await Promise.all([
      this.prisma.threatModel.findUnique({
        where: { id: params.threatModelId },
        include: {
          threats: {
            select: { title: true, severity: true, strideCategory: true, targetLabel: true, status: true },
            orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
          },
        },
      }),
      this.prisma.postureScore.findUnique({
        where: { id: params.postureScoreId },
        select: { score: true, summary: true, topRecs: true, analyzedAt: true },
      }),
      params.attackSimulationId
        ? this.prisma.attackSimulation.findUnique({
            where: { id: params.attackSimulationId },
            select: { name: true, entryPointNodeId: true, content: true, createdAt: true },
          })
        : Promise.resolve(null),
    ]);

    if (!threatModel || !postureScore) throw new NotFoundException('Required analysis data not found');

    const threats = threatModel.threats;
    const activeThreats = threats.filter(t => t.status !== 'MITIGATED' && t.status !== 'FALSE_POSITIVE');
    const criticalCount = activeThreats.filter(t => t.severity === 'CRITICAL').length;
    const highCount = activeThreats.filter(t => t.severity === 'HIGH').length;
    const mediumCount = activeThreats.filter(t => t.severity === 'MEDIUM').length;
    const lowCount = activeThreats.filter(t => t.severity === 'LOW').length;
    const threatScore = Math.min(100, criticalCount * 40 + highCount * 20 + mediumCount * 5 + lowCount * 1);
    const postureRisk = 100 - postureScore.score;
    const attackModifier = attackSim ? 10 : 0;
    const compositeRisk = (threatScore * 0.45) + (postureRisk * 0.35) + (attackModifier * 0.20);
    const riskLevel = compositeRisk >= 70 ? 'CRITICAL' : compositeRisk >= 45 ? 'HIGH' : compositeRisk >= 20 ? 'MEDIUM' : 'LOW';
    const RISK_COLOR: Record<string, string> = { CRITICAL: '#b91c1c', HIGH: '#c2410c', MEDIUM: '#b45309', LOW: '#15803d' };
    const RISK_BG: Record<string, string> = { CRITICAL: '#fef2f2', HIGH: '#fff7ed', MEDIUM: '#fffbeb', LOW: '#f0fdf4' };

    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width - 100;
      const riskColor = RISK_COLOR[riskLevel];
      const riskBg = RISK_BG[riskLevel];

      // ── Page 1: Cover ─────────────────────────────────────────────────────

      // Header band
      doc.rect(50, 50, W, 4).fill(BRAND_BLUE);
      doc.moveDown(1.5);

      doc.fontSize(22).font('Helvetica-Bold').fillColor(BRAND_DARK).text('Security Intelligence Report', 50, 80);
      doc.fontSize(13).font('Helvetica').fillColor('#64748b').text(project.name, 50, 108);
      doc.fontSize(10).fillColor('#94a3b8').text(reportDate, 50, 124);

      // Risk level badge
      const badgeY = 155;
      doc.roundedRect(50, badgeY, 180, 52, 8).fill(riskBg);
      doc.roundedRect(50, badgeY, 180, 52, 8).stroke(riskColor);
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('OVERALL RISK', 62, badgeY + 10);
      doc.fontSize(20).font('Helvetica-Bold').fillColor(riskColor).text(riskLevel, 62, badgeY + 22);

      // Score badge
      doc.roundedRect(245, badgeY, 110, 52, 8).fill('#f5f3ff');
      doc.roundedRect(245, badgeY, 110, 52, 8).stroke('#7c3aed');
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('POSTURE SCORE', 257, badgeY + 10);
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#7c3aed').text(`${postureScore.score}/100`, 257, badgeY + 22);

      // Threat counts badge
      doc.roundedRect(370, badgeY, 175, 52, 8).fill('#fafafa');
      doc.roundedRect(370, badgeY, 175, 52, 8).stroke('#e2e8f0');
      const countY = badgeY + 8;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(RISK_COLOR['CRITICAL']).text(`${criticalCount} CRITICAL`, 382, countY);
      doc.fontSize(8).fillColor(RISK_COLOR['HIGH']).text(`${highCount} HIGH`, 382, countY + 12);
      doc.fontSize(8).fillColor(RISK_COLOR['MEDIUM']).text(`${mediumCount} MEDIUM`, 450, countY);
      doc.fontSize(8).fillColor(RISK_COLOR['LOW']).text(`${lowCount} LOW`, 450, countY + 12);

      // Inputs table
      const infoY = 225;
      doc.fontSize(9).font('Helvetica').fillColor('#94a3b8').text('ANALYSIS INPUTS', 50, infoY);
      doc.rect(50, infoY + 14, W, 1).fill('#e2e8f0');
      doc.fontSize(10).fillColor('#475569').font('Helvetica-Bold').text('Threat Model:', 50, infoY + 22);
      doc.font('Helvetica').fillColor(BRAND_DARK).text(threatModel.name, 150, infoY + 22);
      doc.fontSize(10).fillColor('#475569').font('Helvetica-Bold').text('Posture Score:', 50, infoY + 38);
      doc.font('Helvetica').fillColor(BRAND_DARK).text(
        new Date(postureScore.analyzedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        150, infoY + 38,
      );
      doc.fontSize(10).fillColor('#475569').font('Helvetica-Bold').text('Attack Mind:', 50, infoY + 54);
      doc.font('Helvetica').fillColor(BRAND_DARK).text(attackSim ? attackSim.name : 'Not included', 150, infoY + 54);

      // ── Page 2: Executive Summary + Priority Actions ──────────────────────

      doc.addPage();

      doc.fontSize(14).font('Helvetica-Bold').fillColor(BRAND_DARK).text('Executive Summary', 50, 60);
      doc.rect(50, 78, W, 2).fill(BRAND_BLUE);

      const summaryText = params.executiveSummary
        ?? `This architecture has an overall ${riskLevel} risk posture. Threat analysis identified ${criticalCount + highCount} critical/high severity open threats, the security posture score is ${postureScore.score}/100, and ${attackSim ? 'an attack simulation was included.' : 'no attack simulation was provided.'}`;

      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#334155').text(summaryText, 50, 88, { width: W, lineGap: 4 });

      let currentY = doc.y + 20;

      if (params.priorityActions && params.priorityActions.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor(BRAND_DARK).text('Priority Actions', 50, currentY);
        currentY += 18;
        doc.rect(50, currentY, W, 2).fill(BRAND_BLUE);
        currentY += 10;

        const SOURCE_COLOR: Record<string, string> = { threat: '#dc2626', posture: '#7c3aed', attack: '#ea580c' };

        for (const action of params.priorityActions) {
          if (currentY > doc.page.height - 80) { doc.addPage(); currentY = 60; }
          const sevColor = RISK_COLOR[action.severity.toUpperCase()] ?? '#475569';
          const srcColor = SOURCE_COLOR[action.source] ?? '#475569';

          // Rank circle
          doc.circle(60, currentY + 8, 8).fill(BRAND_DARK);
          doc.fontSize(8).font('Helvetica-Bold').fillColor('white').text(String(action.rank), 56, currentY + 4);

          // Severity badge
          doc.roundedRect(75, currentY, 55, 14, 3).fill(sevColor);
          doc.fontSize(7).fillColor('white').text(action.severity.toUpperCase(), 78, currentY + 3.5);

          // Source badge
          doc.roundedRect(136, currentY, 48, 14, 3).fill(srcColor);
          doc.fontSize(7).fillColor('white').text(action.source.toUpperCase(), 139, currentY + 3.5);

          // Title + detail
          doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND_DARK).text(action.title, 190, currentY, { width: W - 140 });
          const titleHeight = doc.heightOfString(action.title, { width: W - 140 });
          doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(action.detail, 190, currentY + titleHeight + 2, { width: W - 140 });
          const detailHeight = doc.heightOfString(action.detail, { width: W - 140 });

          currentY += Math.max(28, titleHeight + detailHeight + 10);
        }
      }

      // ── Page 3: Threat Model Summary ─────────────────────────────────────

      doc.addPage();
      currentY = 60;

      doc.fontSize(14).font('Helvetica-Bold').fillColor(BRAND_DARK).text('Threat Model Summary', 50, currentY);
      currentY += 18;
      doc.rect(50, currentY, W, 2).fill(BRAND_BLUE);
      currentY += 10;

      doc.fontSize(9).font('Helvetica').fillColor('#64748b')
        .text(`${threatModel.name} — ${activeThreats.length} open threats (${criticalCount} critical, ${highCount} high)`, 50, currentY);
      currentY += 18;

      // Table header
      const cols = [50, 130, 220, 320, 420];
      const colWidths = [75, 85, 95, 95, 75];
      doc.rect(50, currentY, W, 16).fill('#f1f5f9');
      const headers = ['Severity', 'STRIDE', 'Node', 'Title', 'Status'];
      headers.forEach((h, i) => {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569').text(h, cols[i] + 3, currentY + 4, { width: colWidths[i] });
      });
      currentY += 16;

      // Top 10 open threats
      const topThreats = activeThreats.slice(0, 10);
      for (const t of topThreats) {
        if (currentY > doc.page.height - 60) { doc.addPage(); currentY = 60; }
        const rowBg = topThreats.indexOf(t) % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(50, currentY, W, 20).fill(rowBg);
        const sevColor = RISK_COLOR[t.severity] ?? '#475569';
        doc.roundedRect(cols[0] + 2, currentY + 4, 60, 12, 2).fill(sevColor);
        doc.fontSize(7).font('Helvetica-Bold').fillColor('white').text(t.severity, cols[0] + 5, currentY + 6.5, { width: 54 });
        doc.fontSize(8).font('Helvetica').fillColor('#334155')
          .text(t.strideCategory?.replace('_', ' ') ?? '', cols[1] + 3, currentY + 6, { width: colWidths[1] - 6 })
          .text((t.targetLabel ?? '').slice(0, 20), cols[2] + 3, currentY + 6, { width: colWidths[2] - 6 })
          .text(t.title.slice(0, 30), cols[3] + 3, currentY + 6, { width: colWidths[3] - 6 })
          .text(t.status ?? '', cols[4] + 3, currentY + 6, { width: colWidths[4] - 6 });
        currentY += 20;
      }

      // ── Page 4: Posture Score ─────────────────────────────────────────────

      doc.addPage();
      currentY = 60;

      doc.fontSize(14).font('Helvetica-Bold').fillColor(BRAND_DARK).text('Security Posture Analysis', 50, currentY);
      currentY += 18;
      doc.rect(50, currentY, W, 2).fill('#7c3aed');
      currentY += 15;

      doc.fontSize(36).font('Helvetica-Bold').fillColor('#7c3aed').text(`${postureScore.score}`, 50, currentY);
      doc.fontSize(14).font('Helvetica').fillColor('#94a3b8').text('/ 100', 103, currentY + 14);
      currentY += 52;

      doc.fontSize(10).font('Helvetica').fillColor('#334155').text(postureScore.summary, 50, currentY, { width: W, lineGap: 4 });
      currentY = doc.y + 15;

      if (Array.isArray(postureScore.topRecs) && postureScore.topRecs.length > 0) {
        doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND_DARK).text('Top Recommendations', 50, currentY);
        currentY += 16;
        (postureScore.topRecs as string[]).forEach((rec, i) => {
          if (currentY > doc.page.height - 60) { doc.addPage(); currentY = 60; }
          doc.fontSize(10).font('Helvetica').fillColor('#334155').text(`${i + 1}. ${rec}`, 50, currentY, { width: W, lineGap: 3 });
          currentY = doc.y + 8;
        });
      }

      // ── Page 5: Attack Surface ────────────────────────────────────────────

      if (attackSim) {
        doc.addPage();
        currentY = 60;

        // Page title
        doc.fontSize(14).font('Helvetica-Bold').fillColor(BRAND_DARK).text('Attack Surface Analysis', 50, currentY);
        currentY += 18;
        doc.rect(50, currentY, W, 2).fill('#ea580c');
        currentY += 14;

        // Meta row
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text('Entry Point:', 50, currentY);
        doc.font('Helvetica').fillColor(BRAND_DARK).text(attackSim.entryPointNodeId ?? 'Auto-selected', 125, currentY);
        currentY += 18;

        // Try to parse structured paths
        const paths = parseAttackPaths(attackSim.content);

        if (paths && paths.length > 0) {
          // Summary pill row: critical/high/total
          const critCount = paths.filter((p) => p.severity === 'CRITICAL').length;
          const highCount = paths.filter((p) => p.severity === 'HIGH').length;
          const pillY = currentY;
          let pillX = 50;
          const pillH = 16;
          const renderPill = (label: string, bg: string, fg: string) => {
            const tw = doc.widthOfString(label) + 14;
            doc.roundedRect(pillX, pillY, tw, pillH, 3).fill(bg);
            doc.fontSize(8).font('Helvetica-Bold').fillColor(fg).text(label, pillX + 7, pillY + 3.5, { lineBreak: false });
            pillX += tw + 6;
          };
          if (critCount > 0) renderPill(`${critCount} CRITICAL`, '#fef2f2', '#b91c1c');
          if (highCount > 0) renderPill(`${highCount} HIGH`, '#fff7ed', '#c2410c');
          renderPill(`${paths.length} attack path${paths.length !== 1 ? 's' : ''}`, '#f1f5f9', '#475569');
          currentY = pillY + pillH + 14;

          // Render each path as a card
          for (let pi = 0; pi < paths.length; pi++) {
            const path = paths[pi];
            const sevColor = ATTACK_SEV_COLOR[path.severity] ?? '#475569';
            const sevBg = ATTACK_SEV_BG[path.severity] ?? '#f8fafc';

            // Reserve at minimum the card header (~50pt); break page if needed
            if (currentY > doc.page.height - 110) { doc.addPage(); currentY = 50; }

            const cardStartY = currentY;
            const cardLeft = 50;
            const cardW = W;

            // Card header background
            doc.rect(cardLeft, cardStartY, cardW, 36).fill(sevBg);
            // Left accent bar
            doc.rect(cardLeft, cardStartY, 4, 36).fill(sevColor);

            // Index circle
            doc.circle(cardLeft + 20, cardStartY + 18, 10).fill(sevColor);
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff')
              .text(`${pi + 1}`, cardLeft + 16, cardStartY + 12, { lineBreak: false });

            // Title
            doc.fontSize(10).font('Helvetica-Bold').fillColor(sevColor)
              .text(path.title, cardLeft + 36, cardStartY + 5, { width: cardW - 130, lineBreak: false });

            // Severity + likelihood chips (right-aligned)
            const chipText = `${path.severity}  ·  ${path.likelihood} likelihood`;
            doc.fontSize(8).font('Helvetica').fillColor(sevColor)
              .text(chipText, cardLeft + 36, cardStartY + 21, { width: cardW - 40, lineBreak: false });

            currentY = cardStartY + 40;

            // Summary
            if (path.summary) {
              if (currentY > doc.page.height - 80) { doc.addPage(); currentY = 50; }
              doc.fontSize(9).font('Helvetica').fillColor('#334155')
                .text(path.summary, cardLeft + 8, currentY, { width: cardW - 16, lineGap: 2 });
              currentY = doc.y + 10;
            }

            // Kill chain steps
            if (path.steps && path.steps.length > 0) {
              if (currentY > doc.page.height - 60) { doc.addPage(); currentY = 50; }
              doc.fontSize(8).font('Helvetica-Bold').fillColor('#94a3b8')
                .text('KILL CHAIN', cardLeft + 8, currentY);
              currentY += 12;

              for (const step of path.steps) {
                if (currentY > doc.page.height - 70) { doc.addPage(); currentY = 50; }

                const lhColor = LIKELIHOOD_COLOR[step.successLikelihood] ?? '#64748b';
                const stepLeft = cardLeft + 8;

                // Step number bubble
                doc.circle(stepLeft + 8, currentY + 7, 7).fill('#e2e8f0');
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569')
                  .text(`${step.stepNumber}`, stepLeft + 5, currentY + 3.5, { lineBreak: false });

                // Step action (bold) + technique (indigo)
                const textX = stepLeft + 22;
                const textW = cardW - 30;
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
                  .text(step.action, textX, currentY, { width: textW - 60, lineBreak: false });

                // Likelihood pill right side
                const lhLabel = step.successLikelihood;
                doc.fontSize(7).font('Helvetica-Bold').fillColor(lhColor)
                  .text(lhLabel, cardLeft + cardW - 55, currentY + 1, { lineBreak: false });

                currentY += 13;
                doc.fontSize(8).font('Helvetica').fillColor('#4f46e5')
                  .text(step.attackTechnique, textX, currentY, { width: textW, lineBreak: false });
                currentY += 12;
                doc.fontSize(8.5).font('Helvetica').fillColor('#475569')
                  .text(step.description, textX, currentY, { width: textW, lineGap: 2 });
                currentY = doc.y + 8;

                // Connector line to next step
                if (step.stepNumber < path.steps.length) {
                  doc.moveTo(stepLeft + 8, currentY - 4).lineTo(stepLeft + 8, currentY + 2)
                    .strokeColor('#cbd5e1').lineWidth(1).stroke();
                }
              }
            }

            // Mitigations
            if (path.mitigations && path.mitigations.length > 0) {
              if (currentY > doc.page.height - 60) { doc.addPage(); currentY = 50; }
              doc.fontSize(8).font('Helvetica-Bold').fillColor('#94a3b8')
                .text('RECOMMENDED MITIGATIONS', cardLeft + 8, currentY);
              currentY += 11;
              for (const m of path.mitigations) {
                if (currentY > doc.page.height - 50) { doc.addPage(); currentY = 50; }
                doc.fontSize(8).font('Helvetica').fillColor('#15803d').text('✓', cardLeft + 8, currentY, { lineBreak: false });
                doc.fillColor('#334155').text(m, cardLeft + 22, currentY, { width: cardW - 30, lineGap: 2 });
                currentY = doc.y + 5;
              }
            }

            // Card bottom border
            doc.moveTo(cardLeft, currentY).lineTo(cardLeft + cardW, currentY)
              .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
            currentY += 14;
          }
        } else {
          // Fallback: narrative / plain text
          const plainContent = attackSim.content
            .replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
            .replace(/^#{1,6}\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/^[-*]\s+/gm, '• ').trim();

          const paragraphs = plainContent.split(/\n{2,}/);
          for (const para of paragraphs) {
            if (currentY > doc.page.height - 60) { doc.addPage(); currentY = 60; }
            const trimmed = para.trim();
            if (!trimmed) continue;
            doc.fontSize(10).font('Helvetica').fillColor('#334155')
              .text(trimmed, 50, currentY, { width: W, lineGap: 3 });
            currentY = doc.y + 10;
          }
        }
      }

      doc.end();
    });
  }
}
