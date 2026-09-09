"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProfileMenu } from "./ProfileMenu";

export function NavBar() {
  const pathname = usePathname();
  const isDashboard = pathname === "/";

  return (
    <header className="sticky top-0 z-20 border-b border-border-hairline bg-canvas/95 backdrop-blur">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-interactive focus:px-3 focus:py-2 focus:text-canvas"
      >
        Skip to content
      </a>
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <div className="flex h-full items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight text-text-primary"
          >
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full bg-status-done"
            />
            devdash
          </Link>
          <Link
            href="/"
            aria-current={isDashboard ? "page" : undefined}
            className={`flex h-full items-center border-b-2 text-sm font-medium transition-colors ${
              isDashboard
                ? "border-interactive text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Dashboard
          </Link>
        </div>
        <ProfileMenu />
      </nav>
    </header>
  );
}
