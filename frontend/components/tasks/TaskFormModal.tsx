"use client";

import { useState, type FormEvent } from "react";
import { createTask, updateTask } from "@/lib/data";
import type { Priority, Task, User } from "@/lib/types";
import { Modal } from "@/components/shared/Modal";
import { FormField } from "@/components/shared/FormField";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function TaskFormModal({
  projectId,
  task,
  users,
  onClose,
  onSaved,
}: {
  projectId: string;
  task?: Task;
  users: User[];
  onClose: () => void;
  onSaved: (task: Task) => void;
}) {
  const isEditing = Boolean(task);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const saved =
        isEditing && task
          ? await updateTask(task.id, {
              title,
              description: description || null,
              priority,
              dueDate: dueDate || null,
              clearDueDate: !dueDate,
              assigneeId: assigneeId || null,
              clearAssignee: !assigneeId,
            })
          : await createTask({
              title,
              description: description || null,
              projectId,
              priority,
              dueDate: dueDate || null,
              assigneeId: assigneeId || null,
            });
      onSaved(saved);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEditing ? "Edit task" : "New task"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="text-sm text-status-blocked">
            {error}
          </p>
        )}
        <FormField id="task-title" label="Title" value={title} onChange={setTitle} required />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="task-description" className="text-sm font-medium text-text-primary">
            Description
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded border border-border-hairline bg-surface px-3 py-2 text-sm text-text-primary focus-visible:border-interactive"
          />
        </div>
        <div>
          <span className="text-sm font-medium text-text-primary">Priority</span>
          <div role="radiogroup" aria-label="Priority" className="mt-1.5 flex gap-2">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={priority === opt.value}
                onClick={() => setPriority(opt.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  priority === opt.value
                    ? "border-interactive text-text-primary"
                    : "border-border-hairline text-text-secondary hover:text-text-primary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="task-due-date" className="text-sm font-medium text-text-primary">
            Due date
          </label>
          <input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded border border-border-hairline bg-surface px-3 py-2 text-sm text-text-primary focus-visible:border-interactive"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="task-assignee" className="text-sm font-medium text-text-primary">
            Assignee
          </label>
          <select
            id="task-assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="rounded border border-border-hairline bg-surface px-3 py-2 text-sm text-text-primary focus-visible:border-interactive"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded border border-border-hairline px-3 py-1.5 text-sm font-medium text-text-primary hover:border-interactive disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="rounded bg-interactive px-3 py-1.5 text-sm font-medium text-canvas disabled:opacity-60"
          >
            {submitting ? "Saving…" : isEditing ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
