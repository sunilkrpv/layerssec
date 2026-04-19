'use client';

import { useEffect, useRef } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useOnboarding } from '@/lib/onboardingStore';

interface AiSetupTourProps {
  /** Called when the tour reaches the AI Settings step — parent should open the settings view. */
  onOpenSettings: () => void;
}

export default function AiSetupTour({ onOpenSettings }: AiSetupTourProps) {
  const { state, update } = useOnboarding();
  const instanceRef = useRef<Driver | null>(null);

  const shouldRun =
    !!state &&
    !!state.welcomeModalSeenAt &&
    !state.aiConfigured &&
    !state.aiTourCompletedAt;

  useEffect(() => {
    if (!shouldRun) return;
    if (instanceRef.current) return;

    const complete = () => {
      void update({ aiTourCompletedAt: new Date().toISOString() });
    };

    const d = driver({
      showProgress: true,
      allowClose: true,
      smoothScroll: true,
      overlayOpacity: 0.55,
      popoverClass: 'layers-driver',
      onDestroyed: complete,
      steps: [
        {
          element: '[data-onboarding="ai-settings-nav"]',
          popover: {
            title: 'Connect a provider to unlock AI',
            description:
              'Layers uses Anthropic, OpenAI, Replicate, or local Ollama for diagram generation, STRIDE analysis, posture scoring, and attack simulations. Your key is encrypted at rest (AES-256-GCM). Click here to open AI Settings.',
            side: 'right',
            align: 'start',
          },
          onHighlightStarted: (el) => {
            el?.addEventListener(
              'click',
              () => {
                onOpenSettings();
                setTimeout(() => d.moveNext(), 200);
              },
              { once: true },
            );
          },
        },
        {
          element: '[data-onboarding="ai-provider-tiles"]',
          popover: {
            title: 'Pick a provider',
            description:
              'Anthropic Claude for best quality, OpenAI / Replicate for alternatives, or Ollama to keep everything local and air-gapped. All four unlock every AI feature.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '[data-onboarding="ai-save-button"]',
          popover: {
            title: 'Save and you\'re live',
            description:
              'Save your key here. The nudge banner disappears and Diagram Generation, STRIDE, and Attack Simulation become available immediately.',
            side: 'top',
            align: 'end',
          },
        },
      ],
    });

    instanceRef.current = d;

    // Give the DOM a tick to settle before highlighting.
    const t = setTimeout(() => d.drive(), 150);

    return () => {
      clearTimeout(t);
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRun]);

  return null;
}
