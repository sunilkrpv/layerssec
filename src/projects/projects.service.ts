import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RagIndexingService } from '../rag/rag-indexing.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const STRIDE_MAP: Record<string, string> = {
  SPOOFING: 'S',
  TAMPERING: 'T',
  REPUDIATION: 'R',
  INFORMATION_DISCLOSURE: 'I',
  DENIAL_OF_SERVICE: 'D',
  ELEVATION_OF_PRIVILEGE: 'E',
};

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private ragIndexing: RagIndexingService,
  ) {}

  async findAllByUser(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { ownerId: userId },
      include: {
        _count: {
          select: {
            diagrams: { where: { status: 'published' } },
          },
        },
        diagrams: {
          where: { status: 'draft' },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((p) => {
      const { diagrams, _count, ...rest } = p;
      return {
        ...rest,
        hasDraft: diagrams.length > 0,
        draftId: diagrams[0]?.id ?? null,
        publishedCount: _count.diagrams,
      };
    });
  }

  async findById(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        diagrams: {
          select: { id: true, name: true, type: true, thumbnail: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId && !project.isPublic) {
      throw new ForbiddenException();
    }
    return project;
  }

  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { ...dto, ownerId: userId },
    });
  }

  async update(id: string, userId: string, dto: UpdateProjectDto) {
    await this.ensureOwnership(id, userId);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.ensureOwnership(id, userId);
    // Clean up ChromaDB context before deleting from DB — non-blocking, errors swallowed
    this.ragIndexing.deleteProjectContext(id, userId).catch(() => {});
    return this.prisma.project.delete({ where: { id } });
  }

  /** GET /projects/summary — all projects with latest security metadata for sidebar */
  async getSummary(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { ownerId: userId },
      include: {
        postureScores: {
          take: 1,
          orderBy: { analyzedAt: 'desc' },
          select: { score: true },
        },
        threatModels: {
          select: {
            threats: {
              where: { status: { in: ['IDENTIFIED', 'IN_PROGRESS'] } },
              select: { severity: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((p) => {
      const { postureScores, threatModels, ...rest } = p;
      const openThreats = threatModels.flatMap((tm) => tm.threats);
      return {
        ...rest,
        latestPostureScore: postureScores[0]?.score ?? null,
        openThreatCount: openThreats.length,
        criticalThreatCount: openThreats.filter((t) => t.severity === 'CRITICAL').length,
        lastActivityAt: p.updatedAt.toISOString(),
      };
    });
  }

  /** GET /projects/:id/overview — per-project security intelligence for Command Center */
  async getOverview(projectId: string, userId: string) {
    await this.ensureOwnership(projectId, userId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      latestPosture,
      weekOldPosture,
      threats,
      attackSimAggregate,
      latestAttackSim,
      draftDiagram,
      recentThreatModel,
      recentChatMsg,
    ] = await Promise.all([
      this.prisma.postureScore.findFirst({
        where: { projectId },
        orderBy: { analyzedAt: 'desc' },
        select: { score: true, layerScores: true, analyzedAt: true },
      }),
      this.prisma.postureScore.findFirst({
        where: { projectId, analyzedAt: { lte: sevenDaysAgo } },
        orderBy: { analyzedAt: 'desc' },
        select: { score: true },
      }),
      this.prisma.threat.findMany({
        where: { threatModel: { projectId } },
        select: { severity: true, strideCategory: true },
      }),
      this.prisma.attackSimulation.aggregate({
        where: { projectId },
        _count: { id: true },
      }),
      this.prisma.attackSimulation.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { name: true, createdAt: true },
      }),
      this.prisma.diagram.findFirst({
        where: { projectId },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], // 'draft' < 'published' alphabetically — draft wins
        select: { canvasData: true, status: true },
      }),
      this.prisma.threatModel.findFirst({
        where: { projectId },
        orderBy: { savedAt: 'desc' },
        select: { savedAt: true, name: true },
      }),
      this.prisma.chatMessage.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    // Posture score section
    const layerScoresRaw = (latestPosture?.layerScores ?? {}) as Record<string, { score?: number; layerName?: string }>;
    const layerCount = Object.keys(layerScoresRaw).length;
    const postureScore = latestPosture
      ? {
          score: latestPosture.score,
          label: latestPosture.score >= 75 ? 'Good' : latestPosture.score >= 50 ? 'Fair' : 'Poor',
          weekDelta: weekOldPosture != null ? latestPosture.score - weekOldPosture.score : null,
          layerCount,
          layerScores: Object.fromEntries(
            Object.entries(layerScoresRaw).map(([id, ls]) => [id, { layerName: ls.layerName ?? id, score: ls.score ?? 0 }]),
          ),
          computedAt: latestPosture.analyzedAt.toISOString(),
        }
      : { score: null, label: null, weekDelta: null, layerCount: 0, layerScores: {}, computedAt: null };

    // Threat counts
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const byStride = { S: 0, T: 0, R: 0, I: 0, D: 0, E: 0 };
    for (const t of threats) {
      const sev = t.severity.toLowerCase() as keyof typeof bySeverity;
      if (sev in bySeverity) bySeverity[sev]++;
      const sk = STRIDE_MAP[t.strideCategory] as keyof typeof byStride;
      if (sk) byStride[sk]++;
    }

    // Layers from canvasData JSON
    let layers: Array<{ layerId: string; layerName: string; postureScore: number | null; threatCount: number; nodeCount: number }> = [];
    if (draftDiagram?.canvasData) {
      const cd = draftDiagram.canvasData as { layers?: Record<string, { id?: string; name?: string; nodes?: unknown[] }> };
      const layerMap = cd.layers ?? {};
      layers = Object.values(layerMap)
        .filter((l) => l.id)
        .map((l) => ({
          layerId: l.id!,
          layerName: l.name || 'Untitled Layer',
          postureScore: layerScoresRaw[l.id!]?.score ?? null,
          threatCount: 0,
          nodeCount: (l.nodes ?? []).length,
        }))
        .sort((a, b) => (a.postureScore ?? 101) - (b.postureScore ?? 101));
    }

    // Recent activity (last 5, sorted newest first)
    const activities: Array<{ type: string; description: string; occurredAt: string }> = [];
    if (recentChatMsg) activities.push({ type: 'ai_generation', description: 'AI diagram generated', occurredAt: recentChatMsg.createdAt.toISOString() });
    if (recentThreatModel) activities.push({ type: 'stride_analysis', description: `STRIDE analysis: ${recentThreatModel.name}`, occurredAt: recentThreatModel.savedAt.toISOString() });
    if (latestPosture) activities.push({ type: 'posture_score', description: `Posture score computed: ${latestPosture.score}/100`, occurredAt: latestPosture.analyzedAt.toISOString() });
    if (latestAttackSim) activities.push({ type: 'attack_simulation', description: `Attack simulation: ${latestAttackSim.name}`, occurredAt: latestAttackSim.createdAt.toISOString() });
    activities.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return {
      project: { id: project!.id, name: project!.name, status: draftDiagram?.status ?? 'draft' },
      postureScore,
      threats: { total: threats.length, bySeverity, byStride },
      attackSims: {
        total: attackSimAggregate._count.id,
        lastRunAt: latestAttackSim?.createdAt.toISOString() ?? null,
        topPathSummary: latestAttackSim?.name ?? null,
      },
      layers,
      recentActivity: activities.slice(0, 5),
    };
  }

  private async ensureOwnership(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException();
  }
}
