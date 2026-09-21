import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/navigation";

describe("safeInternalPath", () => {
  it("TC-030 allows normal same-origin paths, including query strings", () => {
    expect(safeInternalPath("/projects/abc")).toBe("/projects/abc");
    expect(safeInternalPath("/settings?tab=profile")).toBe("/settings?tab=profile");
  });

  it("TC-030 falls back to / for missing values", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath(undefined)).toBe("/");
    expect(safeInternalPath("")).toBe("/");
  });

  it("TC-030 rejects absolute and protocol-relative URLs (open redirect)", () => {
    expect(safeInternalPath("https://evil.example")).toBe("/");
    expect(safeInternalPath("//evil.example")).toBe("/");
    expect(safeInternalPath("/\\evil.example")).toBe("/");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/");
  });
});
