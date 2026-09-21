import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "touch-target w-full rounded-md border bg-surface px-3 text-sm text-fg " +
  "placeholder:text-muted disabled:opacity-60";

type InputProps = ComponentPropsWithRef<"input"> & { invalid?: boolean };

export function Input({ invalid = false, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, "h-10", invalid ? "border-danger" : "border-line-strong", className)}
      {...rest}
    />
  );
}

type SelectProps = ComponentPropsWithRef<"select"> & { invalid?: boolean };

/** A native select keeps mobile pickers and keyboard behaviour for free. */
export function Select({ invalid = false, className, ...rest }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, "h-10", invalid ? "border-danger" : "border-line-strong", className)}
      {...rest}
    />
  );
}

type TextareaProps = ComponentPropsWithRef<"textarea"> & { invalid?: boolean };

export function Textarea({ invalid = false, className, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        "min-h-20 py-2",
        invalid ? "border-danger" : "border-line-strong",
        className,
      )}
      {...rest}
    />
  );
}
