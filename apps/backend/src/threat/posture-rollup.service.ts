import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PostureRollupDiagram {
  diagramId: string;
  name: string;
  version: number;
  score: number;
}

export interface PostureRollupResult {
  projectScore: number | null;
  diagrams: PostureRollupDiagram[];
}

@Injectable()
export class PostureRollupService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(projectId: string, userId: string): Promise<PostureRollupResult> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException();

    const rows = await this.prisma.postureScore.findMany({
      where: { projectId },
      orderBy: { analyzedAt: 'desc' },
      include: { diagram: true },
    });

    const latestByDiagram = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      if (!latestByDiagram.has(r.diagramId)) latestByDiagram.set(r.diagramId, r);
    }

    const diagrams: PostureRollupDiagram[] = Array.from(latestByDiagram.values()).map(r => ({
      diagramId: r.diagramId,
      name: r.diagram?.name ?? '',
      version: r.diagramVersion,
      score: r.score,
    }));

    const projectScore = diagrams.length
      ? Math.round(diagrams.reduce((sum, d) => sum + d.score, 0) / diagrams.length)
      : null;

    return { projectScore, diagrams };
  }
}
