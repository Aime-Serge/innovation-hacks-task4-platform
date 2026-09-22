import type { Scenario } from "@/schemas";
import { ServiceError } from "@/services/types";

export type Resource = "projects" | "tasks" | "users" | "activity" | "me";
export type Latency = { min: number; max: number };

export const DEFAULT_LATENCY: Latency = { min: 150, max: 400 };
const LOADING_LATENCY_MS = 3000;

const SERVER_ERROR = () =>
  new ServiceError("internal_error", "Something went wrong on our side. Please try again.", 500);

/**
 * Latency and failure injection for one mock session. Scenarios exist so every
 * state (loading, empty, error, partial error, flaky) is reachable on demand.
 */
export class Behavior {
  private readonly seen = new Set<string>();

  constructor(
    private readonly scenario: Scenario,
    private readonly latency: Latency = DEFAULT_LATENCY,
  ) {}

  private delayMs(): number {
    if (this.scenario === "loading") return LOADING_LATENCY_MS;
    const { min, max } = this.latency;
    return min + Math.random() * (max - min);
  }

  /** Resolves after the simulated delay; rejects if the request is aborted. */
  async wait(signal?: AbortSignal): Promise<void> {
    const ms = this.delayMs();
    if (ms <= 0) {
      signal?.throwIfAborted();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException("Aborted", "AbortError"),
        );
      });
    });
  }

  /** Throws when the scenario says this list request must fail. */
  checkList(resource: Resource): void {
    if (this.scenario === "error") throw SERVER_ERROR();
    if (this.scenario === "partial-error" && resource === "tasks") throw SERVER_ERROR();
    if (this.scenario === "flaky" && !this.seen.has(resource)) {
      this.seen.add(resource);
      throw SERVER_ERROR();
    }
  }

  /** Throws when the scenario says a status change must fail. */
  checkStatusChange(): void {
    if (this.scenario === "update-fails") throw SERVER_ERROR();
  }
}
