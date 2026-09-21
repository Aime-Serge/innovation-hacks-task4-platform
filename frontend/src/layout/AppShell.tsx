import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { SkipLink } from "./SkipLink";

/** Authenticated frame: skip link, sidebar, header, one <main> landmark, footer. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <SkipLink />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-(--content-max) flex-1 p-4 sm:p-6"
        >
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
