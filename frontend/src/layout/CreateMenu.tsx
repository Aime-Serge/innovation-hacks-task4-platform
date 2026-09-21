"use client";

import { t } from "@/i18n";
import { Icon } from "@/ui/Icon";
import { RichMenu } from "@/ui/RichMenu";

/** The "+" menu: starts a new project or task (the list pages open their form on ?new=1). */
export function CreateMenu() {
  return (
    <RichMenu
      entries={[
        { kind: "link", href: "/projects?new=1", label: t("project.new"), icon: "folder" },
        { kind: "link", href: "/tasks?new=1", label: t("task.new"), icon: "tasks" },
      ]}
      trigger={
        <button
          type="button"
          aria-label={t("layout.create")}
          title={t("layout.create")}
          className="touch-target inline-flex h-10 items-center gap-1 rounded-md px-2 hover:bg-subtle"
        >
          <Icon name="plus" />
          <Icon name="chevronDown" className="size-3 text-muted" />
        </button>
      }
    />
  );
}
