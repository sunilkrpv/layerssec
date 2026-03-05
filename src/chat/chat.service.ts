import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessageItemDto } from './dto/save-chat-messages.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async saveMessages(
    projectId: string,
    userId: string,
    messages: ChatMessageItemDto[],
  ) {
    await this.verifyAccess(projectId, userId);
    await this.prisma.chatMessage.createMany({
      data: messages.map((m) => ({
        projectId,
        role: m.role,
        content: m.content,
        layerId: m.layerId ?? null,
        layerName: m.layerName ?? null,
      })),
    });
  }

  async getHistory(projectId: string, userId: string) {
    await this.verifyAccess(projectId, userId);
    return this.prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async verifyAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException();
  }
}
