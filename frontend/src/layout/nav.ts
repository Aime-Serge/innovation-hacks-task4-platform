import type { IconName } from "@/ui/Icon";
import type { MessageKey } from "@/i18n";

export const NAV_ITEMS: readonly { href: string; label: MessageKey; icon: IconName }[] = [
  { href: "/dashboard", label: "nav.dashboard", icon: "dashboard" },
  { href: "/projects", label: "nav.projects", icon: "folder" },
  { href: "/tasks", label: "nav.tasks", icon: "tasks" },
  { href: "/profile", label: "nav.profile", icon: "user" },
];

export const isActive = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);
