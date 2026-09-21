"use client";

import { useState } from "react";
import { t } from "@/i18n";
import type { Project, Task, TaskStatus, User } from "@/schemas";
import { Button } from "@/ui/Button";
import { Skeleton } from "@/ui/Skeleton";
import { Grid } from "@/layout/Grid";
import { RegionState, type RegionStatus } from "@/ui/RegionState";
import { byId } from "../shared/lookups";
import { TaskCard } from "./TaskCard";

const PAGE = 24;

export function TaskListSkeleton() {
  return (
    <Grid layout="cards">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-48" />
      ))}
    </Grid>
  );
}

type Props = {
  status: RegionStatus;
  tasks: readonly Task[] | undefined;
  projects: readonly Project[];
  users: readonly User[];
  filtered: boolean;
  onRetry: () => void;
  onClear: () => void;
  onCreate: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  /** When given, each task the person may delete shows a delete action. */
  onDelete?: (task: Task) => void;
  canDelete?: (task: Task) => boolean;
  headingLevel?: "h2" | "h3";
};

/** FR-12 / FR-18 / NFR-03: capped rendering keeps 500-task scenarios responsive. */
export function TaskList(props: Props) {
  const [shown, setShown] = useState(PAGE);
  const projects = byId(props.projects);
  const users = byId(props.users);
  return (
    <RegionState
      status={props.status}
      data={props.tasks}
      filtered={props.filtered}
      skeleton={<TaskListSkeleton />}
      empty={{
        title: t("task.empty.title"),
        body: t("task.empty.body"),
        action: (
          <Button variant="primary" onClick={props.onCreate}>
            {t("task.empty.action")}
          </Button>
        ),
      }}
      onRetry={props.onRetry}
      onClearFilters={props.onClear}
      headingLevel={props.headingLevel ?? "h2"}
    >
      {(items) => (
        <>
          <Grid layout="cards">
            {items.slice(0, shown).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                projectName={projects.get(task.projectId)?.name}
                assigneeName={
                  task.assigneeId === null ? undefined : users.get(task.assigneeId)?.name
                }
                onStatusChange={props.onStatusChange}
                {...(props.onDelete !== undefined && props.canDelete?.(task) === true
                  ? { onDelete: props.onDelete }
                  : {})}
                {...(props.headingLevel === undefined ? {} : { headingLevel: props.headingLevel })}
              />
            ))}
          </Grid>
          {items.length > shown && (
            <div className="mt-4 flex justify-center">
              <Button onClick={() => setShown(shown + PAGE)}>
                {t("common.showMore", {
                  shown: Math.min(shown, items.length),
                  total: items.length,
                })}
              </Button>
            </div>
          )}
        </>
      )}
    </RegionState>
  );
}
