import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const COLUMNS = {
  /** Card lists: 1 / 2 / 3 / 4 columns at mobile / tablet / desktop / wide. */
  cards: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 wide:grid-cols-4",
  /** KPI tiles: 2 by 2 on mobile, one row from tablet up. */
  kpis: "grid-cols-2 md:grid-cols-4",
  /** Dashboard body: single column, 2 on tablet, 12-column grid on desktop. */
  dashboard: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-12",
} as const;

type GridProps = { layout: keyof typeof COLUMNS; className?: string; children: ReactNode };

export function Grid({ layout, className, children }: GridProps) {
  return <div className={cn("grid gap-4", COLUMNS[layout], className)}>{children}</div>;
}
