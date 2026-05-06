'use client';

import { useState } from 'react';
import { StatusPill, Tooltip, IconButton, Button, EmptyState, SeverityStripeRow, DropdownMenu, ClickToEditPill, PostureBar, useDensity, densityClasses, SearchGridPalette } from '@/components/ui';
import { RefreshCw, Trash2, FolderOpen, AlertCircle, AlertTriangle, Activity, TrendingUp, X, Box, Circle, Square, Triangle, Database, Cloud, MoreHorizontal, Copy, GitCompareArrows, PanelRight, ChevronDown, Sparkles, ShieldAlert, Gauge, Sword, Layers } from 'lucide-react';

function ClickToEditPillDemo() {
  const [status, setStatus] = useState<'open' | 'in-review' | 'mitigated' | 'dismissed' | 'accepted'>('open');
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-600 dark:text-slate-400">Click the pill →</span>
      <ClickToEditPill
        variant="status"
        value={status}
        options={['open', 'in-review', 'mitigated', 'dismissed', 'accepted']}
        onChange={(v) => setStatus(v as typeof status)}
      />
      <span className="text-xs text-slate-500 dark:text-slate-400">current: {status}</span>
    </div>
  );
}

function SearchGridPaletteDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="h-[320px] w-[320px] rounded border border-slate-200 dark:border-slate-800">
      <SearchGridPalette
        categories={[
          { id: 'all', label: 'All' },
          { id: 'cloud', label: 'Cloud' },
          { id: 'shape', label: 'Shape' },
        ]}
        items={[
          { id: 'box', name: 'Box', category: 'shape', icon: <Box size={18} /> },
          { id: 'circle', name: 'Circle', category: 'shape', icon: <Circle size={18} /> },
          { id: 'square', name: 'Square', category: 'shape', icon: <Square size={18} /> },
          { id: 'triangle', name: 'Triangle', category: 'shape', icon: <Triangle size={18} /> },
          { id: 'database', name: 'Database', category: 'cloud', icon: <Database size={18} /> },
          { id: 'cloud', name: 'Cloud', category: 'cloud', icon: <Cloud size={18} /> },
        ]}
        selectedId={selected}
        onSelect={setSelected}
      />
    </div>
  );
}

export default function PrimitivesPage() {
  return (
    <div className="space-y-10">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Every primitive renders below. Use the theme toggle in the header to verify both modes.
      </p>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">StatusPill</h2>
        <div className="flex flex-wrap gap-2">
          <StatusPill variant="severity" value="critical" />
          <StatusPill variant="severity" value="high" />
          <StatusPill variant="severity" value="medium" />
          <StatusPill variant="severity" value="low" />
          <StatusPill variant="severity" value="info" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusPill variant="stride" value="spoofing" />
          <StatusPill variant="stride" value="tampering" />
          <StatusPill variant="stride" value="repudiation" />
          <StatusPill variant="stride" value="info-disclosure" />
          <StatusPill variant="stride" value="dos" />
          <StatusPill variant="stride" value="elevation" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusPill variant="status" value="open" />
          <StatusPill variant="status" value="in-review" />
          <StatusPill variant="status" value="mitigated" />
          <StatusPill variant="status" value="dismissed" />
          <StatusPill variant="status" value="accepted" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusPill variant="source" value="ai" />
          <StatusPill variant="source" value="user" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusPill variant="trust" value="internal" />
          <StatusPill variant="trust" value="dmz" />
          <StatusPill variant="trust" value="external" />
          <StatusPill variant="trust" value="internet" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tooltip</h2>
        <div className="flex gap-4">
          <Tooltip content="Hello from a tooltip">
            <button className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700">Hover me</button>
          </Tooltip>
          <Tooltip content="Focusable via keyboard too">
            <button className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700">Focus me</button>
          </Tooltip>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">IconButton</h2>
        <div className="flex items-center gap-3">
          <IconButton label="Refresh posture" icon={<RefreshCw size={14} />} onClick={() => {}} />
          <IconButton label="Delete this item" icon={<Trash2 size={14} />} variant="destructive" onClick={() => {}} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Button</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary link</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">EmptyState</h2>
        <div className="rounded border border-slate-200 dark:border-slate-800">
          <EmptyState
            icon={<FolderOpen size={28} />}
            heading="No projects yet"
            subtext="Create your first project to start mapping threats."
            cta={<Button>Create project</Button>}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">SeverityStripeRow</h2>
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          <SeverityStripeRow severity="critical">
            <div className="flex-1 px-3 py-2 text-sm">Unauthenticated admin endpoint</div>
            <StatusPill variant="severity" value="critical" />
          </SeverityStripeRow>
          <SeverityStripeRow severity="high">
            <div className="flex-1 px-3 py-2 text-sm">Password stored in plaintext</div>
            <StatusPill variant="severity" value="high" />
          </SeverityStripeRow>
          <SeverityStripeRow severity="medium">
            <div className="flex-1 px-3 py-2 text-sm">Rate limiter missing on login</div>
            <StatusPill variant="severity" value="medium" />
          </SeverityStripeRow>
          <SeverityStripeRow severity="low">
            <div className="flex-1 px-3 py-2 text-sm">Weak referrer policy header</div>
            <StatusPill variant="severity" value="low" />
          </SeverityStripeRow>
          <SeverityStripeRow severity="info">
            <div className="flex-1 px-3 py-2 text-sm">Informational note</div>
            <StatusPill variant="severity" value="info" />
          </SeverityStripeRow>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">useDensity</h2>
        <DensityDemo />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">DropdownMenu</h2>
        <DropdownMenu
          trigger={<button className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700">Open menu</button>}
          items={[
            { value: 'one', label: 'Option one' },
            { value: 'two', label: 'Option two' },
            { value: 'three', label: 'Option three' },
          ]}
          onSelect={(v) => console.log('selected', v)}
        />
        <div className="mt-3 flex items-center gap-4">
          <Button variant="primary">Save</Button>
          <Button variant="primary">Publish</Button>
          <DropdownMenu
            trigger={
              <button
                type="button"
                aria-label="More actions"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <MoreHorizontal size={16} />
              </button>
            }
            items={[
              { value: 'copy', label: 'Copy', icon: <Copy size={13} /> },
              { value: 'diff', label: 'Compare versions', icon: <GitCompareArrows size={13} /> },
              { value: 'clear', label: 'Clear canvas', icon: <Trash2 size={13} />, variant: 'destructive' },
            ]}
            onSelect={(v) => console.log('overflow', v)}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">ClickToEditPill</h2>
        <ClickToEditPillDemo />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">PostureBar</h2>
        <PostureBar
          segments={[
            { icon: <AlertCircle size={14} />, label: 'Critical', value: 3, delta: +1, deltaDirection: 'bad' },
            { icon: <AlertTriangle size={14} />, label: 'High', value: 12, delta: -2, deltaDirection: 'good' },
            { icon: <Activity size={14} />, label: 'Open threats', value: 47 },
            { icon: <TrendingUp size={14} />, label: 'Last 7d', value: 8, delta: +4, deltaDirection: 'bad' },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">SearchGridPalette</h2>
        <SearchGridPaletteDemo />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Inspect popover</h2>
        <InspectPopoverDemo />
      </section>
    </div>
  );
}

function InspectPopoverDemo() {
  const [kind, setKind] = useState<'none' | 'ai' | 'threat' | 'posture' | 'attack' | 'layers'>('none');
  return (
    <div className="flex items-center gap-4">
      <DropdownMenu
        trigger={
          <button
            type="button"
            aria-label="Inspect panel"
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
              kind !== 'none'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <PanelRight size={14} />
            <span>Inspect</span>
            <ChevronDown size={11} />
          </button>
        }
        items={[
          { value: 'ai', label: 'AI Assistant', icon: <Sparkles size={13} className="text-blue-500" />, onSelect: () => setKind('ai') },
          { value: 'threat', label: 'Threat Model', icon: <ShieldAlert size={13} className="text-red-500" />, onSelect: () => setKind('threat') },
          { value: 'posture', label: 'Posture Score', icon: <Gauge size={13} className="text-blue-500" />, onSelect: () => setKind('posture') },
          { value: 'attack', label: 'Attack Mind', icon: <Sword size={13} className="text-red-500" />, onSelect: () => setKind('attack') },
          { value: 'layers', label: 'Layers tree', icon: <Layers size={13} className="text-slate-400" />, onSelect: () => setKind('layers') },
        ]}
      />
      <span className="text-xs text-slate-500 dark:text-slate-400">active: {kind}</span>
    </div>
  );
}

function DensityDemo() {
  const { density, setDensity } = useDensity();
  const rowClass = densityClasses[density].row;
  const textClass = densityClasses[density].text;
  return (
    <div>
      <div className="mb-2 flex gap-2">
        {(['comfortable', 'cozy', 'compact'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDensity(d)}
            className={`rounded border px-2 py-1 text-xs ${
              density === d
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-300'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <ul className={`divide-y divide-slate-200 rounded border border-slate-200 dark:divide-slate-800 dark:border-slate-800`}>
        <li className={`${rowClass} ${textClass} px-3`}>Row A</li>
        <li className={`${rowClass} ${textClass} px-3`}>Row B</li>
        <li className={`${rowClass} ${textClass} px-3`}>Row C</li>
      </ul>
    </div>
  );
}
