import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.project.delete({ where: { id } });
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
