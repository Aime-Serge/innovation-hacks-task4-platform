"use client";

import { notFound } from "next/navigation";
import { PageHeader } from "@/layout/PageHeader";
import { t } from "@/i18n";
import { ErrorState } from "@/ui/ErrorState";
import { Skeleton } from "@/ui/Skeleton";
import { useMember } from "../data/hooks";
import { ProfileBody, ProfileHeader } from "./ProfileDisplay";

/** MF-07: another member's page. Never shows email, statistics or completeness (MB-02). */
export function MemberProfileView({ id }: { id: string }) {
  const member = useMember(id);

  if (member.isPending) {
    return (
      <>
        <PageHeader title={t("profile.title")} />
        <Skeleton className="mb-6 h-28" />
      </>
    );
  }
  if (member.isError) {
    return (
      <>
        <PageHeader title={t("profile.title")} />
        <ErrorState onRetry={() => void member.refetch()} headingLevel="h1" />
      </>
    );
  }
  if (member.data === null) notFound();

  const data = member.data;
  return (
    <>
      <PageHeader title={data.name} />
      <ProfileHeader subject={data} />
      {data.profile !== null && <ProfileBody profile={data.profile} />}
    </>
  );
}
