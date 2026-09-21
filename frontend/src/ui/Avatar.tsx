import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
} as const;

type AvatarProps = { name: string; size?: keyof typeof SIZES };

/** Decorative: the person's name is always shown in text next to it. */
export function Avatar({ name, size = "md" }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        "bg-accent-subtle font-semibold text-accent-fg",
        SIZES[size],
      )}
    >
      {initials(name)}
    </span>
  );
}
