import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";
import { nav, resetNav } from "./tests/unit/next-mock";

// Coverage-instrumented jsdom on a busy runner can take longer than the 1 s default
// to settle async UI; the assertions themselves are unchanged.
configure({ asyncUtilTimeout: 5000 });

vi.mock("next/navigation", () => import("./tests/unit/next-mock"));

beforeEach(() => {
  // Node-environment files (the proxy tests) have no window.
  if (typeof window !== "undefined") {
    vi.spyOn(window.history, "replaceState").mockImplementation(nav.replaceState);
  }
});

afterEach(() => {
  if (typeof window !== "undefined") cleanup();
  resetNav();
});
