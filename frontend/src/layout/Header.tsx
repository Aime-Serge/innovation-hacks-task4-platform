import { Suspense } from "react";
import { MobileNav } from "./MobileNav";
import { ScenarioSwitcher } from "./ScenarioSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-4 py-2">
      <MobileNav />
      <div className="flex-1" />
      <Suspense fallback={null}>
        <ScenarioSwitcher />
      </Suspense>
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
