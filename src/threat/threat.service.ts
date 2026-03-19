import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IdentifiedBy, ThreatStatus, ThreatSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveThreatModelDto } from './dto/save-threat-model.dto';
import { UpdateThreatDto } from './dto/update-threat.dto';
import { CreateThreatDto } from './dto/create-threat.dto';
import { SaveAttackSimulationDto } from '../ai/dto/attack-mind.dto';

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
            identifiedBy: IdentifiedBy.AI,
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

  // ── Create a user-defined threat in an existing threat model ─────────────

  async createThreat(threatModelId: string, userId: string, dto: CreateThreatDto) {
    await this.verifyThreatModelOwnership(threatModelId, userId);

    return this.prisma.threat.create({
      data: {
        threatModelId,
        targetId: dto.targetId,
        targetType: dto.targetType,
        targetLabel: dto.targetLabel,
        layerId: dto.layerId,
        strideCategory: dto.strideCategory,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        mitigationNotes: dto.mitigationNotes,
        identifiedBy: IdentifiedBy.USER,
        createdByUserId: userId,
      },
    });
  }

  // ── List threats for dashboard — paginated + filtered ────────────────────

  async listProjectThreats(
    projectId: string,
    userId: string,
    params: {
      page: number;
      limit: number;
      search?: string;
      severity?: string;
      status?: string;
      strideCategory?: string;
    },
  ) {
    await this.verifyProjectOwnership(projectId, userId);

    const where: Record<string, unknown> = { threatModel: { projectId } };
    if (params.severity) where['severity'] = params.severity as ThreatSeverity;
    if (params.status) where['status'] = params.status as ThreatStatus;
    if (params.strideCategory) where['strideCategory'] = params.strideCategory;
    if (params.search) {
      where['OR'] = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { targetLabel: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total, allForSummary] = await Promise.all([
      this.prisma.threat.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        skip: params.page * params.limit,
        take: params.limit,
        include: {
          threatModel: {
            select: { id: true, name: true, diagramVersion: true, savedAt: true, diagramId: true },
          },
        },
      }),
      this.prisma.threat.count({ where }),
      // Summary always counts across all threats, ignoring current filters
      this.prisma.threat.findMany({
        where: { threatModel: { projectId } },
        select: { severity: true, status: true },
      }),
    ]);

    const summary = {
      totalActive: allForSummary.filter((t) => t.status !== 'FALSE_POSITIVE').length,
      mitigated: allForSummary.filter((t) => t.status === ThreatStatus.MITIGATED || t.status === ThreatStatus.ACCEPTED).length,
      critical: allForSummary.filter((t) => t.severity === ThreatSeverity.CRITICAL && t.status !== 'FALSE_POSITIVE').length,
      high: allForSummary.filter((t) => t.severity === ThreatSeverity.HIGH && t.status !== 'FALSE_POSITIVE').length,
    };

    return { data, total, page: params.page, limit: params.limit, summary };
  }

  // ── Update a single threat's fields ──────────────────────────────────────

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
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.targetLabel !== undefined && { targetLabel: dto.targetLabel }),
        ...(dto.strideCategory !== undefined && { strideCategory: dto.strideCategory }),
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

  // ── Posture Score History ─────────────────────────────────────────────────

  async listPostureHistory(projectId: string, userId: string) {
    await this.verifyProjectOwnership(projectId, userId);

    return this.prisma.postureScore.findMany({
      where: { projectId },
      orderBy: { analyzedAt: 'desc' },
      select: {
        id: true,
        diagramVersion: true,
        score: true,
        dimensions: true,
        summary: true,
        topRecs: true,
        useExtended: true,
        analyzedAt: true,
      },
    });
  }

  // ── Attack Simulations ────────────────────────────────────────────────────

  async saveAttackSimulation(projectId: string, userId: string, dto: SaveAttackSimulationDto) {
    await this.verifyProjectOwnership(projectId, userId);

    return this.prisma.attackSimulation.create({
      data: {
        projectId,
        diagramId: dto.diagramId,
        name: dto.name,
        entryPointId: dto.entryPointId,
        paths: dto.paths as unknown as import('@prisma/client').Prisma.InputJsonValue,
        savedBy: userId,
      },
    });
  }

  async listAttackSimulations(projectId: string, userId: string) {
    await this.verifyProjectOwnership(projectId, userId);

    return this.prisma.attackSimulation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        diagramId: true,
        entryPointId: true,
        paths: true,
        savedBy: true,
        createdAt: true,
      },
    });
  }

  async deleteAttackSimulation(simulationId: string, userId: string) {
    const sim = await this.prisma.attackSimulation.findUnique({
      where: { id: simulationId },
      include: { project: { select: { ownerId: true } } },
    });
    if (!sim) throw new NotFoundException('Attack simulation not found');
    if (sim.project.ownerId !== userId) throw new ForbiddenException();

    await this.prisma.attackSimulation.delete({ where: { id: simulationId } });
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
