import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/navigation";

describe("safeInternalPath", () => {
  it("TC-030 allows normal same-origin paths, including query strings", () => {
    expect(safeInternalPath("/projects/abc")).toBe("/projects/abc");
    expect(safeInternalPath("/settings?tab=profile")).toBe("/settings?tab=profile");
  });

  it("TC-030 falls back to the dashboard for missing values and for the welcome page", () => {
    expect(safeInternalPath(null)).toBe("/dashboard");
    expect(safeInternalPath(undefined)).toBe("/dashboard");
    expect(safeInternalPath("")).toBe("/dashboard");
    expect(safeInternalPath("/")).toBe("/dashboard");
  });

  it("TC-030 rejects absolute and protocol-relative URLs (open redirect)", () => {
    expect(safeInternalPath("https://evil.example")).toBe("/dashboard");
    expect(safeInternalPath("//evil.example")).toBe("/dashboard");
    expect(safeInternalPath("/\\evil.example")).toBe("/dashboard");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/dashboard");
  });
});
