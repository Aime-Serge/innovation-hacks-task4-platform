// NFR-12 / TH-08: no raw colour, spacing or font values outside the token files.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const TOKEN_FILES = new Set([path.join("src", "styles", "tokens.css")]);
const RAW = [
  { name: "hex colour", re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "rgb/hsl colour", re: /\b(?:rgba?|hsla?)\(/ },
  { name: "arbitrary Tailwind value", re: /\b(?!data-|aria-)[a-z-]+-\[[^\]]+\]/ },
  { name: "inline style literal", re: /style=\{\{[^}]*(?:px|rem|#)/ },
];

const offenders: string[] = [];
function walk(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx?|css)$/.test(entry) && !TOKEN_FILES.has(full) && !/\.test\./.test(entry)) {
      readFileSync(full, "utf8")
        .split("\n")
        .forEach((line, index) => {
          for (const rule of RAW)
            if (rule.re.test(line))
              offenders.push(`${full}:${index + 1} ${rule.name}: ${line.trim()}`);
        });
    }
  }
}
walk("src");
if (offenders.length > 0) {
  console.error("Raw design values outside tokens:\n" + offenders.join("\n"));
  process.exit(1);
}
console.log("check-tokens OK");
