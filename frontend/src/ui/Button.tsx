import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  primary: "bg-accent text-on-accent hover:opacity-90",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-subtle",
  ghost: "text-fg hover:bg-subtle",
  danger: "bg-danger text-surface hover:opacity-90",
} as const;

const SIZES = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm" } as const;

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export function Button({
  variant = "secondary",
  size = "md",
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "touch-target inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
}
