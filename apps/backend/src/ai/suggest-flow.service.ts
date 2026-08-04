import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from './llm.service';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { buildLlmConfigForUser } from './llm-config.util';
import { suggestFlowPrompt } from './prompts/suggest-flow.prompt';
import { SuggestFlowDto } from './dto/suggest-flow.dto';

const DIAGRAM_MARKER = /---DIAGRAM---\s*([\s\S]*?)\s*---DIAGRAM---/;

const SYSTEM_PROMPT =
  'You are a security architect proposing precise Data Flow Diagrams (DFDs) for application security threat modeling.';

@Injectable()
export class SuggestFlowService {
  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
    private userSettings: UserSettingsService,
  ) {}

  async suggest(userId: string, dto: SuggestFlowDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      include: { diagrams: { select: { name: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    if ((project as any).ownerId && (project as any).ownerId !== userId) {
      throw new ForbiddenException();
    }

    const userMessage = await suggestFlowPrompt.format({
      flowName: dto.flowName,
      projectName: project.name,
      projectDescription: project.description ?? '',
      techStack: (project.techStack ?? []).join(', '),
      environment: project.environment ?? '',
      compliance: (project.compliance ?? []).join(', '),
      notes: project.notes ?? '',
      existingFlows: project.diagrams.map((d) => d.name).join(', ') || '(none)',
    });

    const llmConfig = await buildLlmConfigForUser(this.userSettings, userId);
    const response = await this.llm.invoke(SYSTEM_PROMPT, userMessage, {
      ...llmConfig,
      promptName: 'suggest-flow',
    });
    const raw = response.content;
    const m = DIAGRAM_MARKER.exec(raw);
    if (!m) throw new Error('LLM response missing ---DIAGRAM--- markers');
    const diagram = JSON.parse(m[1]);
    return { diagram };
  }
}
