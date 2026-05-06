import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiJobStatus, AiJobType, Prisma } from '@prisma/client';

const DATE_RANGE_MS: Record<string, number> = {
  '1h': 3_600_000,
  '1d': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
};

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(jobId: string, userId: string) {
    const job = await this.prisma.aiJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.userId !== userId) throw new ForbiddenException();
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      resultRef: job.resultRef,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };
  }

  async cancel(jobId: string, userId: string) {
    const job = await this.prisma.aiJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.userId !== userId) throw new ForbiddenException();
    if (job.status !== AiJobStatus.PENDING && job.status !== AiJobStatus.RUNNING) {
      return { success: false, message: 'Job cannot be cancelled in its current state' };
    }
    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: { status: AiJobStatus.CANCELLED, completedAt: new Date() },
    });
    return { success: true };
  }

  async listForUser(userId: string, projectId?: string) {
    return this.prisma.aiJob.findMany({
      where: { userId, ...(projectId ? { projectId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        resultRef: true,
        errorMessage: true,
        projectId: true,
        diagramId: true,
        layerId: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    });
  }

  async listActivity(
    userId: string,
    filters: {
      types?: string[];
      statuses?: string[];
      dateRange?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Prisma.AiJobWhereInput = { userId };

    if (filters.types?.length) {
      where.type = { in: filters.types as AiJobType[] };
    }
    if (filters.statuses?.length) {
      where.status = { in: filters.statuses as AiJobStatus[] };
    }
    if (filters.dateRange && DATE_RANGE_MS[filters.dateRange]) {
      where.createdAt = { gte: new Date(Date.now() - DATE_RANGE_MS[filters.dateRange]) };
    }
    if (filters.search) {
      // UUID fields don't support contains — search on diagramId (varchar) only
      where.diagramId = { contains: filters.search, mode: 'insensitive' };
    }

    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    const [jobs, total] = await Promise.all([
      this.prisma.aiJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          status: true,
          progress: true,
          resultRef: true,
          errorMessage: true,
          projectId: true,
          diagramId: true,
          layerId: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          project: { select: { name: true } },
        },
      }),
      this.prisma.aiJob.count({ where }),
    ]);

    return {
      total,
      jobs: jobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        progress: j.progress,
        resultRef: j.resultRef,
        errorMessage: j.errorMessage,
        projectId: j.projectId,
        projectName: j.project?.name ?? null,
        diagramId: j.diagramId,
        layerId: j.layerId,
        createdAt: j.createdAt,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
      })),
    };
  }
}
