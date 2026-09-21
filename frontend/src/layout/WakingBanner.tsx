"use client";

import { useEffect, useState } from "react";
import { t } from "@/i18n";
import { AWAKE_EVENT, WAKING_EVENT } from "@/lib/events";

/** NFR-403: after 5 s, or a gateway error on the first try, say the service is waking up. */
export function WakingBanner() {
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    const on = () => setWaking(true);
    const off = () => setWaking(false);
    window.addEventListener(WAKING_EVENT, on);
    window.addEventListener(AWAKE_EVENT, off);
    return () => {
      window.removeEventListener(WAKING_EVENT, on);
      window.removeEventListener(AWAKE_EVENT, off);
    };
  }, []);
  return (
    // aria-live without role="status": the page already has one status region for its own counts.
    <div aria-live="polite" data-testid="waking-region">
      {waking && (
        <p className="border-b border-line bg-subtle px-4 py-2 text-center text-sm">
          {t("waking.message")}
        </p>
      )}
    </div>
  );
}
