import { isOverdue } from "@/lib/dates";
import type { Task } from "@/schemas";

export type ProfileStats = {
  assigned: number;
  done: number;
  overdue: number;
  completionRate: number;
};

/** FR-09: derived from the tasks assigned to this user only. */
export function profileStats(userId: string, tasks: readonly Task[], today: string): ProfileStats {
  const own = tasks.filter((task) => task.assigneeId === userId);
  const done = own.filter((task) => task.status === "done").length;
  return {
    assigned: own.length,
    done,
    overdue: own.filter((task) => isOverdue(task, today)).length,
    completionRate: own.length === 0 ? 0 : Math.round((done / own.length) * 100),
  };
}
