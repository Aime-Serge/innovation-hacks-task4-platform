import { cn } from "@/lib/cn";

/** A placeholder block. Give it the same size classes as the final content. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton rounded-md", className)} />;
}
