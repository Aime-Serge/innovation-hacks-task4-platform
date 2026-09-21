type ProgressBarProps = { value: number; label: string };

/** SVG bar, value is a whole percent 0..100. */
export function ProgressBar({ value, label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="flex items-center gap-2">
      <svg
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 w-full overflow-hidden rounded-full"
        viewBox="0 0 100 2"
        preserveAspectRatio="none"
      >
        <rect width="100" height="2" className="fill-track" />
        <rect width={pct} height="2" className="fill-accent" />
      </svg>
      <span className="w-10 text-right text-xs tabular-nums text-muted">{pct}%</span>
    </div>
  );
}
