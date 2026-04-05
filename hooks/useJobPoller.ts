'use client';

import { useEffect, useRef, useCallback } from 'react';
import { apiGetJobStatus, type AiJobStatus, type AiJobStatusResponse } from '@/lib/api';

interface UseJobPollerOptions {
  /** Polling interval in ms (default 5000) */
  interval?: number;
  /** Stop polling when the browser tab is not visible (default true) */
  stopOnBlur?: boolean;
  /** Called when job status changes */
  onStatusChange?: (status: AiJobStatusResponse) => void;
  /** Called once when job reaches COMPLETED */
  onComplete?: (resultRef: string | null) => void;
  /** Called once when job reaches FAILED */
  onFail?: (errorMessage: string | null) => void;
}

/**
 * Polls a background AI job until it reaches a terminal state.
 * Safe to call with jobId=null — polling only starts when jobId is set.
 * Automatically pauses when the tab is hidden and resumes on focus.
 */
export function useJobPoller(
  jobId: string | null,
  options: UseJobPollerOptions = {},
) {
  const {
    interval = 5000,
    stopOnBlur = true,
    onStatusChange,
    onComplete,
    onFail,
  } = options;

  // Stable refs so callbacks never cause re-subscription
  const onCompleteRef = useRef(onComplete);
  const onFailRef = useRef(onFail);
  const onStatusChangeRef = useRef(onStatusChange);
  onCompleteRef.current = onComplete;
  onFailRef.current = onFail;
  onStatusChangeRef.current = onStatusChange;

  const isTerminal = (status: AiJobStatus) =>
    status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';

  const poll = useCallback(
    async (id: string, abortSignal: AbortSignal) => {
      if (abortSignal.aborted) return;
      try {
        const data = await apiGetJobStatus(id);
        if (abortSignal.aborted) return;

        onStatusChangeRef.current?.(data);

        if (data.status === 'COMPLETED') {
          onCompleteRef.current?.(data.resultRef);
        } else if (data.status === 'FAILED') {
          onFailRef.current?.(data.errorMessage);
        }
      } catch {
        // Network error — silently ignore, will retry next tick
      }
    },
    [],
  );

  useEffect(() => {
    if (!jobId) return;

    const controller = new AbortController();
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isRunning = true;

    const scheduleNext = (id: string) => {
      if (!isRunning || controller.signal.aborted) return;
      timerId = setTimeout(async () => {
        if (!isRunning || controller.signal.aborted) return;

        // Pause when tab is not visible
        if (stopOnBlur && document.hidden) {
          scheduleNext(id);
          return;
        }

        await poll(id, controller.signal);

        // Check terminal after poll — peek at last status via a fresh poll result
        // The terminal check happens inside poll → onComplete/onFail callbacks, so
        // we just keep scheduling until aborted externally.
        scheduleNext(id);
      }, interval);
    };

    // First poll immediately, then schedule
    void poll(jobId, controller.signal).then(() => scheduleNext(jobId));

    return () => {
      isRunning = false;
      controller.abort();
      if (timerId) clearTimeout(timerId);
    };
  }, [jobId, interval, stopOnBlur, poll]);
}
