"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import { Icon } from "@/ui/Icon";
import { isActive, NAV_ITEMS } from "./nav";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
              {...(active ? { "aria-current": "page" as const } : {})}
              className={cn(
                "touch-target flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                active ? "bg-accent-subtle text-accent-fg" : "text-fg hover:bg-subtle",
              )}
            >
              <Icon name={item.icon} />
              {t(item.label)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
