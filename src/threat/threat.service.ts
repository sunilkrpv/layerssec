import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ThreatStatus, ThreatSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveThreatModelDto } from './dto/save-threat-model.dto';
import { UpdateThreatDto } from './dto/update-threat.dto';

@Injectable()
export class ThreatService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Save a new threat model snapshot (explicit user action) ──────────────

  async saveThreatModel(projectId: string, userId: string, dto: SaveThreatModelDto) {
    await this.verifyProjectOwnership(projectId, userId);

    return this.prisma.$transaction(async (tx) => {
      const threatModel = await tx.threatModel.create({
        data: {
          projectId,
          diagramId: dto.diagramId,
          diagramVersion: dto.diagramVersion,
          snapshotData: dto.snapshotData,
          name: dto.name ?? 'Threat Analysis',
          savedBy: userId,
        },
      });

      if (dto.threats.length > 0) {
        await tx.threat.createMany({
          data: dto.threats.map((t) => ({
            threatModelId: threatModel.id,
            targetId: t.targetId,
            targetType: t.targetType,
            targetLabel: t.targetLabel,
            layerId: t.layerId,
            strideCategory: t.strideCategory,
            title: t.title,
            description: t.description,
            severity: t.severity,
          })),
        });
      }

      return tx.threatModel.findUnique({
        where: { id: threatModel.id },
        include: { threats: true },
      });
    });
  }

  // ── List all saved threat models for a project (summary only) ────────────

  async listThreatModels(projectId: string, userId: string) {
    await this.verifyProjectOwnership(projectId, userId);

    const models = await this.prisma.threatModel.findMany({
      where: { projectId },
      orderBy: { savedAt: 'desc' },
      include: {
        threats: {
          select: { severity: true, status: true },
        },
      },
    });

    return models.map((m) => ({
      id: m.id,
      name: m.name,
      diagramVersion: m.diagramVersion,
      savedAt: m.savedAt,
      threatCount: m.threats.length,
      severitySummary: this.buildSeveritySummary(m.threats),
      mitigatedCount: m.threats.filter((t) => t.status === ThreatStatus.MITIGATED || t.status === ThreatStatus.ACCEPTED).length,
    }));
  }

  // ── Get a single saved threat model with all threats ─────────────────────

  async getThreatModel(threatModelId: string, userId: string) {
    const model = await this.prisma.threatModel.findUnique({
      where: { id: threatModelId },
      include: {
        threats: { orderBy: [{ severity: 'asc' }, { strideCategory: 'asc' }] },
        project: { select: { ownerId: true } },
      },
    });

    if (!model) throw new NotFoundException('Threat model not found');
    if (model.project.ownerId !== userId) throw new ForbiddenException();

    const { project: _, ...rest } = model;
    return rest;
  }

  // ── Delete a saved threat model ───────────────────────────────────────────

  async deleteThreatModel(threatModelId: string, userId: string) {
    await this.verifyThreatModelOwnership(threatModelId, userId);
    await this.prisma.threatModel.delete({ where: { id: threatModelId } });
  }

  // ── Update a single threat's status / notes / severity ───────────────────

  async updateThreat(
    threatModelId: string,
    threatId: string,
    userId: string,
    dto: UpdateThreatDto,
  ) {
    await this.verifyThreatModelOwnership(threatModelId, userId);

    const threat = await this.prisma.threat.findUnique({ where: { id: threatId } });
    if (!threat || threat.threatModelId !== threatModelId) {
      throw new NotFoundException('Threat not found');
    }

    return this.prisma.threat.update({
      where: { id: threatId },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.mitigationNotes !== undefined && { mitigationNotes: dto.mitigationNotes }),
        ...(dto.severity !== undefined && { severity: dto.severity }),
      },
    });
  }

  // ── Delete a single threat from a saved model ─────────────────────────────

  async deleteThreat(threatModelId: string, threatId: string, userId: string) {
    await this.verifyThreatModelOwnership(threatModelId, userId);

    const threat = await this.prisma.threat.findUnique({ where: { id: threatId } });
    if (!threat || threat.threatModelId !== threatModelId) {
      throw new NotFoundException('Threat not found');
    }

    await this.prisma.threat.delete({ where: { id: threatId } });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async verifyProjectOwnership(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException();
  }

  private async verifyThreatModelOwnership(threatModelId: string, userId: string) {
    const model = await this.prisma.threatModel.findUnique({
      where: { id: threatModelId },
      include: { project: { select: { ownerId: true } } },
    });
    if (!model) throw new NotFoundException('Threat model not found');
    if (model.project.ownerId !== userId) throw new ForbiddenException();
  }

  private buildSeveritySummary(threats: { severity: ThreatSeverity }[]) {
    const summary: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };
    for (const t of threats) {
      summary[t.severity] = (summary[t.severity] ?? 0) + 1;
    }
    return summary;
  }
}
