import { Test } from '@nestjs/testing';
import { IntelReportService } from './intel-report.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

describe('IntelReportService', () => {
  let service: IntelReportService;
  let prisma: any;
  let ai: any;

  beforeEach(async () => {
    prisma = {
      project: { findUnique: jest.fn() },
      threat: { findMany: jest.fn() },
      projectIntelReport: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    };
    ai = { generateIntelReport: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        IntelReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: ai },
      ],
    }).compile();
    service = moduleRef.get(IntelReportService);
  });

  it('builds snapshot from project + per-diagram threat summaries and persists report', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 'p', name: 'Acme', description: '', techStack: ['Node'], environment: 'PROD',
      compliance: ['SOC2'], notes: 'x', diagrams: [
        { id: 'd1', name: 'Login', version: 1 },
      ],
    });
    prisma.threat.findMany.mockResolvedValue([
      { id: 't1', severity: 'CRITICAL', strideCategory: 'SPOOFING', title: 'Token reuse', threatModel: { diagramId: 'd1', diagramVersion: 1 } },
    ]);
    ai.generateIntelReport.mockResolvedValue('## Threat Landscape\n…');
    prisma.projectIntelReport.create.mockResolvedValue({ id: 'r1' });

    const result = await service.generate('p', 'user-id');

    expect(ai.generateIntelReport).toHaveBeenCalledWith(expect.objectContaining({
      project: expect.objectContaining({ name: 'Acme', techStack: ['Node'] }),
      diagrams: expect.arrayContaining([expect.objectContaining({ diagramId: 'd1', topThreats: expect.any(Array) })]),
    }));
    expect(prisma.projectIntelReport.create).toHaveBeenCalled();
    expect(result.id).toBe('r1');
  });

  it('caps top threats per diagram to 20', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 'p', name: 'x', description: '', techStack: [], environment: null, compliance: [], notes: null,
      diagrams: [{ id: 'd1', name: 'x', version: 1 }],
    });
    prisma.threat.findMany.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({
        id: `t${i}`, severity: 'HIGH', strideCategory: 'TAMPERING', title: 'x',
        threatModel: { diagramId: 'd1', diagramVersion: 1 },
      })),
    );
    ai.generateIntelReport.mockResolvedValue('out');
    prisma.projectIntelReport.create.mockResolvedValue({ id: 'r' });

    await service.generate('p', 'u');

    const passed = ai.generateIntelReport.mock.calls[0][0];
    expect(passed.diagrams[0].topThreats).toHaveLength(20);
  });

  it('list throws ForbiddenException when project owner mismatches', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'p', ownerId: 'other-user' });
    await expect(service.list('p', 'requesting-user')).rejects.toThrow('Forbidden');
  });

  it('get throws ForbiddenException when project owner mismatches', async () => {
    prisma.projectIntelReport.findUnique.mockResolvedValue({ id: 'r1', projectId: 'p' });
    prisma.project.findUnique.mockResolvedValue({ id: 'p', ownerId: 'other-user' });
    await expect(service.get('r1', 'requesting-user')).rejects.toThrow('Forbidden');
  });
});
