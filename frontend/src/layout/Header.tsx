import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/i18n";
import { Icon } from "@/ui/Icon";
import { CreateMenu } from "./CreateMenu";
import { HeaderLinks } from "./HeaderLinks";
import { HeaderSearch } from "./HeaderSearch";
import { MobileNav } from "./MobileNav";
import { ScenarioSwitcher } from "./ScenarioSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

/**
 * Left: menu, logo, name. Right: search, create, shortcuts, account.
 * Same arrangement as the GitHub header.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-4 py-2">
      <MobileNav />
      <Link href="/" className="touch-target flex items-center gap-2 rounded-md pr-1 font-semibold">
        <span
          aria-hidden="true"
          className="brand-bar inline-flex size-8 items-center justify-center rounded-full text-white"
        >
          <Icon name="dashboard" />
        </span>
        <span className="hidden sm:inline">{t("app.name")}</span>
      </Link>
      <div className="flex-1" />
      <Suspense fallback={null}>
        <ScenarioSwitcher />
      </Suspense>
      <HeaderSearch />
      <CreateMenu />
      <HeaderLinks />
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
