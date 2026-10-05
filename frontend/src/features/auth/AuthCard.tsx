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
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-4"
    >
      <div className="brand-bar" />
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-lg font-semibold text-fg">{t("auth.welcomeGreeting")}</p>
        <p className="text-sm text-muted">{t("footer.tagline")}</p>
      </div>
      <Link
        href="/"
        aria-label={t("auth.home")}
        className="touch-target mx-auto flex items-center rounded-md px-2 text-sm font-semibold text-muted hover:text-fg"
      >
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
