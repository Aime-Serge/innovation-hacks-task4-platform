"use client";

import { useAuth } from "@/providers/AuthProvider";
import { t } from "@/i18n";
import { Avatar } from "@/ui/Avatar";
import { DropdownMenu } from "@/ui/DropdownMenu";

export function UserMenu() {
  const { user, logout } = useAuth();
  if (user === null) return null;
  return (
    <DropdownMenu
      items={[{ value: "logout", label: t("auth.logout") }]}
      onSelect={() => void logout()}
      trigger={
        <button
          type="button"
          aria-label={t("layout.userMenu", { name: user.name })}
          className="touch-target flex items-center gap-2 rounded-md p-1 hover:bg-subtle"
        >
          <Avatar name={user.name} size="sm" />
          <span className="hidden max-w-40 truncate text-sm sm:inline">{user.name}</span>
        </button>
      }
    />
  );
}
