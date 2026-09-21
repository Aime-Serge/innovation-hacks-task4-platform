"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createMockServices } from "@/adapters/mock";
import type { Services } from "@/services/types";
import { useAuth } from "./AuthProvider";
import { useScenario } from "./scenario";

const ServicesContext = createContext<Services | null>(null);

/** The only place an adapter is imported (enforced by ESLint). */
export function ServicesProvider({ children }: { children: ReactNode }) {
  const scenario = useScenario();
  // The actor is read lazily: rebuilding the mock when the session resolves
  // would reset its state (and the "flaky" scenario's first-request failure).
  const { getUserId } = useAuth();
  const { services } = useMemo(
    () => createMockServices({ scenario, getActorId: getUserId }),
    [scenario, getUserId],
  );
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (services === null) throw new Error("useServices must be used inside ServicesProvider");
  return services;
}
