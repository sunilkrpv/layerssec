import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { UpdateDiagramDto } from './dto/update-diagram.dto';

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
    await this.findById(id, userId);

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

  private async verifyProjectAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException();
  }
}
