import type { Metadata } from "next";
import { MemberProfileView } from "@/features/profile/MemberProfileView";

export const metadata: Metadata = { title: "Member profile" };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberProfileView id={id} />;
}
