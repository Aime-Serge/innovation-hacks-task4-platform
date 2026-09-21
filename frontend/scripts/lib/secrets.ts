// TH-04 / NFR-15: patterns for credentials that must never be committed.
export const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  {
    name: "hard-coded secret assignment",
    re: /\b(?:api[_-]?key|secret|password|token)\b\s*[:=]\s*["'][A-Za-z0-9/+_-]{20,}["']/i,
  },
];

export function findSecrets(text: string): string[] {
  return SECRET_PATTERNS.filter(({ re }) => re.test(text)).map(({ name }) => name);
}

/** Only NEXT_PUBLIC_ variables may reach the browser, and only non-sensitive ones. */
export function findSensitivePublicVars(text: string): string[] {
  return [
    ...text.matchAll(/^\s*(NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|KEY|TOKEN|PASSWORD)[A-Z0-9_]*)\s*=/gim),
  ].map((match) => match[1] ?? "");
}
