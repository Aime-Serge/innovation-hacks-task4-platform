"use client";

import { useAuth } from "@/providers/AuthProvider";
import { t } from "@/i18n";
import { Avatar } from "@/ui/Avatar";
import { RichMenu } from "@/ui/RichMenu";

/** Avatar menu: who you are, your pages, log out (the account menu of the header). */
export function UserMenu() {
  const { user, logout } = useAuth();
  if (user === null) return null;
  return (
    <RichMenu
      onAction={() => void logout()}
      entries={[
        {
          kind: "header",
          content: (
            <span className="flex items-center gap-3">
              <Avatar name={user.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user.name}</span>
                {user.email !== null && (
                  <span className="block truncate text-xs font-normal text-muted">
                    {user.email}
                  </span>
                )}
              </span>
            </span>
          ),
        },
        { kind: "separator" },
        { kind: "link", href: "/profile", label: t("nav.profile"), icon: "user" },
        { kind: "link", href: "/projects", label: t("nav.projects"), icon: "folder" },
        { kind: "link", href: "/tasks", label: t("nav.tasks"), icon: "tasks" },
        { kind: "separator" },
        { kind: "action", value: "logout", label: t("auth.logout"), icon: "logout" },
      ]}
      trigger={
        <button
          type="button"
          aria-label={t("layout.userMenu", { name: user.name })}
          className="touch-target flex items-center rounded-full p-0.5 hover:bg-subtle"
        >
          <Avatar name={user.name} size="sm" />
        </button>
      }
    />
  );
}
