import { t } from "@/i18n";
import { NavLinks } from "./NavLinks";

/** Persistent from the lg breakpoint up; below it the header opens a drawer. */
export function Sidebar() {
  return (
    <aside className="hidden w-(--sidebar-width) shrink-0 border-r border-line bg-surface lg:block">
      <div className="brand-bar" />
      <nav aria-label={t("layout.primaryNav")} className="sticky top-0 p-4">
        <NavLinks />
      </nav>
    </aside>
  );
}
