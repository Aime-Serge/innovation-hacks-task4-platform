"use client";

import { PageHeader } from "@/layout/PageHeader";
import { t } from "@/i18n";
import { ErrorState } from "@/ui/ErrorState";
import { Skeleton } from "@/ui/Skeleton";
import { useMe } from "../data/hooks";
import { ProfileBody, ProfileHeader } from "./ProfileDisplay";
import { ProfileCompleteness, ProfileStatistics } from "./ProfileMeta";

/** MF-06: the owner's own profile, with statistics and completeness (owner only). */
export function ProfileView() {
  const me = useMe();

  if (me.isPending) {
    return (
      <>
        <PageHeader title={t("profile.title")} description={t("profile.description")} />
        <Skeleton className="mb-6 h-28" />
        <Skeleton className="mb-6 h-40" />
      </>
    );
  }
  if (me.isError) {
    return (
      <>
        <PageHeader title={t("profile.title")} description={t("profile.description")} />
        <ErrorState onRetry={() => void me.refetch()} headingLevel="h1" />
      </>
    );
  }

  const data = me.data;
  return (
    <>
      <PageHeader title={t("profile.title")} description={t("profile.description")} />
      {data.legacyProfile && (
        <p role="status" className="mb-4 rounded-md border border-line bg-subtle px-3 py-2 text-sm">
          {t("profile.legacyPrompt")}
        </p>
      )}
      <ProfileHeader subject={data} editHref="/profile/edit" />
      {data.profile !== null && <ProfileBody profile={data.profile} />}
      <ProfileStatistics stats={data.stats} memberSince={data.createdAt} />
      <ProfileCompleteness completeness={data.completeness} />
    </>
  );
}
