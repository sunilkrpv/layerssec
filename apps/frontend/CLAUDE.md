# Layers — Frontend (orientation)

Next.js web app for Layers: a React Flow canvas where users build architecture diagrams and run AI
security analysis (STRIDE, posture, attack simulation, intel) on them.

**Deep detail lives in the frontend skills, not here:**
- `.claude/skills/frontend-engineer` — Next 16 / React 18 / RF11 technique, streaming + job-polling, state patterns, overlays, verification.
- `.claude/skills/design-system` — `components/ui` primitives, `AppShell`/`HomeSidebar`, the secondary-page top-bar pattern, theme/dark-mode, badge conventions, panel docking.

## Stack
- Next.js 16 App Router (`app/`, `'use client'` where needed), React 18
- React Flow 11 (`reactflow`) — canvas, custom nodes, overlays
- Tailwind CSS v3 (`darkMode: 'class'`)
- Cloud storage via `lib/api.ts` (Bearer auth); `localStorage` only for auth tokens, theme, sidebar/onboarding
- `lucide-react` icons

## Route Map (`app/`)
| Route | Purpose |
|-------|---------|
| `login` | Auth |
| `home` | Authenticated landing / projects (under `AppShell`) |
| `activity` | AI job / activity feed |
| `intel` | Security intel |
| `trust-map` | Trust-boundary map view |
| `projects/[projectId]` | Main diagram editor (`DiagramPage`) |
| `projects/[projectId]/threats[/threatId]` | Threats dashboard + detail |
| `projects/[projectId]/ai-history` | AI chat history |
| `diff` | Version diff (`?v1=&v2=`) |
| `dev/primitives` | Design-system gallery |

## Where Things Live (`components/`, `lib/`)
| Area | Files |
|------|-------|
| Canvas | `DiagramPage`, `DiagramCanvas` (`ExtendedRFInstance`), `components/nodes/*` (incl. `TrustBoundaryNode`) |
| Overlays | `ThreatOverlay`, `AttackPathOverlay`, `DeclutterOverlay` |
| Security panels | `ThreatModelPanel`, `PostureScorePanel`, `AttackMindPanel`, `ThreatsDashboardPage`, `SecurityIntelPage`, `TrustMapPage` |
| AI | `AIChatPanel`, `AIHistoryPage`, `AIActivityPage` |
| Shell / nav | `AppShell`, `HomeSidebar`, `TopBar` (shared brand + theme + user signout), `MenuBar`, `Toolbar`, `NewProjectChat`, `ProjectCommandCenter`, `PipelineNudge` |
| UI primitives | `components/ui/*` (gallery at `app/dev/primitives`) |
| Onboarding | `components/onboarding/*`, `lib/onboardingStore.ts` |
| Key lib | `api.ts` (typed client), `layerStore.ts`, `canvasContext.ts`, `diffEngine.ts`, `pipelineState.ts`, `trustMap.ts`, `threatBadges.ts`, `projectBadges.ts`, `themeStore.ts`/`themeContext.ts` |

## Key Domain Notes
- A Layers project = one backend `Project` + one `Diagram`; `canvasData = { layers: LayerMap, navStack: string[] }`.
- Versioning: draft/published; publish → read-only; checkout → new draft (latest version only, no existing draft).
- Two AI consumption patterns — SSE streaming and async job polling (`apiSubmit*` → `apiGetJobStatus`). See `frontend-engineer`.

## Verification
```bash
npx tsc --noEmit   # 0 errors
npm run build      # must succeed
```
