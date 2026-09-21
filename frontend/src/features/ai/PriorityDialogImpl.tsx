"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { t } from "@/i18n";
import { useServices } from "@/providers/ServicesProvider";
import { emptyTaskQuery, type Priority } from "@/schemas";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Spinner } from "@/ui/Spinner";
import { useTasks } from "../data/hooks";
import { PriorityBadge } from "../shared/badges";
import { AiLabel, PrivacyNotice } from "./AiNotices";
import { usePrivacyAck } from "./useAi";
import { useAiRun } from "./useAiRun";

export type Props = { open: boolean; onOpenChange: (open: boolean) => void; projectId: string };

/** FR-424, FR-425: current and suggested priority with the reason; accepting is a normal update. */
export default function PriorityDialogImpl({ open, onOpenChange, projectId }: Props) {
  const { ai, tasks } = useServices();
  const client = useQueryClient();
  const [acked, ack] = usePrivacyAck();
  const list = useTasks({ ...emptyTaskQuery(), projectId: [projectId] });
  const start = useCallback(
    (signal: AbortSignal) => ai.prioritize(projectId, signal),
    [ai, projectId],
  );
  const { run, retry } = useAiRun(start, acked);
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState(false);

  const current = new Map((list.data?.items ?? []).map((task) => [task.id, task]));
  const rows = (run.data?.items ?? []).flatMap((item) => {
    const task = current.get(item.taskId);
    return task === undefined ? [] : [{ item, task }];
  });

  const accept = async (id: string, priority: Priority) => {
    try {
      await tasks.update(id, { priority });
      setAccepted((all) => new Set(all).add(id));
      void client.invalidateQueries({ queryKey: ["tasks"] });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };
  const pending = rows.filter(
    ({ item, task }) => item.suggestedPriority !== task.priority && !accepted.has(task.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("ai.prio.title")}>
      {!acked ? (
        <PrivacyNotice onAccept={ack} />
      ) : (
        <div className="flex flex-col gap-3" aria-busy={run.phase === "loading"}>
          <p role="status" aria-live="polite" className="text-sm">
            {run.phase === "loading" ? t("ai.prio.loading") : run.message}
            {failed ? t("ai.prio.failed") : ""}
          </p>
          {run.phase === "loading" && <Spinner />}
          {run.phase === "error" && <Button onClick={retry}>{t("common.retry")}</Button>}
          {run.phase === "done" && rows.length === 0 && <p>{t("ai.prio.empty")}</p>}
          {run.phase === "done" && rows.length > 0 && (
            <>
              <AiLabel />
              <ol className="flex flex-col gap-3">
                {rows.map(({ item, task }) => (
                  <li
                    key={task.id}
                    className="flex flex-col gap-1 rounded-md border border-line p-3"
                  >
                    <span className="font-medium">{task.title}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <span>{t("ai.prio.now")}</span>
                      <PriorityBadge priority={task.priority} />
                      <span>{t("ai.prio.suggested")}</span>
                      <PriorityBadge priority={item.suggestedPriority} />
                    </span>
                    <span className="text-sm text-muted">{item.reason}</span>
                    {accepted.has(task.id) ? (
                      <span className="text-sm">{t("ai.prio.accepted")}</span>
                    ) : item.suggestedPriority === task.priority ? (
                      <span className="text-sm text-muted">{t("ai.prio.same")}</span>
                    ) : (
                      <Button
                        size="sm"
                        className="self-start"
                        onClick={() => void accept(task.id, item.suggestedPriority)}
                      >
                        {t("ai.prio.accept")}
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
              {pending.length > 0 && (
                <Button
                  variant="primary"
                  className="self-start"
                  onClick={() =>
                    pending.forEach(
                      ({ item, task }) => void accept(task.id, item.suggestedPriority),
                    )
                  }
                >
                  {t("ai.prio.acceptAll")}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
