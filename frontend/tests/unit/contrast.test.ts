import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// NFR-07: computes WCAG contrast ratios straight from the token file, so a
// palette edit that breaks contrast fails here.
const css = readFileSync("src/styles/tokens.css", "utf8");

function tokens(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [
      m[1] ?? "",
      m[2] ?? "",
    ]),
  );
}

const light = tokens(css.slice(0, css.indexOf('[data-theme="dark"]')));
const dark = new Map([...light, ...tokens(css.slice(css.indexOf('[data-theme="dark"]')))]);

function luminance(hex: string): number {
  const channel = (i: number) => {
    const value = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

export function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

// [foreground, background]: text needs 4.5, UI components 3.
const TEXT: [string, string][] = [
  ["fg", "canvas"],
  ["fg", "surface"],
  ["fg", "subtle"],
  ["muted", "surface"],
  ["muted", "canvas"],
  ["muted", "subtle"],
  ["accent-fg", "surface"],
  ["accent-fg", "accent-subtle"],
  ["on-accent", "accent"],
  ["on-accent", "accent-hover"], // the hover state must meet contrast too, not only the resting one
  ["surface", "danger-hover"],
  ["success", "success-bg"],
  ["warning", "warning-bg"],
  ["danger", "danger-bg"],
  ["info", "info-bg"],
  ["surface", "danger"],
  ["canvas", "fg"],
];
const UI: [string, string][] = [
  ["line-strong", "surface"],
  ["line-strong", "canvas"],
  ["accent", "surface"],
  ["focus", "surface"],
  ["focus", "canvas"],
  ["accent", "track"],
  ["success", "surface"],
  ["danger", "surface"],
];

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("TC-007 contrast in the %s theme (NFR-07)", (_name, theme) => {
  const get = (token: string) => theme.get(token) ?? "#000000";
  it.each(TEXT)("TC-007 text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(get(fg), get(bg))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(UI)("TC-007 component %s on %s is at least 3:1", (fg, bg) => {
    expect(ratio(get(fg), get(bg))).toBeGreaterThanOrEqual(3);
  });
});

describe("TC-008 reduced motion (NFR-08)", () => {
  it("TC-008 the global stylesheet removes animation under prefers-reduced-motion", () => {
    const globals = readFileSync("src/styles/globals.css", "utf8");
    const block = globals.slice(globals.indexOf("prefers-reduced-motion"));
    expect(block).toMatch(/animation/);
    expect(block).toMatch(/transition/);
  });
});
