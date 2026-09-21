import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/AuthCard";
import { RegisterForm } from "@/features/auth/RegisterForm";
import { t } from "@/i18n";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return (
    <AuthCard title={t("auth.createAccount")}>
      <RegisterForm />
    </AuthCard>
  );
}
