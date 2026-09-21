import { t } from "@/i18n";
import { Skeleton } from "@/ui/Skeleton";

/** Shown while a route segment streams in; matches the page header's height. */
export default function Loading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <Skeleton className="mb-6 h-16 max-w-sm" />
      <Skeleton className="h-48" />
    </div>
  );
}
