"use client";

import { useState } from "react";
import { createTask, generateTasks, type GenerateTasksResult, type GeneratedTask } from "@/lib/data";
import type { Priority } from "@/lib/types";
import { Skeleton } from "@/components/shared/Skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { NoticeBanner } from "@/components/shared/NoticeBanner";

interface DraftTask extends GeneratedTask {
  included: boolean;
}

const PRIORITY_CYCLE: Priority[] = ["low", "medium", "high"];

export function GenerateTasksPanel({
  projectId,
  onTasksAdded,
}: {
  projectId: string;
  onTasksAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [result, setResult] = useState<GenerateTasksResult | null>(null);
  const [drafts, setDrafts] = useState<DraftTask[]>([]);
  const [adding, setAdding] = useState(false);

  async function handleGenerate() {
    setOpen(true);
    setStatus("loading");
    try {
      const res = await generateTasks(projectId);
      setResult(res);
      setDrafts(res.tasks.map((t) => ({ ...t, included: true })));
      setStatus("ready");
    } catch {
      // A hard failure to reach the backend at all — distinct from the
      // API's own "fallback" source, which is a normal 200 response.
      setStatus("error");
    }
  }

  function updateDraft(index: number, patch: Partial<DraftTask>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function cyclePriority(index: number) {
    const current = drafts[index].priority;
    const next = PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(current) + 1) % PRIORITY_CYCLE.length];
    updateDraft(index, { priority: next });
  }

  function discard() {
    setOpen(false);
    setStatus("idle");
    setResult(null);
    setDrafts([]);
  }

  async function addSelected() {
    const selected = drafts.filter((d) => d.included);
    if (selected.length === 0) return;
    setAdding(true);
    try {
      await Promise.all(
        selected.map((d) =>
          createTask({
            title: d.title,
            description: d.description,
            projectId,
            priority: d.priority,
          }),
        ),
      );
      onTasksAdded();
      discard();
    } finally {
      setAdding(false);
    }
  }

  const selectedCount = drafts.filter((d) => d.included).length;

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleGenerate}
        className="rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-text-primary hover:border-interactive"
      >
        ✦ Generate tasks with AI
      </button>
    );
  }

  return (
    <div className="rounded border border-border-hairline bg-surface p-4">
      {status === "loading" && (
        <div aria-busy="true" aria-label="Generating task suggestions">
          <p className="text-sm text-text-secondary">Thinking through your project…</p>
          <div className="mt-3 flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      )}

      {status === "error" && (
        <ErrorState
          message="Couldn't reach the server to generate tasks."
          onRetry={handleGenerate}
        />
      )}

      {status === "ready" && result && (
        <>
          {result.source === "fallback" && (
            <NoticeBanner message="AI suggestions aren't available right now — here's a quick-start checklist instead." />
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {drafts.map((draft, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded border border-border-hairline p-2"
              >
                <input
                  type="checkbox"
                  checked={draft.included}
                  onChange={(e) => updateDraft(i, { included: e.target.checked })}
                  className="mt-1"
                  aria-label={`Include "${draft.title}"`}
                />
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor={`draft-title-${i}`}>
                    Title
                  </label>
                  <input
                    id={`draft-title-${i}`}
                    value={draft.title}
                    onChange={(e) => updateDraft(i, { title: e.target.value })}
                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-text-primary hover:border-border-hairline focus-visible:border-interactive"
                  />
                  <p className="mt-0.5 px-1 text-xs text-text-secondary">{draft.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => cyclePriority(i)}
                  aria-label={`Priority: ${draft.priority}. Click to change.`}
                  className="shrink-0 rounded-full border border-border-hairline px-2 py-0.5 text-xs font-medium capitalize text-text-secondary hover:text-text-primary"
                >
                  {draft.priority}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={adding}
              className="rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-text-primary hover:border-interactive disabled:opacity-60"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={addSelected}
              disabled={adding || selectedCount === 0}
              className="rounded bg-interactive px-3 py-1.5 text-sm font-medium text-canvas disabled:opacity-60"
            >
              {adding ? "Adding…" : `Add ${selectedCount} task${selectedCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
