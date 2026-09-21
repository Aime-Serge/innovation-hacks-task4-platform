import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

const TONES = {
  neutral: "bg-subtle text-muted",
  accent: "bg-accent-subtle text-accent-fg",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
} as const;

export type BadgeTone = keyof typeof TONES;

type BadgeProps = { tone?: BadgeTone; icon?: IconName; children: ReactNode; className?: string };

/** Colour is never the only signal: a badge always carries text, usually an icon too. */
export function Badge({ tone = "neutral", icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {icon !== undefined && <Icon name={icon} className="size-3" />}
      {children}
    </span>
  );
}
