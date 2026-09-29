"use client";

import type { Priority, TaskStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function FilterBar({
  value,
  onChange,
  priorityValue,
  onPriorityChange,
}: {
  value: TaskStatus | null;
  onChange: (value: TaskStatus | null) => void;
  priorityValue?: Priority | null;
  onPriorityChange?: (value: Priority | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Filter tasks by status" className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            value === null
              ? "border-interactive text-text-primary"
              : "border-border-hairline text-text-secondary hover:text-text-primary"
          }`}
        >
          All
        </button>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(value === opt.value ? null : opt.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              value === opt.value
                ? "border-interactive text-text-primary"
                : "border-border-hairline text-text-secondary hover:text-text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {onPriorityChange && (
        <div role="group" aria-label="Filter tasks by priority" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={priorityValue == null}
            onClick={() => onPriorityChange(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              priorityValue == null
                ? "border-interactive text-text-primary"
                : "border-border-hairline text-text-secondary hover:text-text-primary"
            }`}
          >
            Any priority
          </button>
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={priorityValue === opt.value}
              onClick={() => onPriorityChange(priorityValue === opt.value ? null : opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                priorityValue === opt.value
                  ? "border-interactive text-text-primary"
                  : "border-border-hairline text-text-secondary hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
