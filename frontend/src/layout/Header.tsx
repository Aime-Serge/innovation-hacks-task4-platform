import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { t } from "@/i18n";
import { CreateMenu } from "./CreateMenu";
import { MobileSearchLink } from "./HeaderLinks";
import { HeaderSearch } from "./HeaderSearch";
import { MobileNav } from "./MobileNav";
import { ScenarioSwitcher } from "./ScenarioSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

/**
 * Full-width top bar. Left: menu, logo, name. Right: search, create, theme, account.
 * Page navigation lives only in the sidebar (drawer on small screens).
 */
export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) w-full items-center gap-2 border-b border-line bg-surface px-4">
      <MobileNav />
      <Link
        href="/dashboard"
        className="touch-target flex items-center gap-2 rounded-md pr-1 font-semibold"
      >
        <Image
          src="/logo.png"
          alt=""
          aria-hidden="true"
          width={32}
          height={32}
          className="size-8 rounded-full bg-white"
        />
        <span className="sr-only sm:not-sr-only">{t("app.name")}</span>
      </Link>
      <div className="flex-1" />
      <Suspense fallback={null}>
        <ScenarioSwitcher />
      </Suspense>
      <HeaderSearch />
      <CreateMenu />
      <MobileSearchLink />
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
