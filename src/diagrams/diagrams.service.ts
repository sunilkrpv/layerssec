import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { UpdateDiagramDto } from './dto/update-diagram.dto';
import { PublishDiagramDto } from './dto/publish-diagram.dto';
import { CheckoutDto } from './dto/checkout.dto';

@Injectable()
export class DiagramsService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, userId: string, dto: CreateDiagramDto) {
    await this.verifyProjectAccess(projectId, userId);

    return this.prisma.diagram.create({
      data: {
        name: dto.name,
        type: dto.type,
        canvasData: dto.canvasData ?? {},
        projectId,
        status: 'draft',
      },
    });
  }

  async findById(id: string, userId: string) {
    const diagram = await this.prisma.diagram.findUnique({
      where: { id },
      include: { project: { select: { ownerId: true, isPublic: true } } },
    });
    if (!diagram) throw new NotFoundException('Diagram not found');
    if (diagram.project.ownerId !== userId && !diagram.project.isPublic) {
      throw new ForbiddenException();
    }
    return diagram;
  }

  async update(id: string, userId: string, dto: UpdateDiagramDto) {
    const found = await this.findById(id, userId);
    if (found.status === 'published') {
      throw new ForbiddenException('Cannot edit a published diagram');
    }

    return this.prisma.diagram.update({
      where: { id },
      data: {
        ...dto,
        version: { increment: 1 },
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findById(id, userId);
    return this.prisma.diagram.delete({ where: { id } });
  }

  // ── Versioning ────────────────────────────────────────────────────────────

  async publish(id: string, userId: string, dto: PublishDiagramDto) {
    const diagram = await this.findById(id, userId);
    if (diagram.status === 'published') {
      throw new BadRequestException('Diagram is already published');
    }

    return this.prisma.diagram.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        publishComment: dto.comment ?? null,
      },
    });
  }

  async checkout(projectId: string, userId: string, dto: CheckoutDto) {
    await this.verifyProjectAccess(projectId, userId);

    // Check if a draft already exists for this project
    const existingDraft = await this.prisma.diagram.findFirst({
      where: { projectId, status: 'draft' },
    });
    if (existingDraft) {
      throw new ConflictException({
        message: 'DRAFT_EXISTS',
        existingDraftId: existingDraft.id,
      });
    }

    // Verify source diagram belongs to this project and is published
    const source = await this.findById(dto.fromDiagramId, userId);
    if (source.projectId !== projectId) {
      throw new ForbiddenException('Source diagram does not belong to this project');
    }
    if (source.status !== 'published') {
      throw new BadRequestException('Can only check out from a published version');
    }

    return this.prisma.diagram.create({
      data: {
        name: 'Draft',
        type: source.type,
        canvasData: source.canvasData as object,
        projectId,
        status: 'draft',
      },
    });
  }

  async getDraft(projectId: string, userId: string) {
    await this.verifyProjectAccess(projectId, userId);
    return this.prisma.diagram.findFirst({
      where: { projectId, status: 'draft' },
    }) ?? null;
  }

  async listVersions(projectId: string, userId: string) {
    await this.verifyProjectAccess(projectId, userId);

    const diagrams = await this.prisma.diagram.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    // Assign versionNumber only to published entries (sequential by createdAt)
    let versionCounter = 0;
    return diagrams.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      versionNumber: d.status === 'published' ? ++versionCounter : undefined,
      publishComment: d.publishComment,
      publishedAt: d.publishedAt,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
    }));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async verifyProjectAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException();
  }
}
