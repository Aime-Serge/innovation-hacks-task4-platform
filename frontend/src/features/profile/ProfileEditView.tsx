"use client";

import { PageHeader } from "@/layout/PageHeader";
import { t } from "@/i18n";
import { ErrorState } from "@/ui/ErrorState";
import { Skeleton } from "@/ui/Skeleton";
import { useMe } from "../data/hooks";
import { ProfileEditor } from "./ProfileEditor";

/** MF-08: full-page editor, also reused inline by the Settings Profile tab. */
export function ProfileEditView() {
  const me = useMe();
  return (
    <>
      <PageHeader title={t("editor.title")} description={t("editor.description")} />
      {me.isPending ? (
        <Skeleton className="h-96 max-w-2xl" />
      ) : me.isError ? (
        <ErrorState onRetry={() => void me.refetch()} headingLevel="h1" />
      ) : (
        <ProfileEditor me={me.data} />
      )}
    </>
  );
}
