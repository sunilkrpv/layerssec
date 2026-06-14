import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AiService, IntelSnapshot } from './ai.service';
import { LlmService } from './llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { RagContextService } from '../rag/rag-context.service';
import { RagIndexingService } from '../rag/rag-indexing.service';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { THREAT_ANALYSIS_QUEUE, POSTURE_SCORE_QUEUE, ATTACK_SIM_QUEUE } from '../jobs/queues';

describe('AiService', () => {
  let service: AiService;
  let llm: jest.Mocked<LlmService>;
  let prisma: {
    diagram: { findUnique: jest.Mock };
    aiJob: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    const llmMock: Partial<jest.Mocked<LlmService>> = {
      invoke: jest.fn(),
      stream: jest.fn(),
      streamConversation: jest.fn(),
      invokeWithThinking: jest.fn(),
    };

    prisma = {
      diagram: { findUnique: jest.fn() },
      aiJob: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: LlmService, useValue: llmMock },
        { provide: PrismaService, useValue: prisma },
        { provide: ChatService, useValue: {} },
        { provide: RagContextService, useValue: {} },
        { provide: RagIndexingService, useValue: {} },
        { provide: UserSettingsService, useValue: {} },
        { provide: OnboardingService, useValue: {} },
        { provide: getQueueToken(THREAT_ANALYSIS_QUEUE), useValue: {} },
        { provide: getQueueToken(POSTURE_SCORE_QUEUE), useValue: {} },
        { provide: getQueueToken(ATTACK_SIM_QUEUE), useValue: {} },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    llm = module.get(LlmService);
  });

  describe('getPipelineStatusForDiagram', () => {
    it('returns latest threat + posture jobs scoped to the diagram', async () => {
      prisma.diagram.findUnique.mockResolvedValue({
        id: 'd1',
        projectId: 'p',
        project: { ownerId: 'u' },
      });
      prisma.aiJob.findFirst
        .mockResolvedValueOnce({ id: 'j1', status: 'COMPLETED' })  // threat
        .mockResolvedValueOnce({ id: 'j2', status: 'COMPLETED' }); // posture

      const result = await service.getPipelineStatusForDiagram('u', 'd1');

      expect(result.threatJob?.id).toBe('j1');
      expect(result.postureJob?.id).toBe('j2');
      expect(prisma.aiJob.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ diagramId: 'd1' }),
      }));
    });

    it('throws NotFoundException when diagram is missing', async () => {
      prisma.diagram.findUnique.mockResolvedValue(null);
      await expect(service.getPipelineStatusForDiagram('u', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when diagram owner mismatches', async () => {
      prisma.diagram.findUnique.mockResolvedValue({
        id: 'd1',
        projectId: 'p',
        project: { ownerId: 'other' },
      });
      await expect(service.getPipelineStatusForDiagram('u', 'd1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('generateIntelReport', () => {
    it('formats snapshot into intel prompt and invokes llm', async () => {
      llm.invoke.mockResolvedValue({
        content: 'report-content',
        tokensUsed: 100,
        inputTokens: 80,
        outputTokens: 20,
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
      });

      const snapshot: IntelSnapshot = {
        project: {
          name: 'Acme',
          description: '',
          techStack: ['Node'],
          environment: 'PROD',
          compliance: ['SOC2'],
          notes: null,
        },
        diagrams: [
          {
            diagramId: 'd1',
            name: 'Login',
            version: 1,
            severityCounts: { HIGH: 2 },
            topThreats: [],
          },
        ],
      };

      const content = await service.generateIntelReport(snapshot);

      expect(content).toBe('report-content');

      expect(llm.invoke).toHaveBeenCalledTimes(1);
      const [systemPrompt, userMessage, config] = llm.invoke.mock.calls[0];
      expect(config?.promptName).toBe('intel-synthesis');
      expect(userMessage).toContain('Acme');
      expect(userMessage).toContain('Login');
    });
  });
});
