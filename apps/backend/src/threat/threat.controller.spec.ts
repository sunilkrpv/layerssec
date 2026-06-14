import { Test, TestingModule } from '@nestjs/testing';
import { ThreatController } from './threat.controller';
import { ThreatService } from './threat.service';
import { ReportService } from './report.service';
import { PostureRollupService } from './posture-rollup.service';
import { IntelReportService } from './intel-report.service';

// Minimal mocks — only methods exercised by these tests
const mockThreatService = () => ({ listProjectThreats: jest.fn() });
const mockReportService = () => ({});
const mockPostureRollupService = () => ({ compute: jest.fn() });
const mockIntelReportService = () => ({
  generate: jest.fn(),
  list: jest.fn(),
  get: jest.fn(),
});

describe('ThreatController', () => {
  let controller: ThreatController;
  let threatService: { listProjectThreats: jest.Mock };
  let postureRollup: { compute: jest.Mock };
  let intelReportService: { generate: jest.Mock; list: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThreatController],
      providers: [
        { provide: ThreatService, useFactory: mockThreatService },
        { provide: ReportService, useFactory: mockReportService },
        { provide: PostureRollupService, useFactory: mockPostureRollupService },
        { provide: IntelReportService, useFactory: mockIntelReportService },
      ],
    }).compile();

    controller = module.get<ThreatController>(ThreatController);
    threatService = module.get(ThreatService);
    postureRollup = module.get(PostureRollupService);
    intelReportService = module.get(IntelReportService);
  });

  describe('GET projects/:projectId/threats', () => {
    it('passes diagramId filter through to service', async () => {
      jest.spyOn(threatService, 'listProjectThreats').mockResolvedValue({ data: [], total: 0, page: 0, limit: 10, summary: {} } as any);
      await controller.listProjectThreats('p', 'u', undefined, undefined, undefined, undefined, undefined, undefined, 'd1');
      expect(threatService.listProjectThreats).toHaveBeenCalledWith(
        'p', 'u',
        expect.objectContaining({ diagramId: 'd1' }),
      );
    });
  });

  describe('GET projects/:projectId/posture-rollup', () => {
    it('returns rollup result for owner', async () => {
      jest.spyOn(postureRollup, 'compute').mockResolvedValue({ projectScore: 75, diagrams: [] });
      const result = await controller.getPostureRollup('proj-id', 'user-id');
      expect(result).toEqual({ projectScore: 75, diagrams: [] });
      expect(postureRollup.compute).toHaveBeenCalledWith('proj-id', 'user-id');
    });

    it('delegates projectId and userId to PostureRollupService.compute', async () => {
      const mockResult = {
        projectScore: 88,
        diagrams: [{ diagramId: 'd1', name: 'API', version: 3, score: 88 }],
      };
      jest.spyOn(postureRollup, 'compute').mockResolvedValue(mockResult);
      const result = await controller.getPostureRollup('project-uuid', 'owner-uuid');
      expect(postureRollup.compute).toHaveBeenCalledWith('project-uuid', 'owner-uuid');
      expect(result).toEqual(mockResult);
    });
  });

  describe('intel reports', () => {
    it('POST /projects/:projectId/intel-report creates a report', async () => {
      jest.spyOn(intelReportService, 'generate').mockResolvedValue({ id: 'r1' } as any);
      const res = await controller.createIntelReport('p', 'u');
      expect(res).toEqual({ id: 'r1' });
      expect(intelReportService.generate).toHaveBeenCalledWith('p', 'u');
    });

    it('GET /projects/:projectId/intel-reports lists reports', async () => {
      jest.spyOn(intelReportService, 'list').mockResolvedValue([{ id: 'r1' }] as any);
      const res = await controller.listIntelReports('p', 'u');
      expect(res).toHaveLength(1);
      expect(intelReportService.list).toHaveBeenCalledWith('p', 'u');
    });

    it('GET /intel-reports/:id returns one', async () => {
      jest.spyOn(intelReportService, 'get').mockResolvedValue({ id: 'r1' } as any);
      const res = await controller.getIntelReport('r1', 'u');
      expect(res?.id).toBe('r1');
      expect(intelReportService.get).toHaveBeenCalledWith('r1', 'u');
    });
  });
});
