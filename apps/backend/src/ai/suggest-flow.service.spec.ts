import { Test } from '@nestjs/testing';
import { SuggestFlowService } from './suggest-flow.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from './llm.service';

describe('SuggestFlowService', () => {
  let service: SuggestFlowService;
  let prisma: any;
  let llm: any;

  beforeEach(async () => {
    prisma = { project: { findUnique: jest.fn() } };
    llm = { invoke: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SuggestFlowService,
        { provide: PrismaService, useValue: prisma },
        { provide: LlmService, useValue: llm },
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
    expect(llm.invoke).toHaveBeenCalled();
  });

  it('throws on missing DIAGRAM markers', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'p', ownerId: 'user-id', diagrams: [], techStack: [], compliance: [] });
    llm.invoke.mockResolvedValue({ content: 'no markers here' });
    await expect(service.suggest('user-id', { projectId: 'p', flowName: 'Login' } as any)).rejects.toThrow(/DIAGRAM/);
  });
});
