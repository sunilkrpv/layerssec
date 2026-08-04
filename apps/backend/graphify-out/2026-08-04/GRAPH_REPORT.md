# Graph Report - backend  (2026-07-25)

## Corpus Check
- 145 files · ~45,292 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1034 nodes · 2098 edges · 112 communities (56 shown, 56 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3e2449c9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Threat / Intel Controllers
- Auth Guards + Chat Controller
- Suggest-Flow / Posture DTOs
- Diagrams Controller (Versioning)
- Project DTOs + Compliance
- Chroma / Queue Services
- Auth Controller
- Package Config
- Nest Modules Wiring
- Onboarding
- Users Controller
- AI Controller (Attack/Posture/Intel)
- Prisma / Core Services
- TS Config
- Threat Analysis Prompt
- AI Chat Generate
- AI Service Core
- Attack Mind Prompt
- Module 18
- Module 19
- Module 20
- Module 21
- Module 22
- Module 23
- Module 24
- Module 25
- Module 26
- Module 27
- Module 28
- Module 29
- Module 30
- Module 31
- Module 32
- CurrentUser
- ChatService
- Module 35
- Module 36
- Module 37
- CreateProjectDto
- Module 39
- Module 40
- Module 41
- AiModelsService
- UserSettingsController
- Module 44
- EncryptionService
- AiService
- user-settings.service.ts
- Module 48
- ai.module.ts
- Module 50
- Module 51
- posture-score-prompt.ts
- Module 53
- report.service.ts
- Module 55
- Module 56
- Module 57
- Module 58
- Module 59
- Module 60
- Module 61
- Module 62
- Module 63
- Module 64
- Module 65
- Module 66
- Module 67
- Module 68
- Module 69
- Module 70
- Module 71
- Module 72
- Module 73
- Module 74
- Module 75
- Module 76
- Module 77
- Module 78
- Module 79
- Module 80
- Module 81
- Module 82
- Module 83
- Module 84
- Module 85
- Module 86
- Module 87
- Module 88
- Module 89
- Module 90
- Module 91
- Module 92
- Module 93
- Module 94
- Module 95
- ReportService
- HttpLoggingMiddleware
- IntelReportService
- UserSettingsService
- .chatGenerate
- SaveThreatModelDto
- SubmitAttackMindDto
- ProjectsService
- ChromaService
- PostureScoreDto
- ChatMessageItemDto
- eslint-plugin-prettier
- DeclutterDto
- llm.service.ts
- projects.service.spec.ts
- EncryptionModule

## God Nodes (most connected - your core abstractions)
1. `CurrentUser` - 80 edges
2. `PrismaService` - 52 edges
3. `AiService` - 34 edges
4. `ThreatService` - 27 edges
5. `AiController` - 26 edges
6. `ThreatController` - 26 edges
7. `OnboardingService` - 25 edges
8. `LlmService` - 23 edges
9. `UserSettingsService` - 23 edges
10. `scripts` - 20 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  src/main.ts → src/app.module.ts
- `AttackMindInput` --references--> `ProjectContextHint`  [EXTRACTED]
  src/ai/prompts/attack-mind-prompt.ts → src/ai/prompts/project-context-hint.ts
- `ThreatAnalysisInput` --references--> `ProjectContextHint`  [EXTRACTED]
  src/ai/prompts/threat-analysis-prompt.ts → src/ai/prompts/project-context-hint.ts
- `UpdateAiSettingsDto` --references--> `IsSafeHttpsUrl()`  [EXTRACTED]
  src/user-settings/dto/update-ai-settings.dto.ts → src/common/url-safety.ts
- `PostureScoreJobPayload` --references--> `SubmitPostureScoreDto`  [EXTRACTED]
  src/jobs/processors/posture-score.processor.ts → src/jobs/dto/submit-posture-score.dto.ts

## Import Cycles
- None detected.

## Communities (112 total, 56 thin omitted)

### Community 0 - "Threat / Intel Controllers"
Cohesion: 0.07
Nodes (19): IsNotEmpty, CreateThreatDto, IsEnum, IsOptional, IsString, ThreatController, Body, Controller (+11 more)

### Community 1 - "Auth Guards + Chat Controller"
Cohesion: 0.11
Nodes (15): JwtAuthGuard, Injectable, IsOptional, IsString, UpdateUserDto, Body, Controller, Get (+7 more)

### Community 2 - "Suggest-Flow / Posture DTOs"
Cohesion: 0.20
Nodes (8): SubmitPostureScoreDto, IsBoolean, IsInt, IsObject, IsOptional, IsString, PostureScoreJobPayload, PostureScoreJobResult

### Community 3 - "Diagrams Controller (Versioning)"
Cohesion: 0.08
Nodes (27): DiagramsController, Body, Controller, Delete, Get, HttpCode, Param, Patch (+19 more)

### Community 4 - "Project DTOs + Compliance"
Cohesion: 0.14
Nodes (9): ProjectsController, Body, Controller, Delete, Get, Param, Patch, Post (+1 more)

### Community 6 - "Auth Controller"
Cohesion: 0.09
Nodes (20): MinLength, AuthController, Body, Controller, HttpCode, Post, AuthModule, Module (+12 more)

### Community 7 - "Package Config"
Cohesion: 0.05
Nodes (39): author, description, jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment (+31 more)

### Community 8 - "Nest Modules Wiring"
Cohesion: 0.14
Nodes (13): ChatModule, Module, DiagramsModule, Module, OnboardingModule, Module, PrismaModule, Global (+5 more)

### Community 9 - "Onboarding"
Cohesion: 0.13
Nodes (12): IsISO8601, IsOptional, UpdateOnboardingDto, OnboardingController, Body, Controller, Get, Patch (+4 more)

### Community 10 - "Users Controller"
Cohesion: 0.16
Nodes (7): JobsController, Controller, Get, Param, Post, Query, UseGuards

### Community 11 - "AI Controller (Attack/Posture/Intel)"
Cohesion: 0.17
Nodes (10): RagDocument, RagQueryResult, DiagramInfo, NodeSummary, VersionSummary, ChatMessageItem, LayerMap, RagModule (+2 more)

### Community 12 - "Prisma / Core Services"
Cohesion: 0.19
Nodes (9): AiModule, Module, JobsModule, Module, DATE_RANGE_MS, JobsService, Injectable, ThreatModule (+1 more)

### Community 13 - "TS Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+10 more)

### Community 14 - "Threat Analysis Prompt"
Cohesion: 0.13
Nodes (14): 1. Configure environment, 1. Start infrastructure, 2. Build and start, 2. Install dependencies, 3. Configure environment, 4. Run migrations and start, AI Providers, layers-rest (+6 more)

### Community 15 - "AI Chat Generate"
Cohesion: 0.14
Nodes (13): ChatEvaluateDto, IsArray, IsOptional, IsString, GenerateDto, IsObject, IsOptional, IsString (+5 more)

### Community 16 - "AI Service Core"
Cohesion: 0.17
Nodes (9): applyOllamaOptimizations(), LlmService, resolveNumCtx(), Injectable, buildPostureScorePrompt(), AttackSimulationProcessor, Processor, PostureScoreProcessor (+1 more)

### Community 17 - "Attack Mind Prompt"
Cohesion: 0.20
Nodes (12): AttackMindInput, buildAttackMindPrompt(), formatProjectContextBlock(), ProjectContextHint, buildThreatAgentPrompt(), buildThreatAnalysisPrompt(), SerializedEdge, SerializedNode (+4 more)

### Community 18 - "Module 18"
Cohesion: 0.29
Nodes (6): SaveAttackSimulationDto, IsArray, IsEnum, IsOptional, IsString, UpdateThreatDto

### Community 19 - "Module 19"
Cohesion: 0.23
Nodes (9): assertSafeResolvedHost(), isBlockedHostLiteral(), isReservedIp(), IsSafeHttpsUrl(), IsSafeHttpsUrlConstraint, NOTE: This is storage-time validation. It does NOT defend against DNS, validateSafeHttpsUrl(), AiProviderDto (+1 more)

### Community 20 - "Module 20"
Cohesion: 0.25
Nodes (8): ContextualAskDto, ContextualHistoryItemDto, IsArray, IsIn, IsOptional, IsString, Type, ValidateNested

### Community 21 - "Module 21"
Cohesion: 0.22
Nodes (8): ConverseDto, ConverseMessageDto, IsArray, IsIn, IsString, IsUUID, Type, ValidateNested

### Community 22 - "Module 22"
Cohesion: 0.31
Nodes (3): InjectQueue, RagContextService, Injectable

### Community 23 - "Module 23"
Cohesion: 0.22
Nodes (8): AiJob Lifecycle, Architecture, Cross-links, Layers — AI Jobs Engineer, Logging, Posture Penalty in the Processor, Provider Selection & BYO-Key, Submit vs Stream

### Community 24 - "Module 24"
Cohesion: 0.11
Nodes (11): ChatGenerateDto, IsOptional, IsString, ConverseResult, buildLayerContextSystemPrompt(), buildContextualSystemPrompt(), buildDeclutterPrompt(), buildGeneratePrompt() (+3 more)

### Community 25 - "Module 25"
Cohesion: 0.27
Nodes (11): EdgeInputDto, MessageDto, NodeInputDto, ThreatChatDto, TrustBoundaryInputDto, IsArray, IsIn, IsOptional (+3 more)

### Community 26 - "Module 26"
Cohesion: 0.15
Nodes (11): selectThreatSystemPrompt(), EdgeInputDto, NodeInputDto, SubmitThreatAnalysisDto, TrustBoundaryInputDto, IsArray, IsInt, IsOptional (+3 more)

### Community 27 - "Module 27"
Cohesion: 0.33
Nodes (9): EdgeInputDto, NodeInputDto, ThreatAnalysisDto, TrustBoundaryDto, IsArray, IsOptional, IsString, Type (+1 more)

### Community 28 - "Module 28"
Cohesion: 0.25
Nodes (7): Data Model (summary), Dev Setup, Endpoint Surface, Gotchas (pointers), Layers — Backend (orientation), Modules (`src/`), Stack

### Community 29 - "Module 29"
Cohesion: 0.22
Nodes (9): ChatAskDto, ChatHistoryItemDto, IsArray, IsIn, IsObject, IsOptional, IsString, Type (+1 more)

### Community 30 - "Module 30"
Cohesion: 0.29
Nodes (7): AiModelInfo, AiModelsResponse, OPENAI_ENRICH, ReasoningLevel, AiSettingsResponse, Injectable, UserSettingsService

### Community 31 - "Module 31"
Cohesion: 0.29
Nodes (6): Coding Standards & Security, Core Expertise, Encryption Rules (`encryption` module), Gotchas (pointers), Layers REST — Backend Engineering Skills, LLM Logging (summary — full rules in `prompt-engineer`)

### Community 33 - "CurrentUser"
Cohesion: 0.18
Nodes (10): Header, AiController, Body, Controller, Get, Param, Post, Res (+2 more)

### Community 34 - "ChatService"
Cohesion: 0.12
Nodes (14): ChatController, Body, Controller, Get, HttpCode, Param, Post, UseGuards (+6 more)

### Community 36 - "Module 36"
Cohesion: 0.25
Nodes (7): dist, node_modules, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 38 - "CreateProjectDto"
Cohesion: 0.16
Nodes (13): ArrayUnique, IsUrl, MaxLength, COMPLIANCE_WHITELIST, ComplianceTag, CreateProjectDto, IsArray, IsBoolean (+5 more)

### Community 39 - "Module 39"
Cohesion: 0.29
Nodes (7): @anthropic-ai/sdk, class-transformer, @nestjs/core, dependencies, @anthropic-ai/sdk, class-transformer, @nestjs/core

### Community 40 - "Module 40"
Cohesion: 0.29
Nodes (7): dotenv-cli, eslint, devDependencies, dotenv-cli, eslint, @types/bcrypt, @types/bcrypt

### Community 41 - "Module 41"
Cohesion: 0.16
Nodes (6): PrismaService, Injectable, PostureRollupDiagram, PostureRollupResult, PostureRollupService, Injectable

### Community 43 - "UserSettingsController"
Cohesion: 0.24
Nodes (5): Controller, Get, Query, UseGuards, UserSettingsController

### Community 44 - "Module 44"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 47 - "user-settings.service.ts"
Cohesion: 0.18
Nodes (9): Max, Min, Put, IsEnum, IsInt, IsOptional, IsString, UpdateAiSettingsDto (+1 more)

### Community 49 - "ai.module.ts"
Cohesion: 0.20
Nodes (7): SuggestFlowDto, IsOptional, IsString, IsUUID, suggestFlowPrompt, SuggestFlowService, Injectable

### Community 52 - "posture-score-prompt.ts"
Cohesion: 0.21
Nodes (11): DIMENSION_LABELS, normalizeAdditions(), normalizeDeductions(), normalizeDimensions(), NormalizedLayerScore, NormalizedPostureResult, normalizePostureResult(), PostureScoreInput (+3 more)

### Community 54 - "report.service.ts"
Cohesion: 0.25
Nodes (7): SEVERITY_BG, SEVERITY_COLOR, SEVERITY_ORDER, STATUS_LABEL, STRIDE_LABEL, STRIDE_ORDER, ThreatRow

### Community 96 - "ReportService"
Cohesion: 0.46
Nodes (3): PDFDocument, ReportService, Injectable

### Community 97 - "HttpLoggingMiddleware"
Cohesion: 0.20
Nodes (5): AppModule, Module, HttpLoggingMiddleware, Injectable, bootstrap()

### Community 98 - "IntelReportService"
Cohesion: 0.18
Nodes (4): IntelSnapshot, IntelReportService, SEVERITY_ORDER, Injectable

### Community 100 - ".chatGenerate"
Cohesion: 0.47
Nodes (6): coerceName(), extractJsonObject(), sanitizeNodePositions(), validateOversizeWarning(), parseConverse(), stripTechnology()

### Community 101 - "SaveThreatModelDto"
Cohesion: 0.22
Nodes (10): SaveThreatModelDto, ThreatItemDto, IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString (+2 more)

### Community 102 - "SubmitAttackMindDto"
Cohesion: 0.31
Nodes (8): AttackMindDto, SubmitAttackMindDto, IsBoolean, IsInt, IsObject, IsOptional, IsString, AttackSimJobPayload

### Community 105 - "PostureScoreDto"
Cohesion: 0.29
Nodes (6): IsNumber, PostureScoreDto, IsBoolean, IsObject, IsOptional, IsString

### Community 106 - "ChatMessageItemDto"
Cohesion: 0.33
Nodes (6): ChatMessageItemDto, IsIn, IsInt, IsObject, IsOptional, IsString

### Community 108 - "DeclutterDto"
Cohesion: 0.40
Nodes (4): DeclutterDto, IsArray, IsOptional, IsString

### Community 109 - "llm.service.ts"
Cohesion: 0.40
Nodes (4): LlmCallConfig, LlmProvider, LlmResponse, OLLAMA_CONTEXT_MAP

### Community 110 - "projects.service.spec.ts"
Cohesion: 0.50
Nodes (3): mockOnboarding, mockPrisma, mockRagIndexing

### Community 111 - "EncryptionModule"
Cohesion: 0.67
Nodes (3): EncryptionModule, Global, Module

## Knowledge Gaps
- **192 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **56 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CurrentUser` connect `CurrentUser` to `Threat / Intel Controllers`, `Auth Guards + Chat Controller`, `ChatService`, `Diagrams Controller (Versioning)`, `Project DTOs + Compliance`, `CreateProjectDto`, `Onboarding`, `Users Controller`, `UserSettingsController`, `Prisma / Core Services`, `AI Chat Generate`, `user-settings.service.ts`, `Module 18`, `Module 30`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `Module 41` to `Threat / Intel Controllers`, `Auth Guards + Chat Controller`, `Suggest-Flow / Posture DTOs`, `Diagrams Controller (Versioning)`, `Chroma / Queue Services`, `Auth Controller`, `Nest Modules Wiring`, `Onboarding`, `AI Controller (Attack/Posture/Intel)`, `Prisma / Core Services`, `AI Service Core`, `Attack Mind Prompt`, `Module 18`, `Module 22`, `Module 24`, `Module 26`, `Module 30`, `ChatService`, `CreateProjectDto`, `EncryptionService`, `ai.module.ts`, `report.service.ts`, `IntelReportService`, `UserSettingsService`, `ProjectsService`, `ChromaService`, `projects.service.spec.ts`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `AiService` connect `AiService` to `Threat / Intel Controllers`, `CurrentUser`, `Suggest-Flow / Posture DTOs`, `IntelReportService`, `.chatGenerate`, `SubmitAttackMindDto`, `Module 41`, `AI Controller (Attack/Posture/Intel)`, `AI Chat Generate`, `AI Service Core`, `ai.module.ts`, `Module 22`, `Module 24`, `Module 26`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Threat / Intel Controllers` be split into smaller, more focused modules?**
  _Cohesion score 0.0701484895033282 - nodes in this community are weakly interconnected._
- **Should `Auth Guards + Chat Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Diagrams Controller (Versioning)` be split into smaller, more focused modules?**
  _Cohesion score 0.08144796380090498 - nodes in this community are weakly interconnected._