import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, IntelSnapshot } from '../ai/ai.service';

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
const TOP_THREATS_PER_DIAGRAM = 20;

@Injectable()
export class IntelReportService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  async generate(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { diagrams: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    // ownership check — services own the boundary
    if ((project as any).ownerId && (project as any).ownerId !== userId) {
      throw new ForbiddenException();
    }

    const threats = await this.prisma.threat.findMany({
      where: { threatModel: { projectId } },
      include: { threatModel: { select: { diagramId: true, diagramVersion: true } } },
    });

    const byDiagram = new Map<string, typeof threats>();
    for (const t of threats) {
      const k = t.threatModel.diagramId;
      const arr = byDiagram.get(k) ?? [];
      arr.push(t);
      byDiagram.set(k, arr);
    }

    const diagramsPayload = project.diagrams.map(d => {
      const list = (byDiagram.get(d.id) ?? []).slice().sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
      );
      const counts = list.reduce<Record<string, number>>((acc, t) => {
        acc[t.severity] = (acc[t.severity] ?? 0) + 1;
        return acc;
      }, {});
      return {
        diagramId: d.id,
        name: d.name,
        version: d.version,
        severityCounts: counts,
        topThreats: list.slice(0, TOP_THREATS_PER_DIAGRAM).map(t => ({
          title: t.title, severity: t.severity, stride: t.strideCategory,
        })),
      };
    });

    const snapshot: IntelSnapshot = {
      project: {
        name: project.name,
        description: project.description,
        techStack: project.techStack,
        environment: project.environment as any,
        compliance: project.compliance,
        notes: project.notes,
      },
      diagrams: diagramsPayload,
    };

    const content = await this.ai.generateIntelReport(snapshot);

    return this.prisma.projectIntelReport.create({
      data: {
        projectId,
        snapshotData: snapshot as any,
        content,
        diagramRefs: project.diagrams.map(d => ({ diagramId: d.id, version: d.version })) as any,
        generatedBy: userId,
      },
    });
  }

  async list(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if ((project as any).ownerId && (project as any).ownerId !== userId) {
      throw new ForbiddenException();
    }
    return this.prisma.projectIntelReport.findMany({
      where: { projectId },
      orderBy: { generatedAt: 'desc' },
      select: { id: true, generatedAt: true, generatedBy: true },
    });
  }

  async get(id: string, userId: string) {
    const report = await this.prisma.projectIntelReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Intel report not found');
    const project = await this.prisma.project.findUnique({ where: { id: (report as any).projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if ((project as any).ownerId && (project as any).ownerId !== userId) {
      throw new ForbiddenException();
    }
    return report;
  }
}
