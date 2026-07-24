# Graph Report - frontend  (2026-07-24)

## Corpus Check
- 195 files · ~116,858 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1241 nodes · 2686 edges · 72 communities (57 shown, 15 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b89af936`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Attack Path + Canvas Overlay
- Home / AI Settings Pages
- UI Primitives Demos
- AI Chat Panel
- NPM Dependencies
- Projects List + Modals
- Diagram Page Shell
- Threat Filters + Add Modal
- TS Config / Build Types
- AI Activity Page
- API Client Layer
- Apply Diagram + Chat Composer
- Threat History / Model Panels
- Project Page (Split View)
- Flow Overlay + Kanban
- All Projects Dashboard
- Menu Bar + Theme
- Layers Sidebar + Preview
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
- Module 56
- Module 57
- Module 58
- Module 59
- Module 60
- Module 61
- Module 65
- Module 66
- Module 67
- Module 68
- Layers — Frontend (orientation)
- apiListProjectVersions
- Layers — Documentation

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 57 edges
2. `DiagramPage()` - 39 edges
3. `NodeData` - 39 edges
4. `cn()` - 32 edges
5. `RotateHandle()` - 28 edges
6. `ChildLayerBadge()` - 25 edges
7. `useTheme()` - 25 edges
8. `signOut()` - 21 edges
9. `getStoredUser()` - 21 edges
10. `ThreatSeverity` - 20 edges

## Surprising Connections (you probably didn't know these)
- `SplitViewProjectPage()` --calls--> `apiGetProject()`  [EXTRACTED]
  app/projects/[projectId]/page.tsx → lib/api.ts
- `StatCard()` --calls--> `cn()`  [EXTRACTED]
  components/AllProjectsDashboard.tsx → lib/utils.ts
- `Skeleton()` --calls--> `cn()`  [EXTRACTED]
  components/AllProjectsDashboard.tsx → lib/utils.ts
- `PathCard()` --indirect_call--> `key()`  [INFERRED]
  components/AttackMindPanel.tsx → lib/pipelineState.ts
- `AttackMindPanel()` --indirect_call--> `key()`  [INFERRED]
  components/AttackMindPanel.tsx → lib/pipelineState.ts

## Import Cycles
- None detected.

## Communities (72 total, 15 thin omitted)

### Community 0 - "Attack Path + Canvas Overlay"
Cohesion: 0.07
Nodes (64): AttackHighlightMap, AttackPathOverlayProps, computeUpdatedLinePosition(), DiagramCanvas(), DiagramCanvasProps, EDGE_TYPES, ExtendedRFInstance, NODE_TYPES (+56 more)

### Community 1 - "Home / AI Settings Pages"
Cohesion: 0.05
Nodes (49): AiSettingsPage(), ApiKeyInputProps, fmtTokens(), MetricsTable(), MODEL_CATALOG, ModelOption, ProviderInfo, PROVIDERS (+41 more)

### Community 2 - "UI Primitives Demos"
Cohesion: 0.05
Nodes (52): DensityDemo(), c4Items, cloudItems, DIAGRAM_SECTIONS, NODE_ITEMS, NodePalette(), shapeItems, UI_CATEGORIES (+44 more)

### Community 3 - "AI Chat Panel"
Cohesion: 0.08
Nodes (27): AIChatPanel(), AIChatPanelProps, AttackState, EXAMPLES_GENERATE, EXAMPLES_QA, mdComponents, MiniDiagramPreview, PanelTab (+19 more)

### Community 4 - "NPM Dependencies"
Cohesion: 0.04
Nodes (46): @anthropic-ai/sdk, driver.js, eslint, eslint-config-next, html-to-image, lucide-react, next, dependencies (+38 more)

### Community 5 - "Projects List + Modals"
Cohesion: 0.20
Nodes (13): ProjectSideSheet(), ProjectSideSheetProps, ProjectsTable(), ProjectsTableProps, ProjectStatusPill(), ProjectStatusPillProps, VersionList(), VersionListProps (+5 more)

### Community 6 - "Diagram Page Shell"
Cohesion: 0.15
Nodes (25): captureCanvas(), DiagramPage(), DiagramPageProps, readCurrLayerParam(), readSelectNodeParam(), RightInspector, DrillDownModal(), DrillDownModalProps (+17 more)

### Community 7 - "Threat Filters + Add Modal"
Cohesion: 0.19
Nodes (13): ActiveFilterChips(), ActiveFilterChipsProps, FiltersPopover(), FiltersPopoverProps, FiltersValue, StrideCategory, SEV_SHORT, SEVERITY_COLOR_RGB (+5 more)

### Community 8 - "TS Config / Build Types"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 9 - "AI Activity Page"
Cohesion: 0.08
Nodes (17): metadata, AIActivityPage(), ALL_STATUSES, ALL_TYPES, DATE_RANGES, DateRange, FilterPanelProps, formatDuration() (+9 more)

### Community 10 - "API Client Layer"
Cohesion: 0.08
Nodes (42): IntelReportCard(), Props, AiGenerateResponse, AiModelInfo, AiModelsResponse, AiReasoningLevel, apiAttackMindStream(), apiChatEvaluate() (+34 more)

### Community 11 - "Apply Diagram + Chat Composer"
Cohesion: 0.06
Nodes (43): ApplyDiagramDrawer(), ApplyDiagramDrawerProps, ApplyOptions, LinkableShape, MiniDiagramPreview, ChatComposer(), ChatComposerProps, ChatMessage() (+35 more)

### Community 12 - "Threat History / Model Panels"
Cohesion: 0.16
Nodes (18): SEVERITY_COLORS, ThreatHistoryPanel(), ThreatHistoryPanelProps, EMPTY_FORM, isSaved(), SEVERITY_BADGE, SEVERITY_OPTIONS, SEVERITY_ORDER (+10 more)

### Community 13 - "Project Page (Split View)"
Cohesion: 0.14
Nodes (12): DiagramPage, PageProps, SplitViewProjectPage(), NodeContextMenuProps, CanvasPane(), CanvasPaneProps, DiagramPage, RailSelection (+4 more)

### Community 14 - "Flow Overlay + Kanban"
Cohesion: 0.10
Nodes (33): BoundaryAnalysisPanel(), PairGroup, Props, SEVERITY_RANK, FlowOverlay(), FlowPath, Props, KanbanColumn() (+25 more)

### Community 15 - "All Projects Dashboard"
Cohesion: 0.16
Nodes (15): AllProjectsDashboard(), AllProjectsDashboardProps, AVATAR_COLORS, avatarColor(), FEATURE_META, initials(), relTime(), scoreBarColor() (+7 more)

### Community 16 - "Menu Bar + Theme"
Cohesion: 0.17
Nodes (16): AIHistoryPage(), NewProjectModal(), NewProjectModalProps, ProjectsListInner(), StatusFilter, computeCompositeRisk(), SecurityIntelPage(), ThreatsDashboardPage() (+8 more)

### Community 17 - "Layers Sidebar + Preview"
Cohesion: 0.08
Nodes (24): Add a node, Assign an orphaned layer, Canvas Controls, Copy & Paste, Diagrams & Canvas, Draw a connection, Edit a connection, Edit a label (+16 more)

### Community 18 - "Module 18"
Cohesion: 0.13
Nodes (16): AttackMindHighlight, AttackMindPanel(), AttackMindPanelProps, LIKELIHOOD_COLORS, PathCardProps, SEVERITY_COLORS, STEP_LIKELIHOOD_DOT, Tab (+8 more)

### Community 19 - "Module 19"
Cohesion: 0.18
Nodes (17): CircularGauge(), DimensionBar(), HistoryRow(), LayerScoreRow(), PostureScorePanel(), PostureScorePanelProps, scoreBgClass(), scoreColor() (+9 more)

### Community 20 - "Module 20"
Cohesion: 0.11
Nodes (13): AttackSurfacePanel(), IntelState, LIKELIHOOD_LABEL, parseAttackPaths(), Props, RiskLevel, SEV_CLS, SEVERITY_COLORS (+5 more)

### Community 21 - "Module 21"
Cohesion: 0.20
Nodes (11): DetailTopBar(), DetailTopBarProps, mapStatus(), mapStride(), mitigationMdComponents, Props, ThreatDetailPage(), apiChatAsk() (+3 more)

### Community 22 - "Module 22"
Cohesion: 0.14
Nodes (8): AboutModalProps, PIPELINE, PipelineTone, TONE_ICON, TONE_TILE, formatLastSaved(), Toolbar(), ToolbarProps

### Community 23 - "Module 23"
Cohesion: 0.05
Nodes (41): DiffCanvasProps, diffEdgeTypes, DiffNode(), DiffNodeData, diffNodeTypes, STATUS_BADGE, STATUS_RING, STATUS_SYMBOL (+33 more)

### Community 24 - "Module 24"
Cohesion: 0.17
Nodes (14): Message, NodeThreatData, SEVERITY_DOT_CLS, SEVERITY_ORDER, ThreatOverlayProps, isSaved(), SEVERITY_CONFIG, STRIDE_CONFIG (+6 more)

### Community 25 - "Module 25"
Cohesion: 0.25
Nodes (11): AuthModal(), AuthModalProps, Tab, CAPABILITIES, LoginPage(), apiGetMe(), apiLogin(), apiRegister() (+3 more)

### Community 26 - "Module 26"
Cohesion: 0.18
Nodes (15): ACTIVITY_COLORS, ACTIVITY_ICONS, ActivityItem(), AttackCard(), LayerRow(), PostureCard(), ProjectCommandCenter(), relativeTime() (+7 more)

### Community 27 - "Module 27"
Cohesion: 0.25
Nodes (14): PathCard(), PipelineNudge(), PipelineNudgeProps, apiGetPipelineStatus(), apiSubmitPostureScore(), apiSubmitThreatAnalysis(), PipelineJobStatus, advanceToNudge() (+6 more)

### Community 28 - "Module 28"
Cohesion: 0.27
Nodes (10): AVATAR_COLORS, avatarColor(), HomeSidebar(), HomeSidebarProps, initials(), NavItem(), postureBarColor(), postureTextColor() (+2 more)

### Community 29 - "Module 29"
Cohesion: 0.14
Nodes (7): ActionButtons(), ACTIONS, ChatBubble(), Message, NewProjectChatProps, Phase, OversizeWarning

### Community 30 - "Module 30"
Cohesion: 0.18
Nodes (13): geistSans, metadata, ThemeProvider(), THEME_CYCLE, THEME_ICONS, THEME_LABELS, TopBarProps, ThemeContext (+5 more)

### Community 31 - "Module 31"
Cohesion: 0.15
Nodes (18): LeftRailDiagram, Props, PostureRollupCard(), Props, scoreColor(), scoreTextColor(), ProjectStatsCards(), Props (+10 more)

### Community 32 - "Module 32"
Cohesion: 0.12
Nodes (16): Act on the Results, ATT&CK Techniques Referenced, Attack Mind Simulator, Attack Path Cards, Canvas highlighting, Entry Point Analysis, Extended Thinking, Kill Chain Steps (+8 more)

### Community 33 - "Module 33"
Cohesion: 0.14
Nodes (14): Add a threat manually, Add mitigation notes, Change threat status, Dismiss or delete, How the AI Applies STRIDE, Manage Threats, Next Steps, Run a Threat Analysis (+6 more)

### Community 34 - "Module 34"
Cohesion: 0.15
Nodes (13): AI Assistant, AI History & Contextual Chat, Ask follow-up questions, Evaluate Your Architecture, Extended Thinking, Generate a Diagram, Generate a new layer, How the AI Understands Your Diagram (+5 more)

### Community 35 - "Module 35"
Cohesion: 0.33
Nodes (10): NewProjectChat(), formatDate(), ProjectsModal(), ProjectsModalProps, apiCreateDiagram(), apiCreateProject(), apiGetDiagram(), apiGetProject() (+2 more)

### Community 36 - "Module 36"
Cohesion: 0.17
Nodes (14): AddThreatModal(), AddThreatModalProps, EMPTY_ADD, StrideHeatMap(), StrideHeatMapProps, ThreatsTableProps, Props, Button() (+6 more)

### Community 37 - "Module 37"
Cohesion: 0.17
Nodes (12): Add a Threat Manually, Change Threat Status, Dashboard Layout, Delete a Threat Model, Export PDF Report, Navigate to a Threat on the Canvas, Next Steps, Pagination (+4 more)

### Community 38 - "Module 38"
Cohesion: 0.17
Nodes (12): Add a Trust Boundary, Best Practices, Connect nodes across boundaries with labeled edges, Cover all trust level changes, Example layout, How the AI Uses Trust Boundaries, Keep boundaries non-overlapping where possible, Label the Boundary (+4 more)

### Community 39 - "Module 39"
Cohesion: 0.39
Nodes (7): layerLabel(), severityValue(), statusValue(), strideValue(), ThreatsTable(), valueToStatus(), ThreatStatus

### Community 40 - "Module 40"
Cohesion: 0.18
Nodes (11): 1. Sign In or Continue Locally, 2. Create a Cloud Project, 3. Draw Your First Diagram, 4. Save Your Work, 5. Undo / Redo, Add nodes, Connect nodes, Getting Started (+3 more)

### Community 41 - "Module 41"
Cohesion: 0.29
Nodes (6): COMPLIANCE_OPTIONS, ENV_STYLES, FormState, ProjectMetadataForm(), Props, Environment

### Community 42 - "Module 42"
Cohesion: 0.18
Nodes (11): Deductions and Strengths, Extended Thinking, Next Steps, Open the Posture Score Panel, Reading the Score, Recalculate, Score History, Security Posture Score (+3 more)

### Community 43 - "Module 43"
Cohesion: 0.22
Nodes (8): App Shell & Navigation, Badge Conventions, Cross-links, Layers — Design System, Panel Docking, Secondary-Page Top-Bar Pattern, Theme / Dark Mode, UI Primitives (`components/ui/`, re-exported from `index.ts`)

### Community 44 - "Module 44"
Cohesion: 0.27
Nodes (9): LeftRailDiagramList(), Props, RailItem(), NewFlowDialog(), NewFlowDialogProps, apiSuggestFlow(), DiagramFull, DiagramMeta (+1 more)

### Community 45 - "Module 45"
Cohesion: 0.47
Nodes (5): useJobPoller(), UseJobPollerOptions, AiJobStatus, AiJobStatusResponse, apiGetJobStatus()

### Community 46 - "Module 46"
Cohesion: 0.22
Nodes (8): AI Integration Patterns, Coding Standards, Core Expertise, Cross-links, Key Patterns (Layers-specific), Layers — Frontend Engineering Skills, React Flow Overlays, Verification

### Community 48 - "Module 48"
Cohesion: 0.25
Nodes (7): LayersLogo(), LayersLogoProps, MenuBar(), MenuBarProps, THEME_CYCLE, THEME_ICONS, THEME_LABELS

### Community 49 - "Module 49"
Cohesion: 0.24
Nodes (8): ProjectEditModal(), Props, DeleteProjectModal(), Phase, Props, ProjectOverviewPane(), apiDeleteProject(), apiUpdateProject()

### Community 57 - "Module 57"
Cohesion: 0.25
Nodes (7): Layers, Prerequisites, Run Locally, Run with Docker, Setup, Start, Verify

### Community 69 - "Layers — Frontend (orientation)"
Cohesion: 0.29
Nodes (6): Key Domain Notes, Layers — Frontend (orientation), Route Map (`app/`), Stack, Verification, Where Things Live (`components/`, `lib/`)

### Community 70 - "apiListProjectVersions"
Cohesion: 0.67
Nodes (3): VersionCompareSheet(), VersionCompareSheetProps, apiListProjectVersions()

### Community 71 - "Layers — Documentation"
Cohesion: 0.67
Nodes (3): Guides, Layers — Documentation, Quick Links

## Knowledge Gaps
- **389 isolated node(s):** `metadata`, `DiffPage`, `geistSans`, `metadata`, `AIHistoryPage` (+384 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NodeData` connect `Attack Path + Canvas Overlay` to `Flow Overlay + Kanban`, `Diagram Page Shell`, `Module 23`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `getStoredUser()` connect `Menu Bar + Theme` to `Module 36`, `Diagram Page Shell`, `AI Activity Page`, `Apply Diagram + Chat Composer`, `Flow Overlay + Kanban`, `Module 20`, `Module 21`, `Module 28`, `Module 30`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `LayerMap` connect `Apply Diagram + Chat Composer` to `Flow Overlay + Kanban`, `Diagram Page Shell`, `Module 23`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `metadata`, `DiffPage`, `geistSans` to the rest of the system?**
  _389 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Attack Path + Canvas Overlay` be split into smaller, more focused modules?**
  _Cohesion score 0.06643822577574719 - nodes in this community are weakly interconnected._
- **Should `Home / AI Settings Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.05096153846153846 - nodes in this community are weakly interconnected._
- **Should `UI Primitives Demos` be split into smaller, more focused modules?**
  _Cohesion score 0.05300207039337474 - nodes in this community are weakly interconnected._