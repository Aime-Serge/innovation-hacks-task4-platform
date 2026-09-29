import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@/i18n";
import { Card } from "@/ui/Card";

/** Frame for the four unauthenticated screens. */
export function AuthCard({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4"
    >
      <div className="brand-bar" />
      <p className="text-center text-lg font-semibold text-fg">{t("auth.welcomeGreeting")}</p>
      <p className="text-center text-sm text-muted">{t("footer.tagline")}</p>
      <Link
        href="/"
        aria-label={t("auth.home")}
        className="touch-target mx-auto flex items-center gap-2 rounded-md px-2 text-sm font-semibold text-muted hover:text-fg"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed logo mark, as in Header */}
        <img src="/logo.png" alt="" aria-hidden="true" className="size-6 rounded-full bg-white" />
        {t("app.name")}
      </Link>
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {lead !== undefined && <p className="text-sm text-muted">{lead}</p>}
        </div>
        {children}
      </Card>
    </main>
  );
}
