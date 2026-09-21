import Link from "next/link";
import { t, type MessageKey } from "@/i18n";
import { NAV_ITEMS } from "./nav";

const REPO = "https://github.com/Aime-Serge/innovation-hacks-task1-dashboard";
const DOCS = `${REPO}/blob/task/1-frontend`;

const RESOURCES: readonly { label: MessageKey; href: string }[] = [
  { label: "footer.docs.readme", href: `${DOCS}/README.md` },
  { label: "footer.docs.adr", href: `${DOCS}/docs/adr/README.md` },
  { label: "footer.docs.trace", href: `${DOCS}/docs/traceability.md` },
  { label: "footer.docs.security", href: `${DOCS}/SECURITY.md` },
];

const PROJECT: readonly { label: MessageKey; href: string }[] = [
  { label: "footer.repo", href: REPO },
  { label: "footer.issues", href: `${REPO}/issues` },
];

const LINK = "touch-target inline-flex items-center py-1 hover:text-fg hover:underline";

function ExternalList({ items }: { items: typeof RESOURCES }) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.href}>
          <a href={item.href} rel="noopener noreferrer" className={LINK}>
            {t(item.label)}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** A server component: the footer adds no client JavaScript (NFR-04). */
export function Footer() {
  return (
    <footer aria-label={t("footer.label")} className="border-t border-line bg-surface">
      <div className="brand-bar" />
      <div className="mx-auto grid w-full max-w-(--content-max) gap-8 px-4 py-8 text-sm text-muted sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold text-fg">{t("app.name")}</p>
          <p>{t("footer.tagline")}</p>
          <p>{t("footer.builtFor")}</p>
        </div>
        <nav aria-labelledby="footer-product">
          <h2 id="footer-product" className="mb-2 font-semibold text-fg">
            {t("footer.product")}
          </h2>
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={LINK}>
                  {t(item.label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-resources">
          <h2 id="footer-resources" className="mb-2 font-semibold text-fg">
            {t("footer.resources")}
          </h2>
          <ExternalList items={RESOURCES} />
        </nav>
        <nav aria-labelledby="footer-project">
          <h2 id="footer-project" className="mb-2 font-semibold text-fg">
            {t("footer.project")}
          </h2>
          <ExternalList items={PROJECT} />
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-(--content-max) flex-col gap-1 px-4 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <p>{t("footer.status")}</p>
          <p>{t("footer.fonts")}</p>
        </div>
      </div>
    </footer>
  );
}
