import { useEffect, useRef } from "react";
import { t } from "@/i18n";
import { Button } from "./Button";
import { Icon } from "./Icon";

type ErrorStateProps = {
  title?: string;
  body?: string;
  onRetry: () => void;
  headingLevel?: "h1" | "h2" | "h3";
};

export function ErrorState({
  title,
  body,
  onRetry,
  headingLevel: Heading = "h3",
}: ErrorStateProps) {
  const retryRef = useRef<HTMLButtonElement>(null);
  // Pack section 6: focus moves to Retry when the region first fails.
  useEffect(() => retryRef.current?.focus(), []);
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-lg border border-line bg-danger-bg px-4 py-10 text-center"
    >
      <Icon name="alertCircle" className="size-8 text-danger" />
      <Heading className="text-base font-semibold text-danger">
        {title ?? t("state.error.title")}
      </Heading>
      <p className="max-w-md text-sm text-fg">{body ?? t("state.error.body")}</p>
      <Button ref={retryRef} variant="secondary" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
