import type { TaskStatus } from "@/lib/types";

const STATUS_META: Record<
  TaskStatus,
  { label: string; colorVar: string; shape: "circle-filled" | "circle-half" | "circle-hollow" | "triangle" }
> = {
  done: { label: "Done", colorVar: "var(--color-status-done)", shape: "circle-filled" },
  "in-progress": { label: "In progress", colorVar: "var(--color-status-progress)", shape: "circle-half" },
  todo: { label: "Todo", colorVar: "var(--color-status-todo)", shape: "circle-hollow" },
  blocked: { label: "Blocked", colorVar: "var(--color-status-blocked)", shape: "triangle" },
};

function StatusIcon({ shape, color }: { shape: (typeof STATUS_META)[TaskStatus]["shape"]; color: string }) {
  if (shape === "triangle") {
    return (
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
        <path d="M6 1 L11 10.5 L1 10.5 Z" fill={color} />
      </svg>
    );
  }
  if (shape === "circle-filled") {
    return (
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
        <circle cx="6" cy="6" r="5" fill={color} />
      </svg>
    );
  }
  if (shape === "circle-half") {
    return (
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
        <circle cx="6" cy="6" r="5" fill="none" stroke={color} strokeWidth="1.5" />
        <path d="M6 1 A5 5 0 0 1 6 11 Z" fill={color} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
      <circle cx="6" cy="6" r="5" fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary">
      <StatusIcon shape={meta.shape} color={meta.colorVar} />
      {meta.label}
    </span>
  );
}
