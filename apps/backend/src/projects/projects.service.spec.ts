import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { RagIndexingService } from '../rag/rag-indexing.service';
import { OnboardingService } from '../onboarding/onboarding.service';

const mockPrisma = {
  project: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  diagram: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  aiInteraction: {
    deleteMany: jest.fn(),
  },
  postureScore: {
    findFirst: jest.fn(),
  },
  threatModel: {
    findFirst: jest.fn(),
  },
  attackSimulation: {
    aggregate: jest.fn(),
    findFirst: jest.fn(),
  },
  chatMessage: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockRagIndexing = {
  deleteProjectContext: jest.fn().mockResolvedValue(undefined),
};

const mockOnboarding = {
  markFirstProjectCreated: jest.fn().mockResolvedValue(undefined),
};

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: typeof mockPrisma;
  let onboarding: typeof mockOnboarding;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RagIndexingService, useValue: mockRagIndexing },
        { provide: OnboardingService, useValue: mockOnboarding },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prisma = module.get(PrismaService);
    onboarding = module.get(OnboardingService);
  });

  it('persists metadata fields on create', async () => {
    const spy = jest.spyOn(prisma.project, 'create').mockResolvedValue({} as any);
    // markFirstProjectCreated mock to prevent the catch-block log
    jest.spyOn(onboarding, 'markFirstProjectCreated').mockResolvedValue(undefined as any);

    await service.create('user-id', {
      name: 'Acme',
      techStack: ['Node'],
      environment: 'PROD',
      compliance: ['SOC2'],
      notes: 'x',
      repoUrl: 'https://x.example.com',
    } as any);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        techStack: ['Node'],
        environment: 'PROD',
        compliance: ['SOC2'],
        notes: 'x',
        repoUrl: 'https://x.example.com',
        ownerId: 'user-id',
      }),
    }));
  });

  it('passes metadata fields through update', async () => {
    jest.spyOn(prisma.project, 'findUnique').mockResolvedValue({ ownerId: 'user-id' } as any);
    const updateSpy = jest.spyOn(prisma.project, 'update').mockResolvedValue({} as any);

    await service.update('proj-id', 'user-id', {
      environment: 'STAGING',
      compliance: ['PCI'],
    } as any);

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        environment: 'STAGING',
        compliance: ['PCI'],
      }),
    }));
  });
});
