"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/ui/Toast";
import { AuthProvider } from "./AuthProvider";
import { useScenario } from "./scenario";
import { ServicesProvider } from "./ServicesProvider";
import { ThemeProvider } from "./ThemeProvider";

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false } },
  });
}

/** A new scenario gets a fresh cache so nothing leaks across fixtures. */
function QueryScope({ children }: { children: ReactNode }) {
  const scenario = useScenario();
  const [clients] = useState(() => new Map<string, QueryClient>());
  let client = clients.get(scenario);
  if (client === undefined) {
    client = makeClient();
    clients.set(scenario, client);
  }
  // The key remounts the tree: useQuery binds to the client it first saw, so a
  // new scenario needs new observers, not just a new client.
  return (
    <QueryClientProvider key={scenario} client={client}>
      {children}
    </QueryClientProvider>
  );
}

/** Theme and session: everything, including the sign-in pages, needs these. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}

/** Data layer: only the signed-in app needs the query cache, services and toasts. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryScope>
      <ServicesProvider>
        <ToastProvider>{children}</ToastProvider>
      </ServicesProvider>
    </QueryScope>
  );
}
