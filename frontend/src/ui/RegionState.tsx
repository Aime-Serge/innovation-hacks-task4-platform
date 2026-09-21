import type { ReactNode } from "react";
import { t } from "@/i18n";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import type { IconName } from "./Icon";

export type RegionStatus = "loading" | "error" | "success";

type RegionStateProps<T> = {
  /** Query state: loading, error or success. */
  status: RegionStatus;
  data: readonly T[] | undefined;
  /** True when a search or filter is active, so an empty result is "no results". */
  filtered: boolean;
  skeleton: ReactNode;
  empty: { icon?: IconName; title: string; body?: string; action?: ReactNode };
  onRetry: () => void;
  onClearFilters?: () => void;
  /** h2 when the region sits directly under the page's h1, h3 inside a section. */
  headingLevel?: "h1" | "h2" | "h3";
  children: (items: readonly T[]) => ReactNode;
};

/**
 * NFR-05: every dynamic region renders exactly one of the five states:
 * loading, success, empty (no data exists), no-results (filters hide it) or
 * error with Retry.
 */
export function RegionState<T>(props: RegionStateProps<T>) {
  const {
    status,
    data,
    filtered,
    skeleton,
    empty,
    onRetry,
    onClearFilters,
    headingLevel,
    children,
  } = props;
  const level = headingLevel === undefined ? {} : { headingLevel };
  if (status === "loading") {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">{t("common.loading")}</span>
        {skeleton}
      </div>
    );
  }
  if (status === "error" || data === undefined) return <ErrorState onRetry={onRetry} {...level} />;
  if (data.length === 0) {
    if (filtered) {
      return (
        <EmptyState
          icon="search"
          {...level}
          title={t("state.noResults.title")}
          body={t("state.noResults.body")}
          action={
            onClearFilters !== undefined && (
              <Button onClick={onClearFilters}>{t("common.clearFilters")}</Button>
            )
          }
        />
      );
    }
    return <EmptyState {...empty} {...level} />;
  }
  return <>{children(data)}</>;
}
