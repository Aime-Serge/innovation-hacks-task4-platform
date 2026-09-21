import type { ElementType, HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardProps = { as?: ElementType } & HTMLAttributes<HTMLElement>;

export function Card({ as: Tag = "div", className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn("rounded-lg border border-line bg-surface p-4 shadow-sm", className)}
      {...rest}
    />
  );
}
