'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyableCodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  function handleCopy() {
    const text = preRef.current?.textContent ?? '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="group relative mb-3">
      <pre ref={preRef} className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed ring-1 ring-gray-700/60">
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-gray-700/80 px-2 py-1 text-[10px] text-gray-300 opacity-0 transition hover:bg-gray-600/80 group-hover:opacity-100"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export const mdComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-2 mt-3 text-base font-bold text-gray-900 dark:text-white">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-1.5 mt-3 text-sm font-bold text-gray-900 dark:text-white">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-gray-700 dark:text-indigo-100">{children}</h3>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic text-blue-600 dark:text-indigo-200">{children}</em>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5 text-sm">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5 text-sm">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  code: ({ children, className }: { children?: ReactNode; className?: string }) => {
    const isBlock = /language-/.test(className ?? '');
    return isBlock ? (
      <code className={`font-mono text-xs text-gray-100 ${className ?? ''}`}>{children}</code>
    ) : (
      <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:bg-indigo-800/60 dark:text-blue-200">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <CopyableCodeBlock>{children}</CopyableCodeBlock>
  ),
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      className="text-blue-600 underline decoration-blue-400/50 underline-offset-2 hover:text-blue-500 dark:text-blue-300 dark:decoration-blue-500/40 dark:hover:text-blue-200"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
};
