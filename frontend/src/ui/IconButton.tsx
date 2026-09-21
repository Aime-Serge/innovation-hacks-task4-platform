import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";

type IconButtonProps = Omit<ComponentPropsWithRef<"button">, "aria-label"> & {
  /** Required: an icon alone has no accessible name. */
  label: string;
};

export function IconButton({ label, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "touch-target inline-flex size-10 items-center justify-center rounded-md text-fg",
        "transition-colors duration-150 hover:bg-subtle disabled:opacity-60",
        className,
      )}
      {...rest}
    />
  );
}
