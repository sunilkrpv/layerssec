'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  { label: 'Mapping node relationships', detail: 'Reading connections between components…' },
  { label: 'Computing optimal positions', detail: 'Running spatial layout analysis…' },
  { label: 'Resolving overlaps', detail: 'Ensuring no nodes collide…' },
  { label: 'Calibrating spacing', detail: 'Applying visual balance rules…' },
  { label: 'Finalising layout', detail: 'Positioning nodes for clarity…' },
];

/** Orbital dot — a single dot that spins around a circle of given radius at a given speed. */
function OrbitalDot({
  radius,
  size,
  color,
  duration,
  initialAngle = 0,
  reverse = false,
}: {
  radius: number;
  size: number;
  color: string;
  duration: number;
  initialAngle?: number;
  reverse?: boolean;
}) {
  const [angle, setAngle] = useState(initialAngle);

  useEffect(() => {
    const start = performance.now();
    let id: number;
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const turns = (elapsed / duration) % 1;
      const deg = reverse ? initialAngle - turns * 360 : initialAngle + turns * 360;
      setAngle(deg);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [duration, initialAngle, reverse]);

  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;

  return (
    <div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 ${size * 2}px ${color}`,
        left: `calc(50% + ${x}px - ${size / 2}px)`,
        top: `calc(50% + ${y}px - ${size / 2}px)`,
        transition: 'none',
      }}
    />
  );
}

/** Fading node tile — mimics a diagram node getting repositioned. */
function FloatingNode({
  label,
  style,
}: {
  label: string;
  style: React.CSSProperties;
}) {
  return (
    <div
      className="absolute rounded-lg border border-violet-400/20 bg-slate-800/70 px-2 py-1 text-[9px] font-medium text-violet-300/50 backdrop-blur-sm"
      style={style}
    >
      {label}
    </div>
  );
}

export default function DeclutterOverlay() {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Cycle through steps with a fade-out → update → fade-in cadence
  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setStepIndex((i) => (i + 1) % STEPS.length);
        setVisible(true);
      }, 350);
    }, 2200);
    return () => clearInterval(cycle);
  }, []);

  const step = STEPS[stepIndex];

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-slate-950/75 backdrop-blur-md">

      {/* ── Background floating nodes (decorative) ─────────────────── */}
      <FloatingNode label="API Gateway" style={{ top: '18%', left: '14%', opacity: 0.5, animationDelay: '0s' }} />
      <FloatingNode label="Auth Service" style={{ top: '30%', right: '16%', opacity: 0.4 }} />
      <FloatingNode label="PostgreSQL" style={{ bottom: '28%', left: '18%', opacity: 0.35 }} />
      <FloatingNode label="Redis Cache" style={{ bottom: '20%', right: '14%', opacity: 0.45 }} />
      <FloatingNode label="Load Balancer" style={{ top: '12%', left: '38%', opacity: 0.3 }} />
      <FloatingNode label="CDN" style={{ bottom: '32%', right: '30%', opacity: 0.4 }} />

      {/* ── Animated dashed connector lines ────────────────────────── */}
      <svg className="absolute inset-0 h-full w-full opacity-10" aria-hidden>
        <line x1="20%" y1="25%" x2="45%" y2="45%" stroke="#a78bfa" strokeWidth="1" strokeDasharray="4 4">
          <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1s" repeatCount="indefinite" />
        </line>
        <line x1="80%" y1="32%" x2="55%" y2="45%" stroke="#818cf8" strokeWidth="1" strokeDasharray="4 4">
          <animate attributeName="stroke-dashoffset" from="0" to="16" dur="1.4s" repeatCount="indefinite" />
        </line>
        <line x1="22%" y1="70%" x2="50%" y2="55%" stroke="#a78bfa" strokeWidth="1" strokeDasharray="4 4">
          <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1.8s" repeatCount="indefinite" />
        </line>
        <line x1="78%" y1="68%" x2="50%" y2="55%" stroke="#818cf8" strokeWidth="1" strokeDasharray="4 4">
          <animate attributeName="stroke-dashoffset" from="0" to="16" dur="1.2s" repeatCount="indefinite" />
        </line>
      </svg>

      {/* ── Central orbital animation ───────────────────────────────── */}
      <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
        {/* Orbit rings (decorative) */}
        <div className="absolute h-32 w-32 rounded-full border border-violet-500/15" />
        <div className="absolute h-20 w-20 rounded-full border border-indigo-400/15" />

        {/* Orbiting dots */}
        <OrbitalDot radius={56} size={6} color="#a78bfa" duration={3.2} initialAngle={0} />
        <OrbitalDot radius={56} size={4} color="#818cf8" duration={3.2} initialAngle={120} />
        <OrbitalDot radius={56} size={5} color="#c4b5fd" duration={3.2} initialAngle={240} />

        <OrbitalDot radius={36} size={5} color="#6366f1" duration={2.1} initialAngle={60} reverse />
        <OrbitalDot radius={36} size={3} color="#8b5cf6" duration={2.1} initialAngle={200} reverse />

        {/* Core glow */}
        <div className="absolute h-14 w-14 animate-pulse rounded-full bg-violet-600/20 blur-md" />

        {/* Centre icon */}
        <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/40 ring-2 ring-violet-400/30">
          {/* Wand / sparkle icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4V2" />
            <path d="M15 16v-2" />
            <path d="M8 9h2" />
            <path d="M20 9h2" />
            <path d="M17.8 11.8 19 13" />
            <path d="M15 9h.01" />
            <path d="M17.8 6.2 19 5" />
            <path d="m3 21 9-9" />
            <path d="M12.2 6.2 11 5" />
          </svg>
        </div>
      </div>

      {/* ── Step label ──────────────────────────────────────────────── */}
      <div
        className="mb-1 text-center text-sm font-semibold text-white transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {step.label}
      </div>
      <div
        className="mb-6 text-center text-xs text-slate-400 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {step.detail}
      </div>

      {/* ── Step progress pills ─────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-500"
            style={{
              width: i === stepIndex ? 20 : 6,
              height: 6,
              background:
                i < stepIndex
                  ? '#6366f1'
                  : i === stepIndex
                  ? 'linear-gradient(90deg, #8b5cf6, #6366f1)'
                  : 'rgba(148,163,184,0.2)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
