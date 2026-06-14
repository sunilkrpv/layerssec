import { Test } from '@nestjs/testing';
import { PostureRollupService } from './posture-rollup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PostureRollupService', () => {
  let service: PostureRollupService;
  let prisma: { project: { findUnique: jest.Mock }; postureScore: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ ownerId: 'user-id' }) },
      postureScore: { findMany: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PostureRollupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(PostureRollupService);
  });

  it('returns equal-weight mean across diagrams', async () => {
    prisma.postureScore.findMany.mockResolvedValue([
      { diagramId: 'd1', score: 80, diagramVersion: 1, analyzedAt: new Date(), diagram: { id: 'd1', name: 'Login' } },
      { diagramId: 'd2', score: 60, diagramVersion: 2, analyzedAt: new Date(), diagram: { id: 'd2', name: 'Checkout' } },
    ]);
    const result = await service.compute('project-id', 'user-id');
    expect(result.projectScore).toBe(70);
    expect(result.diagrams).toHaveLength(2);
  });

  it('returns null projectScore when no scores exist', async () => {
    prisma.postureScore.findMany.mockResolvedValue([]);
    const result = await service.compute('project-id', 'user-id');
    expect(result.projectScore).toBeNull();
    expect(result.diagrams).toHaveLength(0);
  });

  it('uses only latest score per diagram', async () => {
    prisma.postureScore.findMany.mockResolvedValue([
      { diagramId: 'd1', score: 90, diagramVersion: 2, analyzedAt: new Date('2026-06-13'), diagram: { id: 'd1', name: 'Login' } },
      { diagramId: 'd1', score: 60, diagramVersion: 1, analyzedAt: new Date('2026-06-10'), diagram: { id: 'd1', name: 'Login' } },
    ]);
    const result = await service.compute('project-id', 'user-id');
    expect(result.projectScore).toBe(90);
    expect(result.diagrams).toHaveLength(1);
  });

  it('throws NotFoundException when project does not exist', async () => {
    prisma.project.findUnique.mockResolvedValue(null);
    prisma.postureScore.findMany.mockResolvedValue([]);
    await expect(service.compute('missing-id', 'user-id')).rejects.toThrow('Project not found');
  });

  it('throws ForbiddenException when user does not own project', async () => {
    prisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
    prisma.postureScore.findMany.mockResolvedValue([]);
    await expect(service.compute('project-id', 'user-id')).rejects.toThrow();
  });
});
