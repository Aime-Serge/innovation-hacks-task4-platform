import type { Metadata } from "next";
import { ProfileEditView } from "@/features/profile/ProfileEditView";

export const metadata: Metadata = { title: "Edit profile" };

export default function ProfileEditPage() {
  return <ProfileEditView />;
}
