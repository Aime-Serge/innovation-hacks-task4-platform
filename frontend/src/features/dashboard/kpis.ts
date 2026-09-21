import { isOverdue } from "@/lib/dates";
import type { Project, Task } from "@/schemas";

export type Kpis = {
  activeProjects: number;
  openTasks: number;
  overdueTasks: number;
  completionRate: number;
};

/** FR-02: values derive from the data and BR-03 / BR-04, never hard-coded. */
export function computeKpis(
  projects: readonly Project[],
  tasks: readonly Task[],
  today: string,
): Kpis {
  const done = tasks.filter((task) => task.status === "done").length;
  return {
    activeProjects: projects.filter((project) => project.status === "active").length,
    openTasks: tasks.length - done,
    overdueTasks: tasks.filter((task) => isOverdue(task, today)).length,
    completionRate: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
  };
}

/** FR-03: open tasks due from today through the next 7 days, soonest first. */
export function upcomingDeadlines(tasks: readonly Task[], today: string, until: string): Task[] {
  return tasks
    .filter(
      (task) =>
        task.status !== "done" &&
        task.dueDate !== null &&
        task.dueDate >= today &&
        task.dueDate <= until,
    )
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}
