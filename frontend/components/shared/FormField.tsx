"use client";

export function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  required,
  autoComplete,
  minLength,
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  placeholder?: string;
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`rounded border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:border-interactive ${
          error ? "border-status-blocked" : "border-border-hairline"
        }`}
      />
      {error && (
        <p id={errorId} className="text-xs text-status-blocked">
          {error}
        </p>
      )}
    </div>
  );
}
