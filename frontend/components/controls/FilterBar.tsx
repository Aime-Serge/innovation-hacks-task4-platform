"use client";

import type { TaskStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

export function FilterBar({
  value,
  onChange,
}: {
  value: TaskStatus | null;
  onChange: (value: TaskStatus | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter tasks by status"
      className="flex flex-wrap gap-2"
    >
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
  );
}
