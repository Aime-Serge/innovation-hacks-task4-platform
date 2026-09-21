"use client";

import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Scenario } from "@/schemas";

const KEY = "devdash_scenario";
const listeners = new Set<() => void>();

const read = (): Scenario => {
  try {
    const parsed = Scenario.safeParse(window.sessionStorage.getItem(KEY));
    return parsed.success ? parsed.data : "default";
  } catch {
    return "default";
  }
};

export function storeScenario(scenario: Scenario): void {
  try {
    window.sessionStorage.setItem(KEY, scenario);
  } catch {
    // Storage blocked: the URL parameter still applies for this page.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * FR-22: `?scenario=` selects one of the nine fixture scenarios. The URL wins;
 * otherwise the last choice is remembered for the tab so links keep working.
 */
export function useScenario(): Scenario {
  const fromUrl = Scenario.safeParse(useSearchParams().get("scenario"));
  const stored = useSyncExternalStore(subscribe, read, () => "default" as const);
  return fromUrl.success ? fromUrl.data : stored;
}
