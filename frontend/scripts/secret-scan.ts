// TC-092: fails the gate when a tracked file looks like it contains a secret.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { findSecrets, findSensitivePublicVars } from "./lib/secrets";

const SKIP = /(?:^|\/)(?:package-lock\.json|.*\.(?:png|jpe?g|webp|ico|woff2?))$/;
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => file !== "" && !SKIP.test(file));

const findings: string[] = [];
for (const file of files) {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const name of findSecrets(text)) findings.push(`${file}: ${name}`);
  for (const name of findSensitivePublicVars(text))
    findings.push(`${file}: sensitive public variable ${name}`);
}

if (findings.length > 0) {
  console.error("Secret scan failed:\n" + findings.join("\n"));
  process.exit(1);
}
console.log(`secret-scan OK (${files.length} files, ${findings.length} findings)`);
