import type { ReactNode } from "react";

type ControlProps = {
  id: string;
  invalid: boolean;
  "aria-describedby": string | undefined;
};

type FormFieldProps = {
  id: string;
  label: string;
  error?: string | null | undefined;
  children: (control: ControlProps) => ReactNode;
};

/** Visible label plus an error message linked by aria-describedby. */
export function FormField({ id, label, error, children }: FormFieldProps) {
  const errorId = `${id}-error`;
  const hasError = typeof error === "string" && error !== "";
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children({ id, invalid: hasError, "aria-describedby": hasError ? errorId : undefined })}
      {hasError && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
