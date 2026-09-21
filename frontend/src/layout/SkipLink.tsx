import { t } from "@/i18n";

/** FR-20 / NFR-09: first focusable element, jumps past the navigation. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only rounded-md bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
    >
      {t("layout.skip")}
    </a>
  );
}
