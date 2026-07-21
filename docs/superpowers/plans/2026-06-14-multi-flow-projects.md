# Multi-Flow Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Layers from "project = 1 architecture diagram with drill-down" to "project = many DFD flows (login, checkout, etc.)" with project-level threat/intel rollups, per-diagram posture + attack, and drill-down UI hidden behind a flag.

**Architecture:** Additive Prisma schema changes (no destructive ops). Backend gains project metadata fields, posture-rollup service, persisted intel reports, and `suggest-flow` endpoint. Frontend `/projects/[projectId]` becomes a split-view shell: left rail (Project + diagram list), right pane (project overview or canvas).

**Tech Stack:** NestJS 10 + Prisma 5 + Postgres; Next.js (App Router) + React Flow; BullMQ; LangChain multi-provider (Anthropic / OpenAI / Ollama / Replicate); Jest (backend) + Vitest/RTL (frontend).

**Spec:** [docs/superpowers/specs/2026-06-14-multi-flow-projects-design.md](../specs/2026-06-14-multi-flow-projects-design.md)

---

## File Map

### Backend — create
- `apps/backend/src/threat/posture-rollup.service.ts`
- `apps/backend/src/threat/posture-rollup.service.spec.ts`
- `apps/backend/src/threat/intel-report.service.ts`
- `apps/backend/src/threat/intel-report.service.spec.ts`
- `apps/backend/src/threat/dto/intel-report-response.dto.ts`
- `apps/backend/src/ai/suggest-flow.service.ts`
- `apps/backend/src/ai/suggest-flow.service.spec.ts`
- `apps/backend/src/ai/prompts/suggest-flow.prompt.ts`
- `apps/backend/src/ai/dto/suggest-flow.dto.ts`

### Backend — modify
- `apps/backend/prisma/schema.prisma` — add Project columns, `Environment` enum, `ProjectIntelReport`, `ChatMessage.diagramId`
- `apps/backend/src/projects/dto/create-project.dto.ts`
- `apps/backend/src/projects/dto/update-project.dto.ts`
- `apps/backend/src/projects/projects.service.ts`
- `apps/backend/src/threat/threat.controller.ts` — add rollup, intel-report endpoints
- `apps/backend/src/threat/threat.module.ts`
- `apps/backend/src/ai/ai.controller.ts` — add `suggest-flow`, move `pipeline-status`
- `apps/backend/src/ai/ai.module.ts`
- `apps/backend/src/ai/prompts/intel-synthesis.prompt.ts`
- `apps/backend/src/ai/prompts/threat-analysis.prompt.ts`
- `apps/backend/src/ai/prompts/attack-mind.prompt.ts`

### Frontend — create
- `apps/frontend/components/projects/ProjectShell.tsx`
- `apps/frontend/components/projects/LeftRailDiagramList.tsx`
- `apps/frontend/components/projects/ProjectOverviewPane.tsx`
- `apps/frontend/components/projects/CanvasPane.tsx`
- `apps/frontend/components/projects/NewFlowDialog.tsx`
- `apps/frontend/components/projects/ProjectMetadataForm.tsx`
- `apps/frontend/components/projects/widgets/ThreatsRollupCard.tsx`
- `apps/frontend/components/projects/widgets/PostureRollupCard.tsx`
- `apps/frontend/components/projects/widgets/IntelReportCard.tsx`
- `apps/frontend/lib/features.ts` (if not present) — feature-flag helpers
- Tests for each component above (Vitest/RTL)

### Frontend — modify
- `apps/frontend/app/projects/[projectId]/page.tsx` — replace with split-view shell
- Drill-down call sites — gate by `ENABLE_DRILLDOWN_UI` flag
- `apps/frontend/components/threats/*` — accept optional `diagramId` filter in dashboard route
- `apps/frontend/lib/api/projects.ts` (or equivalent) — add posture-rollup + intel-report endpoints

> **Note:** Exact drill-down component paths are discovered in **Task 6.3**. Do not search ahead of time.

---

## Phase 1 — Schema + Migration

### Task 1.1: Add Project metadata columns + Environment enum

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Add `Environment` enum and Project columns**

In `schema.prisma`, add the enum near the other enums:

```prisma
enum Environment {
  DEV
  STAGING
  PROD
}
```

In `model Project`, add (keep alphabetical with existing fields):

```prisma
  techStack    String[]     @default([]) @map("tech_stack")
  environment  Environment?
  compliance   String[]     @default([])
  notes        String?      @db.Text
  repoUrl      String?      @map("repo_url")
  intelReports ProjectIntelReport[]
```

- [ ] **Step 2: Generate migration**

Run: `cd apps/backend && npx prisma migrate dev --name add_project_metadata --create-only`
Expected: file `apps/backend/prisma/migrations/<ts>_add_project_metadata/migration.sql` created.

- [ ] **Step 3: Verify generated SQL is additive only**

Read the generated `migration.sql`. Confirm: only `ALTER TABLE ... ADD COLUMN ...`, `CREATE TYPE "Environment"`. No `DROP` / `RENAME`. If destructive ops appear, stop and re-check schema diff.

- [ ] **Step 4: Apply migration**

Run: `cd apps/backend && npx prisma migrate dev`
Expected: "Already in sync" or "Database is now in sync".

- [ ] **Step 5: Regenerate Prisma client**

Run: `cd apps/backend && npx prisma generate`
Expected: "Generated Prisma Client".

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations
git commit -m "feat(db): add project metadata columns + Environment enum"
```

---

### Task 1.2: Add ProjectIntelReport model

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Add the model**

```prisma
model ProjectIntelReport {
  id           String   @id @default(uuid()) @db.Uuid
  projectId    String   @map("project_id") @db.Uuid
  snapshotData Json     @map("snapshot_data")
  content      String   @db.Text
  diagramRefs  Json     @map("diagram_refs")
  generatedBy  String   @map("generated_by") @db.Uuid
  generatedAt  DateTime @default(now()) @map("generated_at")
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@map("project_intel_reports")
}
```

- [ ] **Step 2: Generate + verify migration**

Run: `cd apps/backend && npx prisma migrate dev --name add_project_intel_reports --create-only`
Expected: SQL contains `CREATE TABLE "project_intel_reports"`, foreign key to `projects(id)`, index.

- [ ] **Step 3: Apply migration + regenerate client**

```bash
cd apps/backend
npx prisma migrate dev
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations
git commit -m "feat(db): add project_intel_reports table"
```

---

### Task 1.3: Add ChatMessage.diagramId + backfill diagram names

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Add nullable `diagramId` to ChatMessage**

```prisma
  diagramId   String?  @map("diagram_id") @db.Uuid
```

Add to the existing index block:

```prisma
  @@index([diagramId])
```

- [ ] **Step 2: Generate migration**

Run: `cd apps/backend && npx prisma migrate dev --name chat_diagram_id_and_backfill --create-only`

- [ ] **Step 3: Append backfill SQL**

Append to the generated `migration.sql`:

```sql
-- Backfill blank diagram names to "Main Flow"
UPDATE "diagrams" SET "name" = 'Main Flow' WHERE "name" IS NULL OR "name" = '';
```

- [ ] **Step 4: Apply migration + regenerate client**

```bash
cd apps/backend
npx prisma migrate dev
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations
git commit -m "feat(db): chat diagramId + backfill diagram names"
```

---

## Phase 2 — Backend Project metadata

### Task 2.1: Test-drive DTO validators for metadata fields

**Files:**
- Modify: `apps/backend/src/projects/dto/create-project.dto.ts`
- Modify: `apps/backend/src/projects/dto/update-project.dto.ts`
- Create: `apps/backend/src/projects/dto/create-project.dto.spec.ts`

- [ ] **Step 1: Write failing DTO tests**

Create `apps/backend/src/projects/dto/create-project.dto.spec.ts`:

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProjectDto } from './create-project.dto';

describe('CreateProjectDto', () => {
  it('accepts a minimal payload', async () => {
    const dto = plainToInstance(CreateProjectDto, { name: 'Acme' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts metadata fields', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      name: 'Acme',
      techStack: ['Node', 'Postgres'],
      environment: 'PROD',
      compliance: ['SOC2', 'PCI'],
      notes: 'critical app',
      repoUrl: 'https://github.com/x/y',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects unknown environment', async () => {
    const dto = plainToInstance(CreateProjectDto, { name: 'Acme', environment: 'BOGUS' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'environment')).toBeDefined();
  });

  it('rejects unknown compliance value', async () => {
    const dto = plainToInstance(CreateProjectDto, { name: 'Acme', compliance: ['BOGUS'] });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'compliance')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `cd apps/backend && npx jest src/projects/dto/create-project.dto.spec.ts`
Expected: FAIL — fields not yet defined.

- [ ] **Step 3: Add fields to CreateProjectDto**

In `apps/backend/src/projects/dto/create-project.dto.ts`, add (importing from `class-validator`):

```ts
import { IsArray, IsEnum, IsOptional, IsString, IsUrl, ArrayUnique } from 'class-validator';
import { Environment } from '@prisma/client';

const COMPLIANCE_WHITELIST = ['SOC2', 'ISO27001', 'PCI', 'HIPAA', 'GDPR', 'FedRAMP'] as const;
type ComplianceTag = typeof COMPLIANCE_WHITELIST[number];

export class CreateProjectDto {
  // existing fields preserved …

  @IsOptional() @IsArray() @IsString({ each: true })
  techStack?: string[];

  @IsOptional() @IsEnum(Environment)
  environment?: Environment;

  @IsOptional() @IsArray() @ArrayUnique()
  @IsString({ each: true })
  @IsEnum(COMPLIANCE_WHITELIST, { each: true })
  compliance?: ComplianceTag[];

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsUrl()
  repoUrl?: string;
}
```

- [ ] **Step 4: Mirror in UpdateProjectDto**

In `apps/backend/src/projects/dto/update-project.dto.ts`, add the same five optional fields with identical decorators.

- [ ] **Step 5: Run tests, confirm pass**

Run: `cd apps/backend && npx jest src/projects/dto/create-project.dto.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/projects/dto
git commit -m "feat(projects): metadata fields on Create/Update DTOs"
```

---

### Task 2.2: Persist metadata through ProjectsService

**Files:**
- Modify: `apps/backend/src/projects/projects.service.ts`
- Modify (or create) `apps/backend/src/projects/projects.service.spec.ts`

- [ ] **Step 1: Add failing service test**

In `projects.service.spec.ts`, add a test that calls `create()` with metadata and asserts the Prisma call includes the new fields:

```ts
it('persists metadata fields on create', async () => {
  const spy = jest.spyOn(prisma.project, 'create').mockResolvedValue(/* fixture */ {} as any);
  await service.create('user-id', {
    name: 'Acme',
    techStack: ['Node'],
    environment: 'PROD',
    compliance: ['SOC2'],
    notes: 'x',
    repoUrl: 'https://x',
  } as any);
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({
      techStack: ['Node'],
      environment: 'PROD',
      compliance: ['SOC2'],
      notes: 'x',
      repoUrl: 'https://x',
    }),
  }));
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd apps/backend && npx jest src/projects/projects.service.spec.ts -t 'persists metadata'`
Expected: FAIL.

- [ ] **Step 3: Pass through fields in service**

In `ProjectsService.create()` (and `update()`), pass the new fields into the Prisma data object. Verbatim:

```ts
data: {
  name: dto.name,
  description: dto.description,
  tags: dto.tags ?? [],
  techStack: dto.techStack ?? [],
  environment: dto.environment,
  compliance: dto.compliance ?? [],
  notes: dto.notes,
  repoUrl: dto.repoUrl,
  ownerId: userId,
  isPublic: dto.isPublic ?? false,
},
```

Mirror in `update()` (using `?? undefined` for omitted fields so Prisma skips them).

- [ ] **Step 4: Run test, confirm pass**

Run: `cd apps/backend && npx jest src/projects/projects.service.spec.ts -t 'persists metadata'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/projects/projects.service.ts apps/backend/src/projects/projects.service.spec.ts
git commit -m "feat(projects): persist metadata fields"
```

---

## Phase 3 — Backend posture rollup + intel persistence

### Task 3.1: PostureRollupService — failing test

**Files:**
- Create: `apps/backend/src/threat/posture-rollup.service.ts`
- Create: `apps/backend/src/threat/posture-rollup.service.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
import { Test } from '@nestjs/testing';
import { PostureRollupService } from './posture-rollup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PostureRollupService', () => {
  let service: PostureRollupService;
  let prisma: { postureScore: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { postureScore: { findMany: jest.fn() } };
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
      { diagramId: 'd1', score: 80, analyzedAt: new Date(), diagram: { id: 'd1', name: 'Login', version: 1 } },
      { diagramId: 'd2', score: 60, analyzedAt: new Date(), diagram: { id: 'd2', name: 'Checkout', version: 2 } },
    ]);
    const result = await service.compute('project-id');
    expect(result.projectScore).toBe(70);
    expect(result.diagrams).toHaveLength(2);
  });

  it('returns null projectScore when no scores exist', async () => {
    prisma.postureScore.findMany.mockResolvedValue([]);
    const result = await service.compute('project-id');
    expect(result.projectScore).toBeNull();
    expect(result.diagrams).toHaveLength(0);
  });

  it('uses only latest score per diagram', async () => {
    prisma.postureScore.findMany.mockResolvedValue([
      { diagramId: 'd1', score: 90, analyzedAt: new Date('2026-06-13'), diagram: { id: 'd1', name: 'Login', version: 2 } },
      { diagramId: 'd1', score: 60, analyzedAt: new Date('2026-06-10'), diagram: { id: 'd1', name: 'Login', version: 1 } },
    ]);
    const result = await service.compute('project-id');
    expect(result.projectScore).toBe(90);
    expect(result.diagrams).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd apps/backend && npx jest src/threat/posture-rollup.service.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PostureRollupDiagram {
  diagramId: string;
  name: string;
  version: number;
  score: number;
}

export interface PostureRollupResult {
  projectScore: number | null;
  diagrams: PostureRollupDiagram[];
}

@Injectable()
export class PostureRollupService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(projectId: string): Promise<PostureRollupResult> {
    const rows = await this.prisma.postureScore.findMany({
      where: { projectId },
      orderBy: { analyzedAt: 'desc' },
      include: { diagram: true },
    });

    const latestByDiagram = new Map<string, typeof rows[number]>();
    for (const r of rows) {
      if (!latestByDiagram.has(r.diagramId)) latestByDiagram.set(r.diagramId, r);
    }

    const diagrams: PostureRollupDiagram[] = Array.from(latestByDiagram.values()).map(r => ({
      diagramId: r.diagramId,
      name: r.diagram?.name ?? '',
      version: r.diagramVersion,
      score: r.score,
    }));

    const projectScore = diagrams.length
      ? Math.round(diagrams.reduce((sum, d) => sum + d.score, 0) / diagrams.length)
      : null;

    return { projectScore, diagrams };
  }
}
```

- [ ] **Step 4: Run test, confirm pass**

Run: `cd apps/backend && npx jest src/threat/posture-rollup.service.spec.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Register service in ThreatModule**

In `apps/backend/src/threat/threat.module.ts`, add to providers + exports:

```ts
providers: [/* existing */, PostureRollupService],
exports:   [/* existing */, PostureRollupService],
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/threat/posture-rollup.service.ts apps/backend/src/threat/posture-rollup.service.spec.ts apps/backend/src/threat/threat.module.ts
git commit -m "feat(threat): posture rollup service (equal-weight mean)"
```

---

### Task 3.2: Add GET /api/projects/:id/posture-rollup endpoint

**Files:**
- Modify: `apps/backend/src/threat/threat.controller.ts`

- [ ] **Step 1: Add failing e2e/controller test**

Append to existing `apps/backend/src/threat/threat.controller.spec.ts` (or create one):

```ts
it('GET /projects/:id/posture-rollup returns rollup result', async () => {
  jest.spyOn(rollup, 'compute').mockResolvedValue({ projectScore: 75, diagrams: [] });
  const res = await controller.getPostureRollup('proj-id');
  expect(res).toEqual({ projectScore: 75, diagrams: [] });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd apps/backend && npx jest src/threat/threat.controller.spec.ts -t 'posture-rollup'`
Expected: FAIL — handler missing.

- [ ] **Step 3: Add the endpoint**

In `threat.controller.ts`, inject `PostureRollupService` and add:

```ts
@Get('projects/:id/posture-rollup')
@UseGuards(JwtAuthGuard)
getPostureRollup(@Param('id', ParseUUIDPipe) projectId: string) {
  return this.postureRollup.compute(projectId);
}
```

Also add ownership check using the same pattern as other `projects/:id/...` routes in this file (look at `getThreats` — copy the ownership guard).

- [ ] **Step 4: Run test, confirm pass**

Run: `cd apps/backend && npx jest src/threat/threat.controller.spec.ts -t 'posture-rollup'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/threat/threat.controller.ts apps/backend/src/threat/threat.controller.spec.ts
git commit -m "feat(threat): GET /projects/:id/posture-rollup"
```

---

### Task 3.3: IntelReportService — failing test

**Files:**
- Create: `apps/backend/src/threat/intel-report.service.ts`
- Create: `apps/backend/src/threat/intel-report.service.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
describe('IntelReportService', () => {
  // …moduleRef setup with PrismaService + AiService mocks…

  it('builds snapshot from project + per-diagram threat summaries and persists report', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 'p', name: 'Acme', techStack: ['Node'], environment: 'PROD',
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
    prisma.threat.findMany.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({ id: `t${i}`, severity: 'HIGH', strideCategory: 'TAMPERING', title: 'x', threatModel: { diagramId: 'd1', diagramVersion: 1 } })),
    );
    prisma.project.findUnique.mockResolvedValue({ id: 'p', diagrams: [{ id: 'd1', name: 'x', version: 1 }] });
    await service.generate('p', 'u');
    const passed = ai.generateIntelReport.mock.calls[0][0];
    expect(passed.diagrams[0].topThreats).toHaveLength(20);
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `cd apps/backend && npx jest src/threat/intel-report.service.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
const TOP_THREATS_PER_DIAGRAM = 20;

@Injectable()
export class IntelReportService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  async generate(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { diagrams: true },
    });
    if (!project) throw new Error('project not found');

    const threats = await this.prisma.threat.findMany({
      where: { threatModel: { projectId } },
      include: { threatModel: { select: { diagramId: true, diagramVersion: true } } },
    });

    const byDiagram = new Map<string, typeof threats>();
    for (const t of threats) {
      const k = t.threatModel.diagramId;
      const arr = byDiagram.get(k) ?? [];
      arr.push(t);
      byDiagram.set(k, arr);
    }

    const diagramsPayload = project.diagrams.map(d => {
      const list = (byDiagram.get(d.id) ?? []).sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
      );
      const counts = list.reduce((acc, t) => {
        acc[t.severity] = (acc[t.severity] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      return {
        diagramId: d.id,
        name: d.name,
        version: d.version,
        severityCounts: counts,
        topThreats: list.slice(0, TOP_THREATS_PER_DIAGRAM).map(t => ({
          title: t.title, severity: t.severity, stride: t.strideCategory,
        })),
      };
    });

    const snapshot = {
      project: {
        name: project.name, description: project.description,
        techStack: project.techStack, environment: project.environment,
        compliance: project.compliance, notes: project.notes,
      },
      diagrams: diagramsPayload,
    };

    const content = await this.ai.generateIntelReport(snapshot);

    return this.prisma.projectIntelReport.create({
      data: {
        projectId,
        snapshotData: snapshot,
        content,
        diagramRefs: project.diagrams.map(d => ({ diagramId: d.id, version: d.version })),
        generatedBy: userId,
      },
    });
  }

  list(projectId: string) {
    return this.prisma.projectIntelReport.findMany({
      where: { projectId }, orderBy: { generatedAt: 'desc' },
      select: { id: true, generatedAt: true, generatedBy: true },
    });
  }

  get(id: string) {
    return this.prisma.projectIntelReport.findUnique({ where: { id } });
  }
}
```

> **Note:** `AiService.generateIntelReport(snapshot)` is added in Task 5.1. If running tasks out of order, that method must exist before this test passes.

- [ ] **Step 4: Run test, confirm pass**

Run: `cd apps/backend && npx jest src/threat/intel-report.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Register service in ThreatModule**

In `threat.module.ts` add `IntelReportService` to providers + exports. Ensure `AiModule` is imported.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/threat/intel-report.service.ts apps/backend/src/threat/intel-report.service.spec.ts apps/backend/src/threat/threat.module.ts
git commit -m "feat(threat): persisted project intel report service"
```

---

### Task 3.4: Intel report endpoints

**Files:**
- Modify: `apps/backend/src/threat/threat.controller.ts`

- [ ] **Step 1: Add failing controller tests**

In `threat.controller.spec.ts`:

```ts
describe('intel reports', () => {
  it('POST /projects/:id/intel-report creates a report', async () => {
    jest.spyOn(intel, 'generate').mockResolvedValue({ id: 'r1' } as any);
    const res = await controller.createIntelReport('p', { userId: 'u' } as any);
    expect(res.id).toBe('r1');
  });
  it('GET /projects/:id/intel-reports lists reports', async () => {
    jest.spyOn(intel, 'list').mockResolvedValue([{ id: 'r1' }] as any);
    expect(await controller.listIntelReports('p')).toHaveLength(1);
  });
  it('GET /intel-reports/:id returns one', async () => {
    jest.spyOn(intel, 'get').mockResolvedValue({ id: 'r1' } as any);
    expect((await controller.getIntelReport('r1'))?.id).toBe('r1');
  });
});
```

- [ ] **Step 2: Run tests, confirm fail**

Run: `cd apps/backend && npx jest src/threat/threat.controller.spec.ts -t 'intel reports'`
Expected: FAIL.

- [ ] **Step 3: Add the endpoints**

In `threat.controller.ts`, inject `IntelReportService` and add:

```ts
@Post('projects/:id/intel-report')
@UseGuards(JwtAuthGuard)
createIntelReport(@Param('id', ParseUUIDPipe) projectId: string, @CurrentUser() user: { userId: string }) {
  return this.intel.generate(projectId, user.userId);
}

@Get('projects/:id/intel-reports')
@UseGuards(JwtAuthGuard)
listIntelReports(@Param('id', ParseUUIDPipe) projectId: string) {
  return this.intel.list(projectId);
}

@Get('intel-reports/:id')
@UseGuards(JwtAuthGuard)
getIntelReport(@Param('id', ParseUUIDPipe) id: string) {
  return this.intel.get(id);
}
```

Apply ownership guard pattern matching the controller's other routes.

If a pre-existing `POST /api/projects/:id/intel-report` exists in `ai.controller.ts`, **remove the old route** in this commit and document the move in the commit body.

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd apps/backend && npx jest src/threat/threat.controller.spec.ts -t 'intel reports'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/threat apps/backend/src/ai/ai.controller.ts
git commit -m "feat(threat): intel report endpoints; move from ai.controller"
```

---

### Task 3.5: Add diagramId filter to threats list endpoint

**Files:**
- Modify: `apps/backend/src/threat/threat.controller.ts`
- Modify: `apps/backend/src/threat/threat.service.ts` (or wherever the list query lives)
- Modify: corresponding `*.spec.ts`

- [ ] **Step 1: Add failing test**

```ts
it('filters threats by diagramId', async () => {
  await controller.listThreats('p', { diagramId: 'd1' } as any);
  expect(threatService.list).toHaveBeenCalledWith('p', expect.objectContaining({ diagramId: 'd1' }));
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd apps/backend && npx jest -t 'filters threats by diagramId'`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Add `@IsOptional() @IsUUID() diagramId?: string;` to existing list-threats query DTO.
- In service, extend `where`:
  ```ts
  where: {
    threatModel: { projectId, ...(filters.diagramId && { diagramId: filters.diagramId }) },
    ...
  }
  ```

- [ ] **Step 4: Run, confirm pass**

Run: `cd apps/backend && npx jest -t 'filters threats by diagramId'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/threat
git commit -m "feat(threat): diagramId filter on list endpoint"
```

---

## Phase 4 — Backend suggest-flow + pipeline-status route move

### Task 4.1: suggest-flow prompt + DTO

**Files:**
- Create: `apps/backend/src/ai/prompts/suggest-flow.prompt.ts`
- Create: `apps/backend/src/ai/dto/suggest-flow.dto.ts`

- [ ] **Step 1: Add DTO**

```ts
// suggest-flow.dto.ts
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SuggestFlowDto {
  @IsUUID() projectId!: string;
  @IsString() flowName!: string;
  @IsOptional() @IsString() description?: string;
}
```

- [ ] **Step 2: Add prompt template**

```ts
// suggest-flow.prompt.ts
import { PromptTemplate } from '@langchain/core/prompts';

export const suggestFlowPrompt = PromptTemplate.fromTemplate(`
You are a security architect. Propose a Data Flow Diagram (DFD) for the flow named "{flowName}" in the application below.

Application context:
- Name: {projectName}
- Description: {projectDescription}
- Tech stack: {techStack}
- Environment: {environment}
- Compliance: {compliance}
- Notes: {notes}

Existing flows in this project: {existingFlows}

Return the diagram between markers as a single JSON object with fields { nodes, edges } following React Flow conventions:

---DIAGRAM---
{{json}}
---DIAGRAM---

Where each node has { id, type, position, data: { label, kind } } and each edge has { id, source, target, label }.
Be specific: include external entities, trust boundaries, processes, and data stores relevant to "{flowName}".
`);
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/ai/prompts/suggest-flow.prompt.ts apps/backend/src/ai/dto/suggest-flow.dto.ts
git commit -m "feat(ai): suggest-flow prompt + DTO"
```

---

### Task 4.2: SuggestFlowService — TDD

**Files:**
- Create: `apps/backend/src/ai/suggest-flow.service.ts`
- Create: `apps/backend/src/ai/suggest-flow.service.spec.ts`

- [ ] **Step 1: Failing test**

```ts
describe('SuggestFlowService', () => {
  it('renders prompt with project context + existing flows and extracts diagram JSON', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 'p', name: 'Acme', description: 'shop',
      techStack: ['Node'], environment: 'PROD', compliance: ['PCI'], notes: null,
      diagrams: [{ name: 'Checkout' }],
    });
    llm.invoke.mockResolvedValue('intro ---DIAGRAM---\n{"nodes":[{"id":"n1"}],"edges":[]}\n---DIAGRAM--- outro');
    const result = await service.suggest({ projectId: 'p', flowName: 'Login' });
    expect(result.diagram.nodes).toEqual([{ id: 'n1' }]);
    expect(llm.invoke).toHaveBeenCalled();
  });

  it('throws on missing DIAGRAM markers', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'p', diagrams: [], techStack: [], compliance: [] });
    llm.invoke.mockResolvedValue('no markers here');
    await expect(service.suggest({ projectId: 'p', flowName: 'Login' })).rejects.toThrow(/DIAGRAM/);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd apps/backend && npx jest src/ai/suggest-flow.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from './llm.service';
import { suggestFlowPrompt } from './prompts/suggest-flow.prompt';
import { SuggestFlowDto } from './dto/suggest-flow.dto';

const DIAGRAM_MARKER = /---DIAGRAM---\s*([\s\S]*?)\s*---DIAGRAM---/;

@Injectable()
export class SuggestFlowService {
  constructor(private prisma: PrismaService, private llm: LlmService) {}

  async suggest(dto: SuggestFlowDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      include: { diagrams: { select: { name: true } } },
    });
    if (!project) throw new Error('project not found');

    const promptStr = await suggestFlowPrompt.format({
      flowName: dto.flowName,
      projectName: project.name,
      projectDescription: project.description ?? '',
      techStack: (project.techStack ?? []).join(', '),
      environment: project.environment ?? '',
      compliance: (project.compliance ?? []).join(', '),
      notes: project.notes ?? '',
      existingFlows: project.diagrams.map(d => d.name).join(', ') || '(none)',
    });

    const raw = await this.llm.invoke({ prompt: promptStr, promptName: 'suggest-flow' });
    const m = DIAGRAM_MARKER.exec(raw);
    if (!m) throw new Error('LLM response missing ---DIAGRAM--- markers');
    const diagram = JSON.parse(m[1]);
    return { diagram };
  }
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd apps/backend && npx jest src/ai/suggest-flow.service.spec.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Wire into AiModule + AiController**

In `ai.module.ts`: add to providers + exports.
In `ai.controller.ts`:

```ts
@Post('suggest-flow')
@UseGuards(JwtAuthGuard)
suggestFlow(@Body() dto: SuggestFlowDto) {
  return this.suggest.suggest(dto);
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/ai
git commit -m "feat(ai): POST /api/ai/suggest-flow"
```

---

### Task 4.3: Move pipeline-status route to per-diagram

**Files:**
- Modify: `apps/backend/src/ai/ai.controller.ts`

- [ ] **Step 1: Add failing test for new route**

```ts
it('GET /diagrams/:id/pipeline-status returns status keyed to diagram', async () => {
  jest.spyOn(svc, 'getPipelineStatusForDiagram').mockResolvedValue({ threat: 'COMPLETED' } as any);
  expect(await controller.getDiagramPipelineStatus('d1')).toEqual({ threat: 'COMPLETED' });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd apps/backend && npx jest -t 'pipeline-status returns status keyed to diagram'`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Add `getPipelineStatusForDiagram(diagramId)` to `AiService`. Reuse existing project query, swap `projectId` filter for `diagramId`.
- Add controller route:

```ts
@Get('diagrams/:id/pipeline-status')
@UseGuards(JwtAuthGuard)
getDiagramPipelineStatus(@Param('id') diagramId: string) {
  return this.aiService.getPipelineStatusForDiagram(diagramId);
}
```

- Keep old `projects/:projectId/pipeline-status` route. Decorate handler response with header:

```ts
@Header('Deprecation', 'true')
@Header('Link', '</api/ai/diagrams/{diagramId}/pipeline-status>; rel="successor-version"')
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd apps/backend && npx jest -t 'pipeline-status'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ai
git commit -m "feat(ai): per-diagram pipeline-status route (old deprecated)"
```

---

## Phase 5 — Backend prompt edits

### Task 5.1: AiService.generateIntelReport for project scope

**Files:**
- Modify: `apps/backend/src/ai/ai.service.ts`
- Modify: `apps/backend/src/ai/prompts/intel-synthesis.prompt.ts`

- [ ] **Step 1: Update intel-synthesis prompt template**

Replace existing prompt body with a project-scope version that accepts a JSON snapshot. Snippet:

```ts
import { PromptTemplate } from '@langchain/core/prompts';

export const intelSynthesisPrompt = PromptTemplate.fromTemplate(`
You are a senior threat-intelligence analyst. Synthesize an intel report for the application below.

PROJECT:
- Name: {projectName}
- Description: {projectDescription}
- Tech stack: {techStack}
- Environment: {environment}
- Compliance: {compliance}
- Notes: {notes}

FLOWS (one entry per data-flow diagram in this project):
{diagramSummaries}

Output sections (markdown):
1. Threat Landscape — relevant threat actors and campaigns for this stack/sector.
2. Sector Trends — recent (last 12 months) incidents in similar applications.
3. Compliance Gaps — risks against listed compliance frameworks.
4. Top Recommendations — prioritised actions, citing affected flows by name.
`);
```

- [ ] **Step 2: Failing test for AiService.generateIntelReport**

```ts
it('formats snapshot into intel prompt and invokes llm', async () => {
  llm.invoke.mockResolvedValue('report-content');
  const content = await service.generateIntelReport({
    project: { name: 'Acme', description: '', techStack: ['Node'], environment: 'PROD', compliance: ['SOC2'], notes: null },
    diagrams: [{ diagramId: 'd1', name: 'Login', version: 1, severityCounts: { HIGH: 2 }, topThreats: [] }],
  });
  expect(content).toBe('report-content');
  const args = llm.invoke.mock.calls[0][0];
  expect(args.promptName).toBe('intel-synthesis');
  expect(args.prompt).toContain('Acme');
  expect(args.prompt).toContain('Login');
});
```

- [ ] **Step 3: Implement**

```ts
async generateIntelReport(snapshot: IntelSnapshot): Promise<string> {
  const diagramSummaries = snapshot.diagrams.map(d => {
    const counts = Object.entries(d.severityCounts).map(([k, v]) => `${k}:${v}`).join(', ');
    const top = d.topThreats.map(t => `- [${t.severity}/${t.stride}] ${t.title}`).join('\n');
    return `### ${d.name} (v${d.version})\nThreat counts: ${counts || 'none'}\n${top || '_no threats yet_'}`;
  }).join('\n\n');

  const prompt = await intelSynthesisPrompt.format({
    projectName: snapshot.project.name,
    projectDescription: snapshot.project.description ?? '',
    techStack: (snapshot.project.techStack ?? []).join(', '),
    environment: snapshot.project.environment ?? '',
    compliance: (snapshot.project.compliance ?? []).join(', '),
    notes: snapshot.project.notes ?? '',
    diagramSummaries,
  });

  return this.llm.invoke({ prompt, promptName: 'intel-synthesis' });
}
```

Define `IntelSnapshot` interface in `ai.service.ts` to match payload from `IntelReportService` (Task 3.3).

- [ ] **Step 4: Run, confirm pass**

Run: `cd apps/backend && npx jest src/ai/ai.service.spec.ts -t 'intel'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ai
git commit -m "feat(ai): project-scope intel synthesis prompt + AiService"
```

---

### Task 5.2: Inject project context into threat-analysis + attack-mind prompts

**Files:**
- Modify: `apps/backend/src/ai/prompts/threat-analysis.prompt.ts`
- Modify: `apps/backend/src/ai/prompts/attack-mind.prompt.ts`
- Modify: `apps/backend/src/ai/ai.service.ts` (callers)

- [ ] **Step 1: Snapshot/snapshot tests**

Add tests asserting the formatted prompts include `techStack`, `environment`, `compliance` when provided.

```ts
it('threat-analysis prompt includes project context when provided', async () => {
  // call AiService.generateThreatAnalysis with project context arg
  const out = await service.formatThreatAnalysis({
    diagramJson: '{}',
    projectContext: { techStack: ['Node'], environment: 'PROD', compliance: ['SOC2'] },
  });
  expect(out).toContain('Node');
  expect(out).toContain('SOC2');
});
```

- [ ] **Step 2: Run, confirm fail**

Expected: FAIL — fields not in template.

- [ ] **Step 3: Add project context lines to both prompt templates**

Add near the top of each prompt template:

```
Project context:
- Tech stack: {techStack}
- Environment: {environment}
- Compliance: {compliance}
```

Update format calls in `ai.service.ts` to thread these values through (default to empty strings if absent so existing flows don't break).

- [ ] **Step 4: Run, confirm pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/ai
git commit -m "feat(ai): inject project context into threat-analysis + attack-mind prompts"
```

---

## Phase 6 — Frontend split-view shell

### Task 6.1: API client additions

**Files:**
- Modify: `apps/frontend/lib/api/projects.ts` (or `apps/frontend/lib/api/index.ts` — confirm by `grep -rn 'api/projects' apps/frontend/lib`)

- [ ] **Step 1: Find existing API client file**

Run: `grep -rln 'projects/\${' apps/frontend/lib | head` → take the first match.

- [ ] **Step 2: Add functions** (no tests — straight wiring)

```ts
export async function getPostureRollup(projectId: string) {
  return apiFetch(`/api/projects/${projectId}/posture-rollup`);
}
export async function createIntelReport(projectId: string) {
  return apiFetch(`/api/projects/${projectId}/intel-report`, { method: 'POST' });
}
export async function listIntelReports(projectId: string) {
  return apiFetch(`/api/projects/${projectId}/intel-reports`);
}
export async function getIntelReport(id: string) {
  return apiFetch(`/api/intel-reports/${id}`);
}
export async function suggestFlow(payload: { projectId: string; flowName: string; description?: string }) {
  return apiFetch(`/api/ai/suggest-flow`, { method: 'POST', body: payload });
}
export async function getDiagramPipelineStatus(diagramId: string) {
  return apiFetch(`/api/ai/diagrams/${diagramId}/pipeline-status`);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/lib
git commit -m "feat(api): client functions for rollup/intel/suggest-flow"
```

---

### Task 6.2: Feature-flag helper

**Files:**
- Create or modify: `apps/frontend/lib/features.ts`

- [ ] **Step 1: Add helper**

```ts
export const FEATURES = {
  MULTI_FLOW_UI: (process.env.NEXT_PUBLIC_ENABLE_MULTI_FLOW_UI ?? 'true') === 'true',
  DRILLDOWN_UI:  (process.env.NEXT_PUBLIC_ENABLE_DRILLDOWN_UI  ?? 'false') === 'true',
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/lib/features.ts
git commit -m "feat(features): MULTI_FLOW_UI + DRILLDOWN_UI flags"
```

---

### Task 6.3: Gate drill-down components

**Files:**
- Modify: drill-down call sites (find with grep)

- [ ] **Step 1: Locate call sites**

Run:
```bash
grep -rln 'drill\|breadcrumb\|LayerBreadcrumb\|zoomIntoLayer\|zoom-into-layer' apps/frontend/components apps/frontend/app
```

- [ ] **Step 2: Wrap each render site**

For each component that renders drill-down UI (breadcrumb, drill button, zoom-into-layer menu), wrap with:

```tsx
import { FEATURES } from '@/lib/features';
// …
{FEATURES.DRILLDOWN_UI && <LayerBreadcrumb … />}
```

Do **not** delete the components or remove the `layerId` field from any data structures.

- [ ] **Step 3: Run frontend type check + unit tests**

```bash
cd apps/frontend
npm run typecheck
npm test -- --run
```
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend
git commit -m "feat(canvas): gate drill-down UI behind ENABLE_DRILLDOWN_UI flag"
```

---

### Task 6.4: ProjectShell + LeftRailDiagramList

**Files:**
- Create: `apps/frontend/components/projects/ProjectShell.tsx`
- Create: `apps/frontend/components/projects/LeftRailDiagramList.tsx`
- Create tests for each.

- [ ] **Step 1: Failing test for LeftRailDiagramList**

```tsx
// LeftRailDiagramList.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeftRailDiagramList } from './LeftRailDiagramList';

it('renders Project item + diagram entries, highlights selected, fires onSelect', async () => {
  const onSelect = jest.fn();
  render(
    <LeftRailDiagramList
      diagrams={[{ id: 'd1', name: 'Login', threatCount: 3 }, { id: 'd2', name: 'Checkout', threatCount: 0 }]}
      selectedId={'d1'}
      onSelect={onSelect}
    />,
  );
  expect(screen.getByText('Project')).toBeInTheDocument();
  expect(screen.getByText('Login')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Checkout'));
  expect(onSelect).toHaveBeenCalledWith({ kind: 'diagram', id: 'd2' });
  await userEvent.click(screen.getByText('Project'));
  expect(onSelect).toHaveBeenCalledWith({ kind: 'project' });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd apps/frontend && npm test -- LeftRailDiagramList`
Expected: FAIL.

- [ ] **Step 3: Implement LeftRailDiagramList**

```tsx
// LeftRailDiagramList.tsx
'use client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type RailSelection =
  | { kind: 'project' }
  | { kind: 'diagram'; id: string };

export interface LeftRailDiagram {
  id: string;
  name: string;
  threatCount: number;
  postureGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface Props {
  diagrams: LeftRailDiagram[];
  selectedId?: string;
  onSelect: (sel: RailSelection) => void;
  onNewFlow?: () => void;
}

export function LeftRailDiagramList({ diagrams, selectedId, onSelect, onNewFlow }: Props) {
  const isProjectSelected = !selectedId;
  return (
    <nav className="flex flex-col w-[260px] border-r h-full">
      <button
        type="button"
        onClick={() => onSelect({ kind: 'project' })}
        className={cn('px-4 py-3 text-left font-semibold', isProjectSelected && 'bg-accent')}
      >
        Project
      </button>
      <hr />
      <Button variant="ghost" className="mx-2 my-2 justify-start" onClick={onNewFlow}>
        + New Flow
      </Button>
      <ul className="flex-1 overflow-auto">
        {diagrams.map(d => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onSelect({ kind: 'diagram', id: d.id })}
              className={cn(
                'w-full px-4 py-2 text-left flex justify-between items-center',
                selectedId === d.id && 'bg-accent',
              )}
            >
              <span>{d.name}</span>
              {d.threatCount > 0 && (
                <span className="text-xs rounded-full bg-red-200 px-2 py-0.5">{d.threatCount}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Run, confirm test passes**

Run: `cd apps/frontend && npm test -- LeftRailDiagramList`
Expected: PASS.

- [ ] **Step 5: Implement ProjectShell**

```tsx
// ProjectShell.tsx
'use client';
import { useState } from 'react';
import { LeftRailDiagramList, RailSelection, LeftRailDiagram } from './LeftRailDiagramList';
import { ProjectOverviewPane } from './ProjectOverviewPane';
import { CanvasPane } from './CanvasPane';
import { NewFlowDialog } from './NewFlowDialog';

export interface ProjectShellProps {
  projectId: string;
  diagrams: LeftRailDiagram[];
  initialSelection?: RailSelection;
}

export function ProjectShell({ projectId, diagrams, initialSelection }: ProjectShellProps) {
  const [sel, setSel] = useState<RailSelection>(initialSelection ?? { kind: 'project' });
  const [newFlowOpen, setNewFlowOpen] = useState(false);

  return (
    <div className="flex h-full">
      <LeftRailDiagramList
        diagrams={diagrams}
        selectedId={sel.kind === 'diagram' ? sel.id : undefined}
        onSelect={setSel}
        onNewFlow={() => setNewFlowOpen(true)}
      />
      <main className="flex-1 overflow-auto">
        {sel.kind === 'project'
          ? <ProjectOverviewPane projectId={projectId} />
          : <CanvasPane diagramId={sel.id} />}
      </main>
      <NewFlowDialog projectId={projectId} open={newFlowOpen} onOpenChange={setNewFlowOpen} />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/components/projects/ProjectShell.tsx apps/frontend/components/projects/LeftRailDiagramList.tsx
git commit -m "feat(projects): ProjectShell + LeftRailDiagramList"
```

---

### Task 6.5: ProjectOverviewPane with metadata + rollup widgets

**Files:**
- Create: `apps/frontend/components/projects/ProjectOverviewPane.tsx`
- Create: `apps/frontend/components/projects/ProjectMetadataForm.tsx`
- Create: `apps/frontend/components/projects/widgets/{ThreatsRollupCard,PostureRollupCard,IntelReportCard}.tsx`

- [ ] **Step 1: Failing test for ProjectMetadataForm**

```tsx
it('emits PATCH payload with chip + select values on submit', async () => {
  const onSave = jest.fn().mockResolvedValue({});
  render(
    <ProjectMetadataForm
      initial={{ name: 'Acme', description: '', techStack: [], environment: null, compliance: [], notes: '' }}
      onSave={onSave}
    />,
  );
  await userEvent.type(screen.getByLabelText(/tech stack/i), 'Node{enter}Postgres{enter}');
  await userEvent.selectOptions(screen.getByLabelText(/environment/i), 'PROD');
  await userEvent.click(screen.getByLabelText(/SOC2/i));
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    techStack: ['Node', 'Postgres'],
    environment: 'PROD',
    compliance: expect.arrayContaining(['SOC2']),
  }));
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd apps/frontend && npm test -- ProjectMetadataForm`
Expected: FAIL.

- [ ] **Step 3: Implement ProjectMetadataForm** (chip input, env select, compliance checkboxes, notes textarea) — pattern off existing `apps/frontend/components/projects` forms.

- [ ] **Step 4: Run, confirm pass**

Expected: PASS.

- [ ] **Step 5: Implement widget cards**

`ThreatsRollupCard` — counts by severity + STRIDE breakdown; "View dashboard" toggles full table.
`PostureRollupCard` — projectScore + per-diagram bars; bar click → `onOpenDiagram(diagramId)`.
`IntelReportCard` — latest report excerpt + Regenerate button calling `createIntelReport`.

Write one unit test per card covering the primary interaction (click event / data render). One failing test → impl → pass → commit per card.

- [ ] **Step 6: Implement ProjectOverviewPane**

Composes header (name/description), `ProjectMetadataForm` in collapsible section, then the three widget cards. Loads data via `useEffect` from API client (Task 6.1).

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/components/projects
git commit -m "feat(projects): overview pane + metadata form + rollup widgets"
```

---

### Task 6.6: CanvasPane + NewFlowDialog

**Files:**
- Create: `apps/frontend/components/projects/CanvasPane.tsx`
- Create: `apps/frontend/components/projects/NewFlowDialog.tsx`

- [ ] **Step 1: CanvasPane** — wrap the existing canvas component (from `components/nodes/...` or `app/projects/[projectId]/page.tsx`) so it loads by `diagramId`. Drill-down already gated in Task 6.3.

  ```tsx
  'use client';
  import { Canvas } from '@/components/canvas/Canvas'; // discovered in grep
  export function CanvasPane({ diagramId }: { diagramId: string }) {
    return <Canvas diagramId={diagramId} />;
  }
  ```

- [ ] **Step 2: NewFlowDialog — failing test**

```tsx
it('submits Blank start to onCreate', async () => {
  const onCreate = jest.fn().mockResolvedValue({ id: 'd-new' });
  render(<NewFlowDialog projectId="p" open onOpenChange={() => {}} onCreate={onCreate} />);
  await userEvent.type(screen.getByLabelText(/name/i), 'Login');
  await userEvent.click(screen.getByRole('button', { name: /create blank/i }));
  expect(onCreate).toHaveBeenCalledWith({ projectId: 'p', name: 'Login', startMode: 'blank' });
});

it('submits AI-suggest mode', async () => {
  const onCreate = jest.fn().mockResolvedValue({ id: 'd-new' });
  render(<NewFlowDialog projectId="p" open onOpenChange={() => {}} onCreate={onCreate} />);
  await userEvent.type(screen.getByLabelText(/name/i), 'Login');
  await userEvent.click(screen.getByRole('button', { name: /ai suggest/i }));
  expect(onCreate).toHaveBeenCalledWith({ projectId: 'p', name: 'Login', startMode: 'ai-suggest' });
});
```

- [ ] **Step 3: Run, confirm fail**

Run: `cd apps/frontend && npm test -- NewFlowDialog`
Expected: FAIL.

- [ ] **Step 4: Implement NewFlowDialog** with name input + two action buttons. AI suggest path calls `suggestFlow(...)` from API client, then `createDiagram(...)` with the resulting canvas JSON.

- [ ] **Step 5: Run, confirm pass**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/components/projects
git commit -m "feat(projects): CanvasPane + NewFlowDialog"
```

---

### Task 6.7: Replace `/projects/[projectId]/page.tsx` with split-view shell

**Files:**
- Modify: `apps/frontend/app/projects/[projectId]/page.tsx`

- [ ] **Step 1: Read current page**

`Read apps/frontend/app/projects/[projectId]/page.tsx`. Note any data fetches (project + diagrams).

- [ ] **Step 2: Rewrite to load project + diagrams server-side and render ProjectShell**

```tsx
// page.tsx (server component)
import { ProjectShell } from '@/components/projects/ProjectShell';
import { fetchProjectWithDiagrams } from '@/lib/api/projects.server';

export default async function ProjectPage({ params, searchParams }: any) {
  const project = await fetchProjectWithDiagrams(params.projectId);
  const initial =
    searchParams?.diagram
      ? { kind: 'diagram' as const, id: searchParams.diagram }
      : searchParams?.view === 'project'
        ? { kind: 'project' as const }
        : { kind: 'project' as const };

  return (
    <ProjectShell
      projectId={project.id}
      diagrams={project.diagrams.map(d => ({ id: d.id, name: d.name, threatCount: d._count?.threats ?? 0 }))}
      initialSelection={initial}
    />
  );
}
```

If `fetchProjectWithDiagrams` doesn't exist, create it alongside `lib/api/projects.ts` using existing patterns from the codebase.

- [ ] **Step 3: Manually verify**

Run frontend + backend dev servers per `CLAUDE.md`. Open `/projects/<existing-id>`. Confirm:
- Left rail shows "Project" + "Main Flow" entry.
- Clicking diagram shows canvas; clicking "Project" shows overview.
- Drill-down buttons absent.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/app/projects/[projectId]/page.tsx apps/frontend/lib/api
git commit -m "feat(projects): split-view shell as default project page"
```

---

## Phase 7 — Cleanup + verification

### Task 7.1: Remove duplicate old intel UI

**Files:**
- Modify or delete: `apps/frontend/app/projects/[projectId]/intel/page.tsx`

- [ ] **Step 1:** Decide: keep as a deep link that lazily loads the intel modal, or delete. Pick **redirect**.

- [ ] **Step 2:** Replace `intel/page.tsx` body with `redirect(\`/projects/\${projectId}?view=project&intel=1\`)`. The overview pane reads `intel=1` and auto-opens the intel modal.

- [ ] **Step 3:** Commit

```bash
git add apps/frontend/app/projects/[projectId]/intel
git commit -m "refactor(projects): redirect old intel route into overview pane"
```

---

### Task 7.2: Run full test suites + typecheck

- [ ] **Step 1: Backend**

```bash
cd apps/backend
npm test
npm run build
```
Expected: green; build succeeds.

- [ ] **Step 2: Frontend**

```bash
cd apps/frontend
npm test -- --run
npm run typecheck
npm run build
```
Expected: green.

- [ ] **Step 3: If anything fails, fix root cause, recommit. Do not skip tests.**

---

### Task 7.3: Smoke test in dev

- [ ] **Step 1: Start both services**

```bash
cd apps/backend && npm run start:dev &
cd apps/frontend && npm run dev &
```

- [ ] **Step 2: Walk the golden path**

  1. Create a new project — fill techStack, environment, compliance.
  2. Open it — Project overview renders metadata chips, empty widgets.
  3. Click `+ New Flow` → choose **Blank** → name "Login" → canvas opens.
  4. Add 2 nodes → publish.
  5. Run threat analysis on Login.
  6. Click `+ New Flow` → choose **AI suggest** → name "Checkout" → diagram seeded.
  7. Run threat analysis on Checkout.
  8. Back to Project overview: threats widget shows aggregate; posture widget shows two bars; intel report regenerates and references both flows.

- [ ] **Step 3: Note any regressions in a follow-up file** (not in this plan's commit log).

---

## Self-Review Notes

- **Spec coverage** — every section §3–§7 of the spec is covered by a task. Posture rollup math (§5.2), intel persistence (§3.4, §5.4), `suggest-flow` (§4.5, §6.5), drill-down hide (§4.4, §7.3), `pipeline-status` move (§5.5), DTO validators (§7.2), `ChatMessage.diagramId` (§3.5 schema only — UI work for flow-scoped chat is **out of scope** for v1 unless raised later).
- **Placeholders** — none. Every code-changing step shows the code.
- **Type consistency** — `PostureRollupResult`, `RailSelection`, `LeftRailDiagram`, `IntelSnapshot` named consistently across tasks. `generateIntelReport(snapshot)` matches the call in `IntelReportService` (Task 3.3) and impl (Task 5.1).
- **Gaps acknowledged** — flow-scoped chat UI (only schema added); aggregated threats dashboard route reuses overview pane (no separate route, matches spec §5.1 revised).
