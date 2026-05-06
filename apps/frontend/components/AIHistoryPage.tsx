'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, BarChart2, Cpu, Layers,
  MessageSquare, Monitor, Moon, PlusCircle, Sparkles, SquarePen,
  Sun, User, LogOut,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { MaximizeOverlay, type MaximizedPayload } from '@/components/ai-history/MaximizeOverlay';
import { LayersSidebar } from '@/components/ai-history/LayersSidebar';
import { LayerPreviewPopup } from '@/components/ai-history/LayerPreviewPopup';
import { ChatMessage as ChatMessageComponent } from '@/components/ai-history/ChatMessage';
import { ChatComposer } from '@/components/ai-history/ChatComposer';
import { ApplyDiagramDrawer } from '@/components/ai-history/ApplyDiagramDrawer';
import {
  apiContextualChatAsk, apiGetChatHistory, apiGetProject, apiGetProjectDraft,
  apiUpdateDiagram, ApiUnauthorizedError, apiListActivity, type ChatMessage,
} from '@/lib/api';
import { ROOT_LAYER_ID, type Layer, type LayerMap } from '@/lib/layerStore';
import { getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';
import {
  formatChatDate, isSameDay, splitDiagramContent,
  type DiagramPayload,
} from '@/lib/aiHistoryHelpers';

// ── Types ────────────────────────────────────────────────────────────────────

type LinkableShape = {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  layerId: string;
  layerName: string;
};

type UIItem =
  | { kind: 'message'; data: ChatMessage }
  | { kind: 'streaming'; content: string }
  | { kind: 'separator' }
  | { kind: 'posture_score'; jobId: string; createdAt: string; score: number; summary: string; topRecs: string[] }
  | { kind: 'attack_mind'; jobId: string; createdAt: string; simulationId: string; entryPoint: string; summary: string };


// ── Main component ────────────────────────────────────────────────────────────

interface AIHistoryPageProps { projectId: string }

export default function AIHistoryPage({ projectId }: AIHistoryPageProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const storedUser = typeof window !== 'undefined' ? getStoredUser() : null;

  // ── Core chat state ──────────────────────────────────────────────────────
  const [uiItems, setUiItems] = useState<UIItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingRef = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Project / layers ─────────────────────────────────────────────────────
  const [projectName, setProjectName] = useState<string | null>(null);
  const [diagramLayers, setDiagramLayers] = useState<LayerMap | null>(null);
  const [diagramId, setDiagramId] = useState<string | null>(null);

  // ── Layer sidebar UI ─────────────────────────────────────────────────────
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set([ROOT_LAYER_ID]));
  const [previewLayerId, setPreviewLayerId] = useState<string | null>(null);
  const [previewAnchorRect, setPreviewAnchorRect] = useState<DOMRect | null>(null);

  // ── Multi-attach state (cap 3) ───────────────────────────────────────────
  const ATTACH_CAP = 3;
  const [attachedLayers, setAttachedLayers] = useState<Layer[]>([]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('ai_history_sidebar_collapsed') === '1';
  });

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        if (next) window.localStorage.setItem('ai_history_sidebar_collapsed', '1');
        else window.localStorage.removeItem('ai_history_sidebar_collapsed');
      } catch {}
      return next;
    });
  }, []);

  const handleAttachToggle = useCallback((layer: Layer) => {
    setAttachedLayers((prev) => {
      if (prev.some((l) => l.id === layer.id)) {
        return prev.filter((l) => l.id !== layer.id);
      }
      if (prev.length >= ATTACH_CAP) return prev;
      return [...prev, layer];
    });
  }, []);

  const handleDetachLayer = useCallback((layerId: string) => {
    setAttachedLayers((prev) => prev.filter((l) => l.id !== layerId));
  }, []);

  const attachDisabled = useCallback(
    (layer: Layer) => !attachedLayers.some((l) => l.id === layer.id) && attachedLayers.length >= ATTACH_CAP,
    [attachedLayers],
  );

  // ── Apply diagram modal ──────────────────────────────────────────────────
  const [applyTarget, setApplyTarget] = useState<DiagramPayload | null>(null);

  // ── Maximize overlay ──────────────────────────────────────────────────────
  const [maximizedDiagram, setMaximizedDiagram] = useState<MaximizedPayload | null>(null);

  const messageCount = uiItems.filter((i) => i.kind === 'message').length;

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    const historyP = Promise.all([
      apiGetChatHistory(projectId),
      apiListActivity({
        types: ['POSTURE_SCORE', 'ATTACK_SIMULATION'],
        statuses: ['COMPLETED'],
        limit: 50,
      }).catch(() => ({ jobs: [], total: 0 })),
    ])
      .then(([msgs, activityData]) => {
        const msgItems: UIItem[] = msgs.map((m) => ({ kind: 'message', data: m }));
        const activityItems: UIItem[] = activityData.jobs.flatMap((job): UIItem[] => {
          if (job.type === 'POSTURE_SCORE') {
            return [{ kind: 'posture_score', jobId: job.id, createdAt: job.createdAt, score: 0, summary: '', topRecs: [] }];
          }
          if (job.type === 'ATTACK_SIMULATION') {
            return [{ kind: 'attack_mind', jobId: job.id, createdAt: job.createdAt, simulationId: job.resultRef ?? '', entryPoint: 'Auto', summary: '' }];
          }
          return [];
        });
        const getItemTime = (item: UIItem): number => {
          if (item.kind === 'message') return new Date(item.data.createdAt).getTime();
          if (item.kind === 'posture_score' || item.kind === 'attack_mind') return new Date(item.createdAt).getTime();
          return 0;
        };
        const allItems = [...msgItems, ...activityItems].sort((a, b) => getItemTime(a) - getItemTime(b));
        setUiItems(allItems);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiUnauthorizedError) { router.push('/projects'); return; }
        setError('Failed to load chat history.');
        setIsLoading(false);
      });

    const projectP = apiGetProject(projectId)
      .then((p) => setProjectName(p.name))
      .catch(() => {});

    const layersP = apiGetProjectDraft(projectId)
      .then((draft) => {
        if (!draft) return;
        setDiagramId(draft.id);
        const data = draft.canvasData as { layers?: LayerMap } | null;
        if (data?.layers && typeof data.layers === 'object') {
          setDiagramLayers(data.layers);
          setExpandedLayers(new Set([ROOT_LAYER_ID]));
        }
      })
      .catch(() => {});

    void Promise.all([historyP, projectP, layersP]);
  }, [projectId, router]);

  // ── Scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uiItems]);

  // ── Prevent navigation while streaming ───────────────────────────────────
  useEffect(() => {
    if (!isStreaming) return;
    const fn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [isStreaming]);

  // ── Layer sidebar helpers ─────────────────────────────────────────────────
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handlePreview = useCallback((id: string, rect: DOMRect) => {
    setPreviewLayerId((prev) => (prev === id ? null : id));
    setPreviewAnchorRect(rect);
  }, []);

  // ── Chat history builder ─────────────────────────────────────────────────
  function buildHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    let start = 0;
    for (let i = uiItems.length - 1; i >= 0; i--) {
      if (uiItems[i].kind === 'separator') { start = i + 1; break; }
    }
    return uiItems
      .slice(start)
      .filter((item): item is { kind: 'message'; data: ChatMessage } => item.kind === 'message')
      .slice(-20)
      .map((item) => ({ role: item.data.role, content: item.data.content }));
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function handleSend() {
    const userText = input.trim();
    if (!userText || isStreaming) return;
    setInput('');

    const history = buildHistory();

    // Build the prompt to send (with layer context prefix if attached)
    const promptToSend = attachedLayers.length > 0
      ? `Layers in scope: ${attachedLayers.map((l) => l.name).join(', ')}\n\n${userText}`
      : userText;

    const fakeUserMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      projectId,
      role: 'user',
      content: userText,
      layerId: attachedLayers[0]?.id ?? null,
      layerName: attachedLayers[0]?.name ?? null,
      createdAt: new Date().toISOString(),
    };

    setUiItems((prev) => [
      ...prev,
      { kind: 'message', data: fakeUserMsg },
      { kind: 'streaming', content: '' },
    ]);
    setIsStreaming(true);
    streamingRef.current = '';

    try {
      await apiContextualChatAsk(
        { message: promptToSend, projectId, diagramId: diagramId ?? undefined, history },
        (chunk) => {
          streamingRef.current += chunk;
          const accumulated = streamingRef.current;
          setUiItems((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (next[lastIdx]?.kind === 'streaming') {
              next[lastIdx] = { kind: 'streaming', content: accumulated };
            }
            return next;
          });
        },
      );

      // Parse diagram from full response
      const { text: textContent, diagram } = splitDiagramContent(streamingRef.current);

      const assistantMsg: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        projectId,
        role: 'assistant',
        content: textContent,
        layerId: attachedLayers[0]?.id ?? null,
        layerName: attachedLayers[0]?.name ?? null,
        diagramData: diagram,
        createdAt: new Date().toISOString(),
      };

      setUiItems((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (next[lastIdx]?.kind === 'streaming') {
          next[lastIdx] = { kind: 'message', data: assistantMsg };
        }
        return next;
      });
    } catch {
      setUiItems((prev) => prev.filter((i) => i.kind !== 'streaming'));
    } finally {
      setIsStreaming(false);
    }
  }

  function handleNewConversation() {
    setUiItems((prev) => [...prev, { kind: 'separator' }]);
    setAttachedLayers([]);
    textareaRef.current?.focus();
  }

  // ── Apply diagram to layer ────────────────────────────────────────────────
  async function handleApplyDiagram(opts: {
    mode: 'override' | 'new';
    targetLayerId?: string;
    newLayerName?: string;
    linkToNode?: LinkableShape;
  }) {
    if (!applyTarget || !diagramLayers || !diagramId) return;
    setApplyTarget(null);

    const updatedLayers = { ...diagramLayers };

    if (opts.mode === 'new') {
      const newId = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      updatedLayers[newId] = {
        id: newId,
        name: opts.newLayerName ?? 'AI Generated Layer',
        parentLayerId: ROOT_LAYER_ID,
        parentNodeId: null,
        nodes: applyTarget.nodes as import('reactflow').Node[],
        edges: applyTarget.edges as import('reactflow').Edge[],
        createdAt: Date.now(),
      };
      // Link new layer to chosen shape by setting _childLayerId on that node
      if (opts.linkToNode) {
        const { nodeId, layerId } = opts.linkToNode;
        const targetLayer = updatedLayers[layerId];
        if (targetLayer) {
          updatedLayers[layerId] = {
            ...targetLayer,
            nodes: targetLayer.nodes.map((n: import('reactflow').Node) =>
              n.id === nodeId
                ? { ...n, data: { ...n.data, _childLayerId: newId } }
                : n
            ),
          };
        }
      }
    } else {
      // Override existing layer nodes/edges
      const targetLayerId = opts.targetLayerId;
      if (!targetLayerId) return;
      const existing = updatedLayers[targetLayerId];
      if (!existing) return;
      updatedLayers[targetLayerId] = {
        ...existing,
        nodes: applyTarget.nodes as import('reactflow').Node[],
        edges: applyTarget.edges as import('reactflow').Edge[],
      };
    }

    setDiagramLayers(updatedLayers);

    // Persist to backend
    try {
      const canvasData = { layers: updatedLayers, navStack: [ROOT_LAYER_ID] };
      await apiUpdateDiagram(diagramId, canvasData);
    } catch {
      // non-critical — user can still go back to diagram and save manually
    }
  }

  // ── Layer preview popup layer ─────────────────────────────────────────────
  const previewLayer = previewLayerId && diagramLayers ? diagramLayers[previewLayerId] : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">

      {/* Top bar — matches MenuBar style */}
      <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        {/* Logo */}
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <LayersLogo size={14} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
        </div>

        {/* Back + page context */}
        <button
          onClick={() => !isStreaming && router.push(`/projects/${projectId}`)}
          disabled={isStreaming}
          className="flex items-center gap-1.5 rounded px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <ArrowLeft size={13} />
          Back to diagram
        </button>

        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-blue-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {projectName ?? 'AI History'}
          </span>
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-slate-400 dark:text-slate-500 mr-2">
            {messageCount} message{messageCount !== 1 ? 's' : ''}
          </span>

          <button
            onClick={handleNewConversation}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <SquarePen size={12} />
            New
          </button>

          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

          {/* Theme cycle */}
          <button
            onClick={() => {
              const cycle = ['light', 'dark', 'system'] as const;
              setTheme(cycle[(cycle.indexOf(theme) + 1) % cycle.length]);
            }}
            title={`Theme: ${theme} — click to cycle`}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
            <span className="hidden sm:inline capitalize">{theme}</span>
          </button>

          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

          {/* User + sign out */}
          {storedUser && (
            <button
              onClick={() => { signOut(); router.push('/login'); }}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title="Sign out"
            >
              <User size={13} className="text-slate-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">
                {storedUser.email}
              </span>
              <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>
      </header>

      {/* Body: sidebar + chat */}
      <div className="flex flex-1 overflow-hidden">

        {/* Layers sidebar */}
        <LayersSidebar
          diagramLayers={diagramLayers}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={handleToggleSidebar}
          expandedLayerIds={expandedLayers}
          onToggleExpand={handleToggleExpand}
          onPreview={handlePreview}
          attachedLayerIds={attachedLayers.map((l) => l.id)}
          onAttachToggle={handleAttachToggle}
          attachDisabled={attachDisabled}
        />

        {/* Layer preview popup */}
        {previewLayer && previewAnchorRect && (
          <LayerPreviewPopup
            layer={previewLayer}
            anchorRect={previewAnchorRect}
            isAttached={attachedLayers.some((l) => l.id === previewLayer.id)}
            onAttach={() => handleAttachToggle(previewLayer)}
            onClose={() => setPreviewLayerId(null)}
            onMaximize={() => setMaximizedDiagram({
              nodes: previewLayer.nodes,
              edges: previewLayer.edges,
              layerName: previewLayer.name,
            })}
          />
        )}

        {/* Chat column */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Message list */}
          <div className="flex-1 overflow-y-auto bg-white px-4 py-4 dark:bg-gray-950">
            {isLoading && (
              <div className="flex items-center justify-center py-20 text-sm text-gray-400 dark:text-blue-300/60">
                Loading history…
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center py-20 text-sm text-red-500 dark:text-red-400">{error}</div>
            )}
            {!isLoading && !error && uiItems.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 ring-1 ring-gray-200 dark:bg-white/10 dark:ring-white/20">
                  <MessageSquare size={24} className="text-gray-400 dark:text-blue-300/60" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-indigo-200/70">No AI conversations yet</p>
                <p className="max-w-xs text-xs text-gray-400 dark:text-blue-300/40">
                  Attach a layer from the sidebar, then ask a question or request changes.
                </p>
              </div>
            )}

            {!isLoading && !error && uiItems.length > 0 && (
              <div className="mx-auto max-w-4xl space-y-4">
                {uiItems.map((item, i) => {
                  if (item.kind === 'separator') {
                    return (
                      <div key={`sep-${i}`} className="flex items-center gap-3 py-3">
                        <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-gray-400 dark:text-blue-300/40">
                          <PlusCircle size={10} /> New conversation
                        </span>
                        <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                      </div>
                    );
                  }

                  if (item.kind === 'posture_score') {
                    return (
                      <div key={`posture-${item.jobId}`} className="flex gap-3">
                        <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 ring-1 ring-purple-200 dark:bg-slate-700 dark:ring-slate-600">
                          <BarChart2 size={11} className="text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">Posture Score</span>
                            <span className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${item.score >= 70 ? 'text-emerald-600' : item.score >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{item.score}</span>
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{item.summary}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (item.kind === 'attack_mind') {
                    return (
                      <div key={`attack-${item.jobId}`} className="flex gap-3">
                        <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 ring-1 ring-orange-200 dark:bg-slate-700 dark:ring-slate-600">
                          <Cpu size={11} className="text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">Attack Mind</span>
                            <span className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mb-0.5">Entry: <span className="font-medium text-slate-600 dark:text-slate-300">{item.entryPoint}</span></div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{item.summary}</p>
                        </div>
                      </div>
                    );
                  }

                  if (item.kind === 'message') {
                    const msg = item.data;
                    const prevMsg = (() => {
                      for (let j = i - 1; j >= 0; j--) {
                        if (uiItems[j].kind === 'message') return (uiItems[j] as { kind: 'message'; data: ChatMessage }).data;
                      }
                      return null;
                    })();
                    const showDateSep = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
                    return (
                      <div key={msg.id}>
                        {showDateSep && (
                          <div className="flex items-center gap-3 py-2">
                            <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                            <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400 dark:text-blue-300/40">
                              {formatChatDate(msg.createdAt)}
                            </span>
                            <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                          </div>
                        )}
                        <ChatMessageComponent
                          key={`m-${i}-${msg.id}`}
                          msg={msg}
                          onApplyDiagram={(d) => setApplyTarget(d)}
                          onMaximizeDiagram={(d, layerName) => setMaximizedDiagram({
                            nodes: d.nodes,
                            edges: d.edges,
                            layerName,
                          })}
                        />
                      </div>
                    );
                  }

                  if (item.kind === 'streaming') {
                    const fakeMsg: ChatMessage = {
                      id: `streaming-${i}`,
                      projectId,
                      role: 'assistant',
                      content: '',
                      layerId: attachedLayers[0]?.id ?? null,
                      layerName: attachedLayers[0]?.name ?? null,
                      createdAt: new Date().toISOString(),
                    };
                    return (
                      <ChatMessageComponent
                        key={`s-${i}`}
                        msg={fakeMsg}
                        streamingContent={item.content}
                        extraLayerNames={attachedLayers.slice(1).map((l) => l.name)}
                        onApplyDiagram={(d) => setApplyTarget(d)}
                        onMaximizeDiagram={(d, layerName) => setMaximizedDiagram({
                          nodes: d.nodes,
                          edges: d.edges,
                          layerName,
                        })}
                      />
                    );
                  }

                  return null;
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <ChatComposer
            textareaRef={textareaRef}
            input={input}
            onInputChange={setInput}
            attachedLayers={attachedLayers}
            onDetachLayer={handleDetachLayer}
            onSend={() => void handleSend()}
            isStreaming={isStreaming}
            isLoading={isLoading}
            attachCap={ATTACH_CAP}
          />
        </div>{/* end chat column */}
      </div>{/* end body row */}

      {/* Apply diagram drawer */}
      {applyTarget && diagramLayers && (
        <ApplyDiagramDrawer
          diagram={applyTarget}
          attachedLayers={attachedLayers}
          allLayers={diagramLayers}
          onApply={handleApplyDiagram}
          onClose={() => setApplyTarget(null)}
        />
      )}

      {/* Maximize overlay */}
      <MaximizeOverlay payload={maximizedDiagram} onClose={() => setMaximizedDiagram(null)} />
    </div>
  );
}
