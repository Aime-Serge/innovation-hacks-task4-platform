import type { ReactNode } from "react";
import { t } from "@/i18n";
import { Card } from "@/ui/Card";

/** Frame for the four unauthenticated screens. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4"
    >
      <div className="brand-bar" />
      <p className="text-center text-sm text-muted">{t("footer.tagline")}</p>
      <p className="text-center text-sm font-semibold text-muted">{t("app.name")}</p>
      <Card className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children}
      </Card>
    </main>
  );
}
