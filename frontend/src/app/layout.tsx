import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { t } from "@/i18n";
import "@/styles/globals.css";
import { NonceBridge } from "@/providers/NonceBridge";
import { Providers } from "@/providers";
import { THEME_INIT_SCRIPT } from "@/providers/theme";

// Self-hosted (TH-09) and committed, so the build needs no network. Inter is
// licensed under the SIL OFL; the licence sits next to the file.
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "DevDash", template: "%s · DevDash" },
  description: "See where every project stands, at a glance.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading the request's nonce makes every route dynamic, which is what lets
  // Next apply the nonce to its own scripts (docs/adr/ADR-011-csp-and-theme-script.md).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" data-theme="dark" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Blocks first paint on purpose: sets data-theme so there is no flash (FR-24). */}
        <script nonce={nonce}>{THEME_INIT_SCRIPT}</script>
      </head>
      <body>
        <NonceBridge nonce={nonce} />
        <Suspense fallback={<p className="sr-only">{t("common.loading")}</p>}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}
