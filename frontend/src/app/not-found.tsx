import Link from "next/link";
import { t } from "@/i18n";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center"
    >
      <h1 className="text-2xl font-semibold">{t("notFound.title")}</h1>
      <p className="text-sm text-muted">{t("notFound.body")}</p>
      <Link href="/" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent">
        {t("notFound.back")}
      </Link>
    </main>
  );
}
