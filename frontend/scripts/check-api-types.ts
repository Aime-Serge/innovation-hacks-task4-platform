// FR-436, TC-452: the committed types must be exactly what openapi.json generates.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SPEC = "../backend/docs/openapi.json";
const COMMITTED = "src/generated/api-types.ts";
const dir = mkdtempSync(path.join(tmpdir(), "api-types-"));
const fresh = path.join(dir, "api-types.ts");
try {
  execFileSync("npx", ["openapi-typescript", SPEC, "-o", fresh], { stdio: "pipe" });
  if (readFileSync(fresh, "utf8") !== readFileSync(COMMITTED, "utf8")) {
    console.error(`${COMMITTED} is out of date. Run: npm run generate:api`);
    process.exit(1);
  }
  console.log("API types match openapi.json.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
