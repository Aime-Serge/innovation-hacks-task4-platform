"use client";

import { useState } from "react";
import { PageHeader } from "@/layout/PageHeader";
import { t } from "@/i18n";
import { ErrorState } from "@/ui/ErrorState";
import { Skeleton } from "@/ui/Skeleton";
import { Tabs } from "@/ui/Tabs";
import { useMe } from "../data/hooks";
import { ProfileEditor } from "../profile/ProfileEditor";
import { AccountTab } from "./AccountTab";
import { PreferencesTab } from "./PreferencesTab";
import { PrivacyTab } from "./PrivacyTab";

type TabId = "profile" | "account" | "preferences" | "privacy";

/** MF-12: four tabs, reachable from the avatar menu; every tab has its own states. */
export function SettingsView() {
  const [active, setActive] = useState<TabId>("profile");
  const me = useMe();

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      {me.isPending ? (
        <Skeleton className="h-96 max-w-2xl" />
      ) : me.isError ? (
        <ErrorState onRetry={() => void me.refetch()} headingLevel="h1" />
      ) : (
        <Tabs
          label={t("settings.title")}
          active={active}
          onChange={(id) => setActive(id as TabId)}
          tabs={[
            {
              id: "profile",
              label: t("settings.tab.profile"),
              content: <ProfileEditor me={me.data} />,
            },
            {
              id: "account",
              label: t("settings.tab.account"),
              content: <AccountTab me={me.data} />,
            },
            {
              id: "preferences",
              label: t("settings.tab.preferences"),
              content: <PreferencesTab me={me.data} />,
            },
            {
              id: "privacy",
              label: t("settings.tab.privacy"),
              content: <PrivacyTab me={me.data} />,
            },
          ]}
        />
      )}
    </>
  );
}
