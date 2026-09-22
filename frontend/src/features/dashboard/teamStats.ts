import { isOverdue } from "@/lib/dates";
import type { Task, User } from "@/schemas";

export type TeamMemberStats = { user: User; openTasks: number; overdueTasks: number };

/** RF-07: per-member counts for the lead-only team panel, derived from the dashboard's
 * already-fetched, already role-scoped task and user lists (BR-401) — no new request. */
export function computeTeamStats(
  users: readonly User[],
  tasks: readonly Task[],
  today: string,
): TeamMemberStats[] {
  return users.map((user) => {
    const own = tasks.filter((task) => task.assigneeId === user.id);
    return {
      user,
      openTasks: own.filter((task) => task.status !== "done").length,
      overdueTasks: own.filter((task) => isOverdue(task, today)).length,
    };
  });
}
