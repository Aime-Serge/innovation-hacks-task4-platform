"use client";

import { useCallback, useEffect, useState } from "react";

export type AsyncStatus = "loading" | "error" | "success";

interface State<T> {
  status: AsyncStatus;
  data: T | null;
  error: string | null;
}

export interface AsyncState<T> extends State<T> {
  retry: () => void;
}

/**
 * Wraps an async fetcher in loading/error/success state and a retry
 * handle. Every data-bound component in the dashboard (ProjectGrid,
 * TaskList, StatsStrip, ProfileMenu) is built on this contract so the
 * loading/empty/error/success branches stay consistent app-wide.
 *
 * Note: only the initial mount and an explicit retry() show a loading
 * state — a `deps` change alone (e.g. navigating between two project
 * detail pages without unmounting) swaps directly from the old success
 * state to the new one once the fetch resolves, which avoids a loading
 * flash on fast client-side navigations. No current call site relies on
 * deps changing to re-show loading.
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<State<T>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((result) => {
        if (cancelled) return;
        setState({ status: "success", data: result, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          data: null,
          error: err instanceof Error ? err.message : "Something went wrong",
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, ...deps]);

  const retry = useCallback(() => {
    setState({ status: "loading", data: null, error: null });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
