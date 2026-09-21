import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/AuthCard";
import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";
import { t } from "@/i18n";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return (
    <AuthCard title={t("auth.forgotTitle")}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
