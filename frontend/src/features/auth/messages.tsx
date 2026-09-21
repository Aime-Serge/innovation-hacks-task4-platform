import type { ReactNode } from "react";

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger"
    >
      {children}
    </div>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-md border border-success bg-success-bg px-3 py-2 text-sm text-success"
    >
      {children}
    </div>
  );
}
