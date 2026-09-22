"use client";

import { useState } from "react";
import Link from "next/link";
import { t } from "@/i18n";
import { consumeWelcomeFlag } from "@/lib/welcome";
import { IconButton } from "@/ui/IconButton";
import { Icon } from "@/ui/Icon";
import { useMe } from "../data/hooks";

/** MF-05: shown once, right after registration, with the completeness percent. */
export function WelcomeBanner() {
  // Lazy initializer: read the flag once, on the client, without an effect (NFR-style: no
  // cascading render). sessionStorage only, never localStorage: this is not a lasting setting.
  const [visible, setVisible] = useState(() => consumeWelcomeFlag());
  const me = useMe();

  if (!visible || me.data === undefined) return null;
  const firstName = me.data.givenName ?? me.data.name.split(" ")[0] ?? me.data.name;

  return (
    <div
      role="status"
      className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-line bg-accent-subtle px-4 py-3"
    >
      <p className="text-sm">
        {t("auth.welcomeBanner.title", { name: firstName, percent: me.data.completeness.percent })}{" "}
        <Link href="/profile/edit" className="text-accent-fg underline">
          {t("auth.welcomeBanner.action")}
        </Link>
      </p>
      <IconButton label={t("common.dismiss")} onClick={() => setVisible(false)}>
        <Icon name="x" />
      </IconButton>
    </div>
  );
}
