"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { PageHeader } from "@/layout/PageHeader";
import { t, tCount } from "@/i18n";
import { formatDate } from "@/lib/dates";
import { projectProgress } from "@/lib/query-logic";
import { emptyProjectQuery, emptyTaskQuery, type TaskStatus } from "@/schemas";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { ProgressRing } from "@/ui/ProgressRing";
import { Skeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";
import { useProject, useProjects, useTasks, useUpdateTaskStatus, useUsers } from "../data/hooks";
import { ProjectAiPanel } from "../ai/ProjectAiPanel";
import { ProjectStatusBadge } from "../shared/badges";
import { TaskFormDialog } from "../tasks/TaskFormDialog";
import { TaskList } from "../tasks/TaskList";
import { useTaskDeletion } from "../tasks/useTaskDeletion";
import { DeleteProjectButton } from "./DeleteProjectButton";
import { ProjectFormDialog } from "./ProjectFormDialog";

/** FR-14: /projects/[id] with progress ring, its tasks, and a not-found state. */
export function ProjectDetailView({ id }: { id: string }) {
  const project = useProject(id);
  const tasks = useTasks({ ...emptyTaskQuery(), projectId: [id] });
  const users = useUsers();
  const projects = useProjects(emptyProjectQuery());
  const { user } = useAuth();
  const toast = useToast();
  const changeStatus = useUpdateTaskStatus(() => toast.notify("error", t("task.statusFailed")));
  const { mutate } = changeStatus;
  const changeStatusOf = useCallback(
    (id: string, status: TaskStatus) => mutate({ id, status }),
    [mutate],
  );
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const deletion = useTaskDeletion(
    project.data === null || project.data === undefined ? [] : [project.data],
  );
  const progress = useMemo(() => projectProgress(id, tasks.data?.items ?? []), [id, tasks.data]);

  if (project.isPending) {
    return (
      <div aria-busy="true">
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (project.isError)
    return <ErrorState onRetry={() => void project.refetch()} headingLevel="h1" />;
  if (project.data === null) {
    return (
      <EmptyState
        icon="folder"
        headingLevel="h1"
        title={t("project.notFound.title")}
        body={t("project.notFound.body")}
        action={
          <Link href="/projects" className="text-accent-fg underline">
            {t("project.notFound.back")}
          </Link>
        }
      />
    );
  }

  const data = project.data;
  const canManage = user?.role === "lead" || data.ownerId === user?.id; // FR-412, BR-202
  return (
    <>
      <PageHeader
        title={data.name}
        description={data.description}
        actions={
          <div className="flex gap-2">
            {canManage && (
              <>
                <Button onClick={() => setEditing(true)}>{t("common.edit")}</Button>
                <DeleteProjectButton id={data.id} name={data.name} />
                <Button variant="primary" onClick={() => setAdding(true)}>
                  {t("task.new")}
                </Button>
              </>
            )}
          </div>
        }
      />
      <Card className="mb-6 flex flex-wrap items-center gap-6">
        <ProgressRing
          value={progress.percent}
          label={t("project.progressOf", { name: data.name })}
        />
        <div className="flex flex-col gap-2 text-sm">
          <ProjectStatusBadge status={data.status} />
          <p>
            {data.dueDate === null
              ? t("project.noDue")
              : t("project.due", { date: formatDate(data.dueDate) })}
          </p>
          <p className="text-muted">
            {tCount("project.tasksDone", progress.total, { done: progress.done })}
          </p>
        </div>
      </Card>
      <ProjectAiPanel
        projectId={id}
        canCreateTasks={user?.role === "lead" || data.ownerId === user?.id}
      />
      <h2 className="mb-3 text-lg font-semibold">{t("project.tasks")}</h2>
      <TaskList
        status={tasks.isPending ? "loading" : tasks.isError ? "error" : "success"}
        tasks={tasks.data?.items}
        projects={[data]}
        users={users.data ?? []}
        filtered={false}
        onRetry={() => void tasks.refetch()}
        onClear={() => undefined}
        onCreate={() => setAdding(true)}
        onStatusChange={changeStatusOf}
        onDelete={deletion.requestDelete}
        canDelete={deletion.canDelete}
        headingLevel="h3"
      />
      {deletion.dialog}
      <ProjectFormDialog
        open={editing}
        onOpenChange={setEditing}
        project={data}
        ownerId={user?.id ?? "user-1"}
      />
      <TaskFormDialog
        open={adding}
        onOpenChange={setAdding}
        task={null}
        projects={projects.data?.items ?? [data]}
        users={users.data ?? []}
        defaultProjectId={id}
      />
    </>
  );
}
