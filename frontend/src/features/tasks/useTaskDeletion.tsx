"use client";

import { useCallback, useState } from "react";
import { t } from "@/i18n";
import { useAuth } from "@/providers/AuthProvider";
import type { Project, Task } from "@/schemas";
import { useToast } from "@/ui/Toast";
import { useDeleteTask } from "../data/hooks";
import { ConfirmDialog } from "../shared/ConfirmDialog";

/** BR-203: only a project's owner or a lead may delete its tasks. */
export function useTaskDeletion(projects: readonly Project[]) {
  const { user } = useAuth();
  const toast = useToast();
  const [pending, setPending] = useState<Task | null>(null);
  const { mutate } = useDeleteTask(() => toast.notify("error", t("task.deleteFailed")));

  const canDelete = useCallback(
    (task: Task) =>
      user !== null &&
      (user.role === "lead" || projects.find((p) => p.id === task.projectId)?.ownerId === user.id),
    [user, projects],
  );
  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
      title={t("task.delete.title")}
      body={t("task.delete.body", { title: pending?.title ?? "" })}
      confirmLabel={t("task.delete")}
      busy={false}
      onConfirm={() => {
        if (pending === null) return;
        mutate(pending.id, { onSuccess: () => toast.notify("success", t("task.deleted")) });
        setPending(null);
      }}
    />
  );
  return { canDelete, requestDelete: setPending, dialog };
}
