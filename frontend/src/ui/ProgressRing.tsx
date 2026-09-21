type ProgressRingProps = { value: number; label: string; size?: number };

const STROKE = 8;

/** SVG ring, value is a whole percent 0..100. */
export function ProgressRing({ value, label, size = 96 }: ProgressRingProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={STROKE}
          className="fill-none stroke-track"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          className="fill-none stroke-accent"
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums"
      >
        {pct}%
      </span>
    </div>
  );
}
