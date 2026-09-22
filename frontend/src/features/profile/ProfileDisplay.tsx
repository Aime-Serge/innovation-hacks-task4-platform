import Link from "next/link";
import { COUNTRIES, DISCIPLINES, SENIORITIES } from "@/generated/profile-lists";
import { t } from "@/i18n";
import type { Profile } from "@/schemas";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Card";

function label(list: { value: string; label: string }[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

function countryName(code: string): string | null {
  if (code === "ZZ") return null;
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

function localTime(timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
  } catch {
    return null;
  }
}

export type ProfileSubject = {
  id: string;
  name: string;
  profile: Profile | null;
};

/** MF-06, MF-07: the header block shared by the own and the member profile page. */
export function ProfileHeader({
  subject,
  editHref,
}: {
  subject: ProfileSubject;
  editHref?: string;
}) {
  const profile = subject.profile;
  const time = profile === null ? null : localTime(profile.timeZone);
  const place = [
    profile?.city ?? null,
    profile !== null ? countryName(profile.country) : null,
  ].filter((v): v is string => v !== null && v !== "");

  return (
    <Card className="mb-6 flex flex-wrap items-start gap-4">
      <Avatar name={subject.name} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-lg font-semibold">{subject.name}</p>
        {profile !== null && (
          <>
            <p className="text-sm text-muted">{profile.displayHeadline}</p>
            <p className="text-sm text-muted">
              {label(DISCIPLINES, profile.discipline)} · {label(SENIORITIES, profile.seniority)}
            </p>
            {(profile.jobTitle !== null || profile.companyName !== null) && (
              <p className="text-sm text-muted">
                {[profile.jobTitle, profile.companyName].filter(Boolean).join(" at ")}
              </p>
            )}
            {place.length > 0 && <p className="text-sm text-muted">{place.join(", ")}</p>}
            {time !== null && (
              <p className="text-sm text-muted">{t("profile.localTime", { time })}</p>
            )}
          </>
        )}
      </div>
      {editHref !== undefined && (
        <Link
          href={editHref}
          className="touch-target inline-flex items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-subtle"
        >
          {t("profile.header.editProfile")}
        </Link>
      )}
    </Card>
  );
}

/** About, skills and links (MF-10: plain text, `noopener nofollow` links). */
export function ProfileBody({ profile }: { profile: Profile }) {
  const links = [
    profile.links.github !== null
      ? { label: t("profile.links.github"), href: profile.links.github }
      : null,
    profile.links.linkedin !== null
      ? { label: t("profile.links.linkedin"), href: profile.links.linkedin }
      : null,
    profile.links.website !== null
      ? { label: t("profile.links.website"), href: profile.links.website }
      : null,
  ].filter((v): v is { label: string; href: string } => v !== null);

  return (
    <>
      <section aria-labelledby="about-heading" className="mb-6">
        <h2 id="about-heading" className="mb-3 text-lg font-semibold">
          {t("profile.about.heading")}
        </h2>
        <Card>
          <p className="whitespace-pre-wrap break-words text-sm">
            {profile.about === "" ? t("profile.about.empty") : profile.about}
          </p>
        </Card>
      </section>
      <section aria-labelledby="skills-heading" className="mb-6">
        <h2 id="skills-heading" className="mb-3 text-lg font-semibold">
          {t("profile.skills.heading")}
        </h2>
        {profile.skills.length === 0 ? (
          <p className="text-sm text-muted">{t("profile.skills.empty")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <li
                key={skill}
                className="rounded-full border border-line-strong bg-subtle px-3 py-1 text-sm"
              >
                {skill}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="links-heading" className="mb-6">
        <h2 id="links-heading" className="mb-3 text-lg font-semibold">
          {t("profile.links.heading")}
        </h2>
        {links.length === 0 ? (
          <p className="text-sm text-muted">{t("profile.links.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener nofollow"
                  className="text-accent-fg underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
