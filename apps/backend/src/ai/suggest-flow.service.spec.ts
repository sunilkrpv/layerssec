import { Test } from '@nestjs/testing';
import { SuggestFlowService } from './suggest-flow.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from './llm.service';
import { UserSettingsService } from '../user-settings/user-settings.service';

describe('SuggestFlowService', () => {
  let service: SuggestFlowService;
  let prisma: any;
  let llm: any;
  let userSettings: any;

  beforeEach(async () => {
    prisma = { project: { findUnique: jest.fn() } };
    llm = { invoke: jest.fn() };
    userSettings = {
      getAiSettings: jest.fn().mockResolvedValue({ provider: 'ANTHROPIC', model: 'claude-sonnet-4-6' }),
      getDecryptedApiKey: jest.fn().mockResolvedValue('sk-test'),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SuggestFlowService,
        { provide: PrismaService, useValue: prisma },
        { provide: LlmService, useValue: llm },
        { provide: UserSettingsService, useValue: userSettings },
      ],
    }).compile();
    service = moduleRef.get(SuggestFlowService);
  });

  it('renders prompt with project context + existing flows and extracts diagram JSON', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 'p', name: 'Acme', description: 'shop',
      techStack: ['Node'], environment: 'PROD', compliance: ['PCI'], notes: null,
      diagrams: [{ name: 'Checkout' }],
    });
    llm.invoke.mockResolvedValue({ content: 'intro ---DIAGRAM---\n{"nodes":[{"id":"n1"}],"edges":[]}\n---DIAGRAM--- outro' });
    const result = await service.suggest('user-id', { projectId: 'p', flowName: 'Login' } as any);
    expect(result.diagram.nodes).toEqual([{ id: 'n1' }]);
    // Regression: suggest-flow must pass the per-user LLM config (provider + decrypted
    // key) so resolveLlm builds a client instead of falling back to the null env client.
    expect(llm.invoke).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ provider: 'anthropic', apiKey: 'sk-test', promptName: 'suggest-flow' }),
    );
  });

  it('throws on missing DIAGRAM markers', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'p', ownerId: 'user-id', diagrams: [], techStack: [], compliance: [] });
    llm.invoke.mockResolvedValue({ content: 'no markers here' });
    await expect(service.suggest('user-id', { projectId: 'p', flowName: 'Login' } as any)).rejects.toThrow(/DIAGRAM/);
  });
});
