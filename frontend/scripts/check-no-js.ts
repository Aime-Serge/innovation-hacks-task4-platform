// TH-01: the only JavaScript allowed is a toolchain config that cannot be TypeScript.
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const ALLOWLIST = new Set<string>();
const SKIP = new Set([
  "node_modules",
  ".next",
  ".git",
  "coverage",
  "playwright-report",
  "test-results",
]);
const JS = /\.(js|jsx|mjs|cjs)$/;

function walk(dir: string, found: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else if (JS.test(entry) && !ALLOWLIST.has(path.relative(".", full))) found.push(full);
  }
}

const offenders: string[] = [];
walk(".", offenders);
if (offenders.length > 0) {
  console.error("JavaScript files outside the allowlist:\n" + offenders.join("\n"));
  process.exit(1);
}
console.log(`check:no-js OK (allowlist: ${[...ALLOWLIST].join(", ")})`);
