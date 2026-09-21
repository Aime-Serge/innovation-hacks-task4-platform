"use client";

import { useEffect, useState } from "react";
import { aiErrorMessage, isAbort } from "./messages";

type Settled<T> = { attempt: number; data: T | null; message: string };
type Run<T> =
  | { phase: "idle" | "loading"; data: null; message: string }
  | { phase: "done"; data: T; message: string }
  | { phase: "error"; data: null; message: string };

/** Runs one AI call while `active`, and aborts it when the dialog closes (cancel, FR-423). */
export function useAiRun<T>(start: (signal: AbortSignal) => Promise<T>, active: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    start(controller.signal).then(
      (data) => setSettled({ attempt, data, message: "" }),
      (error: unknown) => {
        if (!isAbort(error)) setSettled({ attempt, data: null, message: aiErrorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [active, start, attempt]);
  // Loading is derived: there is no result yet for the current attempt.
  const run: Run<T> = !active
    ? { phase: "idle", data: null, message: "" }
    : settled?.attempt !== attempt
      ? { phase: "loading", data: null, message: "" }
      : settled.data !== null
        ? { phase: "done", data: settled.data, message: "" }
        : { phase: "error", data: null, message: settled.message };
  return { run, retry: () => setAttempt((n) => n + 1) };
}
