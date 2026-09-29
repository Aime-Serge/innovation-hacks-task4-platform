import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/AuthCard";
import { LoginForm } from "@/features/auth/LoginForm";
import { t } from "@/i18n";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return (
    <AuthCard title={t("auth.welcomeBack")} lead={t("auth.welcomeBackLead")}>
      <LoginForm />
    </AuthCard>
  );
}
