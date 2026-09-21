import Link from "next/link";
import { t } from "@/i18n";
import { Icon } from "@/ui/Icon";

/** On phones the search field is replaced by this icon, which opens the task list. */
export function MobileSearchLink() {
  return (
    <Link
      href="/tasks"
      aria-label={t("layout.search")}
      title={t("layout.search")}
      className="touch-target inline-flex size-10 items-center justify-center rounded-md hover:bg-subtle md:hidden"
    >
      <Icon name="search" />
    </Link>
  );
}
