# Graph Report - .  (2026-07-24)

## Corpus Check
- Corpus is ~42,884 words - fits in a single context window. You may not need a graph.

## Summary
- 972 nodes · 2002 edges · 96 communities (46 shown, 50 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

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
- Module 33
- Module 34
- Module 35
- Module 36
- Module 37
- Module 38
- Module 39
- Module 40
- Module 41
- Module 42
- Module 43
- Module 44
- Module 45
- Module 46
- Module 47
- Module 48
- Module 49
- Module 50
- Module 51
- Module 52
- Module 53
- Module 54
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

## God Nodes (most connected - your core abstractions)
1. `CurrentUser` - 79 edges
2. `PrismaService` - 52 edges
3. `AiService` - 33 edges
4. `ThreatService` - 27 edges
5. `ThreatController` - 26 edges
6. `AiController` - 25 edges
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
- `buildThreatAnalysisPrompt()` --calls--> `formatProjectContextBlock()`  [EXTRACTED]
  src/ai/prompts/threat-analysis-prompt.ts → src/ai/prompts/project-context-hint.ts
- `UpdateAiSettingsDto` --references--> `IsSafeHttpsUrl()`  [EXTRACTED]
  src/user-settings/dto/update-ai-settings.dto.ts → src/common/url-safety.ts

## Import Cycles
- None detected.

## Communities (96 total, 50 thin omitted)

### Community 0 - "Threat / Intel Controllers"
Cohesion: 0.10
Nodes (15): CurrentUser, ThreatController, Body, Controller, Delete, Get, HttpCode, Param (+7 more)

### Community 1 - "Auth Guards + Chat Controller"
Cohesion: 0.05
Nodes (32): JwtAuthGuard, Injectable, ChatController, Body, Controller, Get, HttpCode, Param (+24 more)

### Community 2 - "Suggest-Flow / Posture DTOs"
Cohesion: 0.06
Nodes (27): SuggestFlowDto, IsOptional, IsString, IsUUID, applyOllamaOptimizations(), LlmService, resolveNumCtx(), Injectable (+19 more)

### Community 3 - "Diagrams Controller (Versioning)"
Cohesion: 0.08
Nodes (27): DiagramsController, Body, Controller, Delete, Get, HttpCode, Param, Patch (+19 more)

### Community 4 - "Project DTOs + Compliance"
Cohesion: 0.07
Nodes (24): ArrayUnique, IsUrl, MaxLength, COMPLIANCE_WHITELIST, ComplianceTag, CreateProjectDto, IsArray, IsBoolean (+16 more)

### Community 5 - "Chroma / Queue Services"
Cohesion: 0.07
Nodes (17): InjectQueue, ChromaService, RagDocument, RagQueryResult, Injectable, DiagramInfo, NodeSummary, RagContextService (+9 more)

### Community 6 - "Auth Controller"
Cohesion: 0.09
Nodes (20): MinLength, AuthController, Body, Controller, HttpCode, Post, AuthModule, Module (+12 more)

### Community 7 - "Package Config"
Cohesion: 0.05
Nodes (39): author, description, jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment (+31 more)

### Community 8 - "Nest Modules Wiring"
Cohesion: 0.09
Nodes (24): AiModule, Module, AppModule, Module, ChatModule, Module, HttpLoggingMiddleware, Injectable (+16 more)

### Community 9 - "Onboarding"
Cohesion: 0.10
Nodes (15): IsISO8601, IsOptional, UpdateOnboardingDto, OnboardingController, Body, Controller, Get, Patch (+7 more)

### Community 10 - "Users Controller"
Cohesion: 0.13
Nodes (13): IsOptional, IsString, UpdateUserDto, Body, Controller, Get, Patch, UseGuards (+5 more)

### Community 11 - "AI Controller (Attack/Posture/Intel)"
Cohesion: 0.17
Nodes (10): AiController, Body, Controller, Post, Res, UseGuards, AttackMindDto, IsBoolean (+2 more)

### Community 12 - "Prisma / Core Services"
Cohesion: 0.17
Nodes (10): PrismaService, Injectable, AiModelInfo, AiModelsResponse, OPENAI_ENRICH, ReasoningLevel, AiProviderDto, AiSettingsResponse (+2 more)

### Community 13 - "TS Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+10 more)

### Community 14 - "Threat Analysis Prompt"
Cohesion: 0.17
Nodes (10): buildThreatAnalysisPrompt(), selectThreatSystemPrompt(), SerializedEdge, SerializedNode, SerializedTrustBoundary, ThreatAgentInput, ThreatAnalysisJobPayload, ThreatAnalysisJobResult (+2 more)

### Community 15 - "AI Chat Generate"
Cohesion: 0.17
Nodes (8): ChatGenerateDto, IsOptional, IsString, RefineDto, IsObject, IsString, SuggestDto, IsObject

### Community 16 - "AI Service Core"
Cohesion: 0.25
Nodes (3): AiService, Injectable, buildRefinePrompt()

### Community 17 - "Attack Mind Prompt"
Cohesion: 0.25
Nodes (9): SubmitAttackMindDto, IsInt, AttackMindInput, buildAttackMindPrompt(), formatProjectContextBlock(), ProjectContextHint, ThreatAnalysisInput, AttackSimJobPayload (+1 more)

### Community 18 - "Module 18"
Cohesion: 0.16
Nodes (4): PostureRollupDiagram, PostureRollupResult, PostureRollupService, Injectable

### Community 20 - "Module 20"
Cohesion: 0.18
Nodes (9): ContextualAskDto, ContextualHistoryItemDto, IsArray, IsIn, IsOptional, IsString, Type, ValidateNested (+1 more)

### Community 21 - "Module 21"
Cohesion: 0.23
Nodes (8): SaveAttackSimulationDto, IsArray, IsOptional, IsString, IsEnum, IsOptional, IsString, UpdateThreatDto

### Community 22 - "Module 22"
Cohesion: 0.18
Nodes (5): EncryptionModule, Global, Module, EncryptionService, Injectable

### Community 23 - "Module 23"
Cohesion: 0.18
Nodes (9): Max, Min, Put, IsEnum, IsInt, IsOptional, IsString, UpdateAiSettingsDto (+1 more)

### Community 24 - "Module 24"
Cohesion: 0.23
Nodes (4): buildLayerContextSystemPrompt(), buildGeneratePrompt(), intelSynthesisPrompt, buildSuggestPrompt()

### Community 25 - "Module 25"
Cohesion: 0.27
Nodes (11): EdgeInputDto, MessageDto, NodeInputDto, ThreatChatDto, TrustBoundaryInputDto, IsArray, IsIn, IsOptional (+3 more)

### Community 26 - "Module 26"
Cohesion: 0.20
Nodes (8): EdgeInputDto, NodeInputDto, SubmitThreatAnalysisDto, TrustBoundaryInputDto, IsArray, IsInt, IsOptional, IsString

### Community 27 - "Module 27"
Cohesion: 0.29
Nodes (9): EdgeInputDto, NodeInputDto, ThreatAnalysisDto, TrustBoundaryDto, IsArray, IsOptional, IsString, Type (+1 more)

### Community 28 - "Module 28"
Cohesion: 0.27
Nodes (8): assertSafeResolvedHost(), isBlockedHostLiteral(), isReservedIp(), IsSafeHttpsUrl(), IsSafeHttpsUrlConstraint, NOTE: This is storage-time validation. It does NOT defend against DNS, validateSafeHttpsUrl(), ValidatorConstraint

### Community 29 - "Module 29"
Cohesion: 0.22
Nodes (9): ChatAskDto, ChatHistoryItemDto, IsArray, IsIn, IsObject, IsOptional, IsString, Type (+1 more)

### Community 30 - "Module 30"
Cohesion: 0.24
Nodes (8): SubmitPostureScoreDto, IsBoolean, IsInt, IsObject, IsOptional, IsString, PostureScoreJobPayload, PostureScoreJobResult

### Community 31 - "Module 31"
Cohesion: 0.22
Nodes (10): SaveThreatModelDto, ThreatItemDto, IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString (+2 more)

### Community 32 - "Module 32"
Cohesion: 0.24
Nodes (5): Controller, Get, Query, UseGuards, UserSettingsController

### Community 33 - "Module 33"
Cohesion: 0.25
Nodes (5): DeclutterDto, IsArray, IsOptional, IsString, buildDeclutterPrompt()

### Community 34 - "Module 34"
Cohesion: 0.39
Nodes (3): PDFDocument, ReportService, Injectable

### Community 35 - "Module 35"
Cohesion: 0.25
Nodes (6): IsNumber, PostureScoreDto, IsBoolean, IsObject, IsOptional, IsString

### Community 36 - "Module 36"
Cohesion: 0.25
Nodes (7): dist, node_modules, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 37 - "Module 37"
Cohesion: 0.29
Nodes (4): IntelSnapshot, IntelReportService, SEVERITY_ORDER, Injectable

### Community 38 - "Module 38"
Cohesion: 0.25
Nodes (7): SEVERITY_BG, SEVERITY_COLOR, SEVERITY_ORDER, STATUS_LABEL, STRIDE_LABEL, STRIDE_ORDER, ThreatRow

### Community 39 - "Module 39"
Cohesion: 0.29
Nodes (7): bullmq, class-transformer, @nestjs/core, dependencies, bullmq, class-transformer, @nestjs/core

### Community 40 - "Module 40"
Cohesion: 0.29
Nodes (7): dotenv-cli, devDependencies, dotenv-cli, prisma, @types/bcrypt, prisma, @types/bcrypt

### Community 41 - "Module 41"
Cohesion: 0.33
Nodes (3): Header, Get, Param

### Community 42 - "Module 42"
Cohesion: 0.33
Nodes (4): ChatEvaluateDto, IsArray, IsOptional, IsString

### Community 43 - "Module 43"
Cohesion: 0.33
Nodes (5): IsNotEmpty, CreateThreatDto, IsEnum, IsOptional, IsString

### Community 44 - "Module 44"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 45 - "Module 45"
Cohesion: 0.33
Nodes (4): GenerateDto, IsObject, IsOptional, IsString

### Community 46 - "Module 46"
Cohesion: 0.40
Nodes (4): LlmCallConfig, LlmProvider, LlmResponse, OLLAMA_CONTEXT_MAP

## Knowledge Gaps
- **163 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+158 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CurrentUser` connect `Threat / Intel Controllers` to `Auth Guards + Chat Controller`, `Suggest-Flow / Posture DTOs`, `Diagrams Controller (Versioning)`, `Project DTOs + Compliance`, `Onboarding`, `Users Controller`, `AI Controller (Attack/Posture/Intel)`, `Prisma / Core Services`, `AI Chat Generate`, `Module 20`, `Module 21`, `Module 23`, `Module 26`, `Module 27`, `Module 32`, `Module 33`, `Module 35`, `Module 41`, `Module 42`, `Module 45`?**
  _High betweenness centrality (0.179) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `Prisma / Core Services` to `Threat / Intel Controllers`, `Auth Guards + Chat Controller`, `Suggest-Flow / Posture DTOs`, `Diagrams Controller (Versioning)`, `Project DTOs + Compliance`, `Chroma / Queue Services`, `Auth Controller`, `Nest Modules Wiring`, `Onboarding`, `Users Controller`, `Threat Analysis Prompt`, `Attack Mind Prompt`, `Module 18`, `Module 21`, `Module 22`, `Module 24`, `Module 30`, `Module 34`, `Module 37`, `Module 38`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `AiService` connect `AI Service Core` to `Threat / Intel Controllers`, `Module 33`, `Suggest-Flow / Posture DTOs`, `Chroma / Queue Services`, `Module 37`, `Nest Modules Wiring`, `Module 41`, `Module 42`, `AI Controller (Attack/Posture/Intel)`, `Prisma / Core Services`, `AI Chat Generate`, `Module 20`, `Module 24`, `Module 26`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _163 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Threat / Intel Controllers` be split into smaller, more focused modules?**
  _Cohesion score 0.09764309764309764 - nodes in this community are weakly interconnected._
- **Should `Auth Guards + Chat Controller` be split into smaller, more focused modules?**
  _Cohesion score 0.05241090146750524 - nodes in this community are weakly interconnected._
- **Should `Suggest-Flow / Posture DTOs` be split into smaller, more focused modules?**
  _Cohesion score 0.06485671191553545 - nodes in this community are weakly interconnected._