import type { ReactNode } from "react";

type PageHeaderProps = { title: string; description?: string; actions?: ReactNode };

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold">{title}</h1>
        {description !== undefined && <p className="mt-1 text-base text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
