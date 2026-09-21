import Link from "next/link";
import { t } from "@/i18n";
import { Icon } from "@/ui/Icon";
import { NAV_ITEMS } from "./nav";

const SHORTCUTS = NAV_ITEMS.filter((item) => item.href !== "/profile");

/** Icon shortcuts in the header (dashboard, projects, tasks); the search icon replaces the field on phones. */
export function HeaderLinks() {
  return (
    <>
      <Link
        href="/tasks"
        aria-label={t("layout.search")}
        title={t("layout.search")}
        className="touch-target inline-flex size-10 items-center justify-center rounded-md hover:bg-subtle md:hidden"
      >
        <Icon name="search" />
      </Link>
      <ul className="hidden items-center gap-1 sm:flex">
        {SHORTCUTS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-label={t(item.label)}
              title={t(item.label)}
              className="touch-target inline-flex size-10 items-center justify-center rounded-md border border-line hover:bg-subtle"
            >
              <Icon name={item.icon} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
