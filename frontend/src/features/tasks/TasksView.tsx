"use client";

import { array } from "zod/mini";
import { useCallback, useState } from "react";
import { PageHeader } from "@/layout/PageHeader";
import { t, tCount } from "@/i18n";
import { Priority, TaskStatus, type TaskSort } from "@/schemas";
import { Button } from "@/ui/Button";
import { FilterBar } from "@/ui/FilterBar";
import { Icon } from "@/ui/Icon";
import { SearchField } from "@/ui/SearchField";
import { SortMenu } from "@/ui/SortMenu";
import { useToast } from "@/ui/Toast";
import { useProjects, useTasks, useUpdateTaskStatus, useUsers } from "../data/hooks";
import { emptyProjectQuery } from "@/schemas";
import { TaskFormDialog } from "./TaskFormDialog";
import { TaskList } from "./TaskList";
import { useTaskQuery } from "./useTaskQuery";

const SORTS: readonly TaskSort[] = ["due_date", "priority", "title"];

/** FR-15..19: search, filter, sort, optimistic status change, all URL-synced. */
export function TasksView() {
  const { query, update, clear, filtered } = useTaskQuery();
  const [creating, setCreating] = useState(false);
  const toast = useToast();
  const tasks = useTasks(query);
  const projects = useProjects(emptyProjectQuery());
  const users = useUsers();
  const changeStatus = useUpdateTaskStatus(() => toast.notify("error", t("task.statusFailed")));
  const { mutate } = changeStatus;
  const changeStatusOf = useCallback(
    (id: string, status: TaskStatus) => mutate({ id, status }),
    [mutate],
  );
  const projectItems = projects.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t("tasks.title")}
        description={t("tasks.description")}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            {t("task.new")}
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-48 flex-1">
            <SearchField
              id="task-search"
              label={t("tasks.search")}
              value={query.q}
              onChange={(q) => update({ q })}
            />
          </div>
          <SortMenu
            options={SORTS.map((value) => ({ value, label: t(`taskSort.${value}`) }))}
            sort={query.sort}
            dir={query.dir}
            onSort={(value) => update({ sort: value as TaskSort })}
            onDir={(dir) => update({ dir })}
          />
        </div>
        <FilterBar
          active={filtered}
          onClear={clear}
          groups={[
            {
              id: "status",
              legend: t("filter.status"),
              options: TaskStatus.options.map((v) => ({ value: v, label: t(`taskStatus.${v}`) })),
              selected: query.status,
              onChange: (status) => update({ status: array(TaskStatus).parse(status) }),
            },
            {
              id: "priority",
              legend: t("filter.priority"),
              options: Priority.options.map((v) => ({ value: v, label: t(`priority.${v}`) })),
              selected: query.priority,
              onChange: (priority) => update({ priority: array(Priority).parse(priority) }),
            },
            {
              id: "project",
              legend: t("filter.project"),
              options: projectItems.map((p) => ({ value: p.id, label: p.name })),
              selected: query.projectId,
              onChange: (projectId) => update({ projectId }),
              pending: projects.isPending,
              scroll: true,
            },
          ]}
        />
      </div>
      <p role="status" aria-live="polite" className="mb-3 text-sm text-muted">
        {tasks.data === undefined ? "" : tCount("tasks.count", tasks.data.total)}
      </p>
      <TaskList
        status={tasks.isPending ? "loading" : tasks.isError ? "error" : "success"}
        tasks={tasks.data?.items}
        projects={projectItems}
        users={users.data ?? []}
        filtered={filtered}
        onRetry={() => void tasks.refetch()}
        onClear={clear}
        onCreate={() => setCreating(true)}
        onStatusChange={changeStatusOf}
      />
      <TaskFormDialog
        open={creating}
        onOpenChange={setCreating}
        task={null}
        projects={projectItems}
        users={users.data ?? []}
      />
    </>
  );
}
