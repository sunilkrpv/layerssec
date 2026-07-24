# Graph Report - .  (2026-07-24)

## Corpus Check
- 196 files · ~116,858 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1083 nodes · 2521 edges · 69 communities (52 shown, 17 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

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
- Module 55
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

## Communities (69 total, 17 thin omitted)

### Community 0 - "Attack Path + Canvas Overlay"
Cohesion: 0.07
Nodes (62): AttackHighlightMap, AttackPathOverlayProps, computeUpdatedLinePosition(), DiagramCanvas(), DiagramCanvasProps, EDGE_TYPES, NODE_TYPES, ArrowDir (+54 more)

### Community 1 - "Home / AI Settings Pages"
Cohesion: 0.05
Nodes (49): AiSettingsPage(), ApiKeyInputProps, fmtTokens(), MetricsTable(), MODEL_CATALOG, ModelOption, ProviderInfo, PROVIDERS (+41 more)

### Community 2 - "UI Primitives Demos"
Cohesion: 0.06
Nodes (45): DensityDemo(), ClickToEditPill(), ClickToEditPillProps, LABELS, toLabel(), VariantOf, DropdownMenu(), DropdownMenuItem (+37 more)

### Community 3 - "AI Chat Panel"
Cohesion: 0.06
Nodes (41): AIChatPanel(), AIChatPanelProps, AttackState, EXAMPLES_GENERATE, EXAMPLES_QA, mdComponents, MiniDiagramPreview, PanelTab (+33 more)

### Community 4 - "NPM Dependencies"
Cohesion: 0.04
Nodes (46): @anthropic-ai/sdk, driver.js, eslint, eslint-config-next, html-to-image, lucide-react, next, dependencies (+38 more)

### Community 5 - "Projects List + Modals"
Cohesion: 0.11
Nodes (21): NewProjectModal(), NewProjectModalProps, ProjectSideSheet(), ProjectSideSheetProps, ProjectsTable(), ProjectsTableProps, ProjectStatusPill(), ProjectStatusPillProps (+13 more)

### Community 6 - "Diagram Page Shell"
Cohesion: 0.13
Nodes (30): ExtendedRFInstance, captureCanvas(), DiagramPage(), DiagramPageProps, readCurrLayerParam(), readSelectNodeParam(), RightInspector, DrillDownModal() (+22 more)

### Community 7 - "Threat Filters + Add Modal"
Cohesion: 0.16
Nodes (20): ActiveFilterChips(), ActiveFilterChipsProps, AddThreatModal(), EMPTY_ADD, FiltersPopover(), FiltersPopoverProps, FiltersValue, StrideHeatMap() (+12 more)

### Community 8 - "TS Config / Build Types"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 9 - "AI Activity Page"
Cohesion: 0.10
Nodes (16): AIActivityPage(), ALL_STATUSES, ALL_TYPES, DATE_RANGES, DateRange, FilterPanelProps, formatDuration(), formatRelative() (+8 more)

### Community 10 - "API Client Layer"
Cohesion: 0.12
Nodes (24): AiGenerateResponse, AiModelInfo, AiModelsResponse, AiReasoningLevel, apiAttackMindStream(), apiChatEvaluate(), apiContextualChatAsk(), apiExportIntelReport() (+16 more)

### Community 11 - "Apply Diagram + Chat Composer"
Cohesion: 0.11
Nodes (19): ApplyDiagramDrawer(), ApplyOptions, LinkableShape, MiniDiagramPreview, ChatComposer(), ChatComposerProps, MaximizedPayload, MaximizeOverlay() (+11 more)

### Community 12 - "Threat History / Model Panels"
Cohesion: 0.14
Nodes (20): SEVERITY_COLORS, ThreatHistoryPanel(), ThreatHistoryPanelProps, EMPTY_FORM, isSaved(), SEVERITY_BADGE, SEVERITY_OPTIONS, SEVERITY_ORDER (+12 more)

### Community 13 - "Project Page (Split View)"
Cohesion: 0.15
Nodes (15): DiagramPage, PageProps, SplitViewProjectPage(), ProjectEditModal(), Props, CanvasPane(), CanvasPaneProps, DiagramPage (+7 more)

### Community 14 - "Flow Overlay + Kanban"
Cohesion: 0.14
Nodes (15): FlowOverlay(), FlowPath, Props, KanbanColumn(), Props, NodeCard(), Props, severityStroke() (+7 more)

### Community 15 - "All Projects Dashboard"
Cohesion: 0.15
Nodes (17): AllProjectsDashboard(), AllProjectsDashboardProps, AVATAR_COLORS, avatarColor(), FEATURE_META, initials(), relTime(), scoreBarColor() (+9 more)

### Community 16 - "Menu Bar + Theme"
Cohesion: 0.16
Nodes (18): MenuBar(), MenuBarProps, THEME_CYCLE, THEME_ICONS, THEME_LABELS, ProjectsListInner(), computeCompositeRisk(), SecurityIntelPage() (+10 more)

### Community 17 - "Layers Sidebar + Preview"
Cohesion: 0.18
Nodes (14): ApplyDiagramDrawerProps, LayerPreviewPopup(), LayerPreviewPopupProps, MiniDiagramPreview, LayersSidebar(), LayersSidebarProps, LayerTreeNode(), LayerTreeNodeProps (+6 more)

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
Cohesion: 0.14
Nodes (15): DetailTopBar(), DetailTopBarProps, mapStatus(), mapStride(), mitigationMdComponents, Props, ThreatDetailPage(), Button() (+7 more)

### Community 22 - "Module 22"
Cohesion: 0.14
Nodes (10): AboutModalProps, PIPELINE, PipelineTone, TONE_ICON, TONE_TILE, LayersLogo(), LayersLogoProps, formatLastSaved() (+2 more)

### Community 23 - "Module 23"
Cohesion: 0.16
Nodes (14): DiffNode(), MiniNode(), NodePaletteProps, COLOR_SWATCHES, ColorRowProps, FONT_FAMILIES, FONT_SIZE_PRESETS, PropertiesPanel() (+6 more)

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
Nodes (10): ChatMessage(), ChatMessageProps, DiagramBubble(), DiagramBubbleProps, MiniDiagramPreview, DiagramPayload, formatChatTime(), splitDiagramContent() (+2 more)

### Community 28 - "Module 28"
Cohesion: 0.24
Nodes (12): AVATAR_COLORS, avatarColor(), HomeSidebar(), initials(), NavItem(), postureBarColor(), postureTextColor(), SectionHeader() (+4 more)

### Community 29 - "Module 29"
Cohesion: 0.14
Nodes (7): ActionButtons(), ACTIONS, ChatBubble(), Message, NewProjectChatProps, Phase, OversizeWarning

### Community 30 - "Module 30"
Cohesion: 0.26
Nodes (9): geistSans, metadata, ThemeProvider(), ThemeContext, ThemeContextValue, getEffectiveTheme(), getStoredTheme(), saveTheme() (+1 more)

### Community 31 - "Module 31"
Cohesion: 0.24
Nodes (11): PostureRollupCard(), Props, scoreColor(), scoreTextColor(), ProjectStatsCards(), Props, scoreColor(), scoreGradeBg() (+3 more)

### Community 32 - "Module 32"
Cohesion: 0.27
Nodes (12): TrustMapPage(), buildCard(), buildTrustMapView(), collectSubtreeThreatStats(), deriveSubtitle(), makeCardKey(), NestedLayerSummary, nodeArea() (+4 more)

### Community 33 - "Module 33"
Cohesion: 0.18
Nodes (9): DiffCanvasProps, diffEdgeTypes, DiffNodeData, diffNodeTypes, STATUS_BADGE, STATUS_RING, STATUS_SYMBOL, VersionInfo (+1 more)

### Community 34 - "Module 34"
Cohesion: 0.35
Nodes (9): DiffPage(), extractLayersFromCanvasData(), apiGetDiagram(), diffByIdMap(), diffProjects(), EdgeDiff, edgeModified(), NodeDiff (+1 more)

### Community 35 - "Module 35"
Cohesion: 0.31
Nodes (10): NewProjectChat(), formatDate(), ProjectsModal(), ProjectsModalProps, apiCreateDiagram(), apiCreateProject(), apiListProjects(), Project (+2 more)

### Community 36 - "Module 36"
Cohesion: 0.36
Nodes (9): ThreatsTableProps, BoundaryAnalysisPanel(), PairGroup, Props, SEVERITY_RANK, severityBadge(), ProjectThreat, TrustMapFlow (+1 more)

### Community 37 - "Module 37"
Cohesion: 0.22
Nodes (6): DiffLayersPanelProps, STATUS_DOT, STATUS_LABEL, STATUS_ROW, LayerDiff, ProjectDiff

### Community 38 - "Module 38"
Cohesion: 0.25
Nodes (7): c4Items, cloudItems, DIAGRAM_SECTIONS, NODE_ITEMS, NodePalette(), shapeItems, UI_CATEGORIES

### Community 39 - "Module 39"
Cohesion: 0.39
Nodes (7): layerLabel(), severityValue(), statusValue(), strideValue(), ThreatsTable(), valueToStatus(), apiUpdateThreat()

### Community 40 - "Module 40"
Cohesion: 0.25
Nodes (4): MiniDiagramPreviewProps, miniEdgeTypes, MiniNodeData, miniNodeTypes

### Community 41 - "Module 41"
Cohesion: 0.29
Nodes (6): COMPLIANCE_OPTIONS, ENV_STYLES, FormState, ProjectMetadataForm(), Props, Environment

### Community 42 - "Module 42"
Cohesion: 0.36
Nodes (7): IntelReportCard(), Props, apiCreateIntelReport(), apiGetIntelReport(), apiListIntelReports(), IntelReport, IntelReportListItem

### Community 43 - "Module 43"
Cohesion: 0.33
Nodes (5): Props, StatTileProps, ThreatsRollupCard(), ThreatsSummary, apiListProjectThreats()

### Community 44 - "Module 44"
Cohesion: 0.47
Nodes (5): NewFlowDialog(), NewFlowDialogProps, apiSuggestFlow(), DiagramFull, DiagramMeta

### Community 45 - "Module 45"
Cohesion: 0.47
Nodes (5): useJobPoller(), UseJobPollerOptions, AiJobStatus, AiJobStatusResponse, apiGetJobStatus()

### Community 46 - "Module 46"
Cohesion: 0.47
Nodes (5): apiLogout(), clearTokens(), getAccessToken(), getRefreshToken(), isLoggedIn()

### Community 49 - "Module 49"
Cohesion: 0.50
Nodes (4): DeleteProjectModal(), Phase, Props, apiDeleteProject()

### Community 55 - "Module 55"
Cohesion: 0.67
Nodes (3): LayerBar(), LayerBarProps, getLayerPath()

## Knowledge Gaps
- **270 isolated node(s):** `metadata`, `DiffPage`, `geistSans`, `metadata`, `AIHistoryPage` (+265 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NodeData` connect `Attack Path + Canvas Overlay` to `Module 32`, `Diagram Page Shell`, `Module 23`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `getStoredUser()` connect `Menu Bar + Theme` to `Module 32`, `Projects List + Modals`, `Diagram Page Shell`, `Threat Filters + Add Modal`, `AI Activity Page`, `Apply Diagram + Chat Composer`, `Flow Overlay + Kanban`, `Module 46`, `Module 20`, `Module 21`, `Module 28`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `LayerMap` connect `Layers Sidebar + Preview` to `Module 32`, `Module 34`, `Diagram Page Shell`, `Apply Diagram + Chat Composer`, `Flow Overlay + Kanban`, `Module 55`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `metadata`, `DiffPage`, `geistSans` to the rest of the system?**
  _270 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Attack Path + Canvas Overlay` be split into smaller, more focused modules?**
  _Cohesion score 0.06871287128712872 - nodes in this community are weakly interconnected._
- **Should `Home / AI Settings Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.05096153846153846 - nodes in this community are weakly interconnected._
- **Should `UI Primitives Demos` be split into smaller, more focused modules?**
  _Cohesion score 0.06284153005464481 - nodes in this community are weakly interconnected._