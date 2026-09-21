import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type HeadingLevel = "h1" | "h2" | "h3";

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
  headingLevel?: HeadingLevel;
};

export function EmptyState({
  icon = "inbox",
  title,
  body,
  action,
  headingLevel: Heading = "h3",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-10 text-center">
      <Icon name={icon} className="size-8 text-muted" />
      <Heading className="text-base font-semibold">{title}</Heading>
      {body !== undefined && <p className="max-w-md text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}
