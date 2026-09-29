import Link from "next/link";
import { t, type MessageKey } from "@/i18n";
import { Card } from "@/ui/Card";
import { Icon, type IconName } from "@/ui/Icon";

const FEATURES: readonly { icon: IconName; title: MessageKey; body: MessageKey }[] = [
  {
    icon: "folder",
    title: "welcome.feature.projects.title",
    body: "welcome.feature.projects.body",
  },
  { icon: "tasks", title: "welcome.feature.tasks.title", body: "welcome.feature.tasks.body" },
  { icon: "sparkles", title: "welcome.feature.ai.title", body: "welcome.feature.ai.body" },
];

const CTA = "touch-target inline-flex h-11 items-center justify-center rounded-md px-5 font-medium";

/** The public front door at "/", seen first by everyone; a signed-in visitor is offered the dashboard. */
export function WelcomePage({ signedIn = false }: { signedIn?: boolean }) {
  // Log in lives in the header only; the hero's one button invites a new visitor to sign up.
  const primary = signedIn
    ? { href: "/dashboard", label: t("welcome.openDashboard") }
    : { href: "/login", label: t("welcome.login") };
  const hero = signedIn ? primary : { href: "/register", label: t("welcome.register") };
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-(--content-max) items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <p className="flex items-center gap-2 font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed logo mark, as in Header */}
            <img
              src="/logo.png"
              alt=""
              aria-hidden="true"
              className="size-8 rounded-full bg-white"
            />
            {t("app.name")}
          </p>
          <Link
            href={primary.href}
            className="touch-target inline-flex h-9 items-center rounded-md border border-line-strong px-3 text-sm font-medium hover:bg-subtle"
          >
            {primary.label}
          </Link>
        </div>
      </header>

      <main id="main-content" className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
          <div className="brand-bar w-24" />
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("welcome.eyebrow")}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("welcome.title")}</h1>
          <p className="max-w-xl text-lg text-muted">{t("welcome.lead")}</p>
          <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Link
              href={hero.href}
              className={`${CTA} bg-accent text-on-accent hover:bg-accent-hover`}
            >
              {hero.label}
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="welcome-features"
          className="mx-auto w-full max-w-(--content-max) px-4 pb-16 sm:px-6"
        >
          <h2 id="welcome-features" className="sr-only">
            {t("welcome.features")}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <Card className="flex h-full flex-col gap-2 p-5">
                  <Icon name={feature.icon} className="size-6 text-accent-fg" />
                  <h3 className="font-semibold">{t(feature.title)}</h3>
                  <p className="text-sm text-muted">{t(feature.body)}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <p className="mx-auto w-full max-w-(--content-max) px-4 py-4 text-center text-xs text-muted sm:px-6">
          {t("welcome.footer")}
        </p>
      </footer>
    </div>
  );
}
