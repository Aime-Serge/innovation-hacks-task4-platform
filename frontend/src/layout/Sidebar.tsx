import { t } from "@/i18n";
import { NavLinks } from "./NavLinks";

/** Persistent from the lg breakpoint up, starting under the header; below it the header opens a drawer. */
export function Sidebar() {
  return (
    <aside className="sticky top-(--header-height) hidden h-(--below-header-height) w-(--sidebar-width) shrink-0 overflow-y-auto border-r border-line bg-surface lg:block">
      <nav aria-label={t("layout.primaryNav")} className="p-4">
        <NavLinks />
      </nav>
    </aside>
  );
}
