"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";
import { ErrorState } from "@/ui/ErrorState";

/** Last-resort boundary (NFR-19): details go to the reporter, never the screen. */
export default function RootError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => reportError(error, "route"), [error]);
  return (
    <main id="main-content" className="mx-auto max-w-xl p-6">
      <ErrorState onRetry={reset} />
    </main>
  );
}
