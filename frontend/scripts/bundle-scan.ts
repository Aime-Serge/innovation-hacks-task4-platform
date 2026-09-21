// TC-462: scan the built browser bundle. Run after `npm run build` (without the mock data source).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { findBundleLeaks } from "./lib/bundle";

const ROOT = ".next/static";
const files: string[] = [];
const walk = (dir: string): void => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(?:js|css|map)$/.test(entry)) files.push(full);
  }
};
try {
  walk(ROOT);
} catch {
  console.error(`No build found in ${ROOT}. Run npm run build first.`);
  process.exit(2);
}
const apiBase = process.env["API_BASE_URL"];
const findings = files.flatMap((file) =>
  findBundleLeaks(readFileSync(file, "utf8"), apiBase).map((leak) => `${file}: ${leak}`),
);
if (findings.length > 0) {
  console.error("Bundle scan failed:\n" + findings.join("\n"));
  process.exit(1);
}
console.log(`bundle-scan OK (${files.length} browser files, no secrets or server-only names)`);
