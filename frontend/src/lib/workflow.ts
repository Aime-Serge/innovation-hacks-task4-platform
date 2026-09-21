import type { TaskStatus } from "@/schemas";

// The task workflow, exactly as the API enforces it (BR-204, backend domain/rules.py). The control
// offers only these next statuses, so the person never picks a move the API would refuse (FR-417).
const NEXT: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ["in_progress"],
  in_progress: ["in_review"],
  in_review: ["in_progress", "done"],
  done: ["in_progress"],
};

export function allowedNext(status: TaskStatus): readonly TaskStatus[] {
  return NEXT[status];
}

/** The current status first, then the moves the workflow allows. */
export function statusChoices(status: TaskStatus): TaskStatus[] {
  return [status, ...NEXT[status]];
}
