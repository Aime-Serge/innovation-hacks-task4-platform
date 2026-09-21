"use client";

import { lazy, Suspense, useState } from "react";
import { t } from "@/i18n";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { useAiStatus } from "./useAi";

// Each dialog loads the first time it is opened, so the AI screens add nothing to first load (NFR-04).
const TaskGenerationDialog = lazy(() => import("./TaskGenerationDialogImpl"));
const PriorityDialog = lazy(() => import("./PriorityDialogImpl"));
const SummaryDialog = lazy(() => import("./SummaryDialogImpl"));

type Which = "generate" | "prioritize" | "summarize" | null;

/** UC-410 to UC-413: the AI actions of one project. Absent entirely while AI is off (FR-421). */
export function ProjectAiPanel({
  projectId,
  canCreateTasks,
}: {
  projectId: string;
  canCreateTasks: boolean;
}) {
  const status = useAiStatus();
  const [open, setOpen] = useState<Which>(null);
  if (status.data?.enabled !== true) return null;
  const close = (isOpen: boolean) => {
    if (!isOpen) setOpen(null);
  };
  const dialog = { open: true, onOpenChange: close, projectId };
  return (
    <Card className="mb-6 flex flex-col gap-3" aria-labelledby="ai-panel-title">
      <h2 id="ai-panel-title" className="text-lg font-semibold">
        {t("ai.panel.title")}
      </h2>
      <p className="text-sm text-muted">{t("ai.panel.body")}</p>
      <p className="text-sm">
        {t("ai.remaining", {
          count: status.data.quota.remainingToday,
          limit: status.data.quota.dailyLimit,
        })}
      </p>
      <div className="flex flex-wrap gap-2">
        {canCreateTasks && (
          <Button variant="primary" onClick={() => setOpen("generate")}>
            {t("ai.generate")}
          </Button>
        )}
        <Button onClick={() => setOpen("prioritize")}>{t("ai.prioritize")}</Button>
        <Button onClick={() => setOpen("summarize")}>{t("ai.summarize")}</Button>
      </div>
      <Suspense fallback={null}>
        {open === "generate" && <TaskGenerationDialog {...dialog} />}
        {open === "prioritize" && <PriorityDialog {...dialog} />}
        {open === "summarize" && <SummaryDialog {...dialog} />}
      </Suspense>
    </Card>
  );
}
