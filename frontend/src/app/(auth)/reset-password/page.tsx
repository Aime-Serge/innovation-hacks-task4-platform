import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/AuthCard";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";
import { t } from "@/i18n";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return (
    <AuthCard title={t("auth.resetPassword")}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
