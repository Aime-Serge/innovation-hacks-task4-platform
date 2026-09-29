import type { ProjectProgress } from "@/lib/types";

/**
 * Segmented completion indicator — reads like a git diff stat bar
 * rather than a circular donut, which scales better in a dense list
 * and reads faster at a glance (see UI/UX handoff, design direction).
 */
export function ProgressBar({ progress }: { progress: ProjectProgress }) {
  const segments = Math.max(progress.total, 1);
  const filled = progress.total === 0 ? 0 : progress.done;

  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Project completion"
        className="flex h-1.5 gap-0.5 overflow-hidden rounded-full"
      >
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`h-full flex-1 rounded-sm ${
              i < filled ? "bg-status-done" : "bg-border-hairline"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 font-mono text-xs text-text-secondary">
        {progress.done}/{progress.total} done
      </p>
    </div>
  );
}
