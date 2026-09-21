import { createMockServices } from "@/adapters/mock";
import type { Scenario } from "@/schemas";
import type { Services } from "@/services/types";

// Stand-in for the ServicesProvider module: components under test call
// useServices() and get a real (fast) mock adapter, never fixtures directly.
const NOW = new Date("2030-01-10T12:00:00Z");
let current: Services = create("default");

function create(scenario: Scenario): Services {
  return createMockServices({ scenario, latency: { min: 0, max: 0 }, now: NOW }).services;
}

export function installScenario(scenario: Scenario): Services {
  current = create(scenario);
  return current;
}

export const useServices = (): Services => current;
export const NOW_FOR_TESTS = NOW;
