// NFR-411, TC-462: what must never appear in JavaScript the browser downloads.
import { findSecrets } from "./secrets";

const FORBIDDEN: { name: string; re: RegExp }[] = [
  {
    name: "a server-only setting name",
    re: /\b(?:LLM_API_KEY|JWT_SECRET|DATABASE_URL|MIGRATION_DATABASE_URL|SEED_PASSWORD)\b/,
  },
  { name: "a database role", re: /\bih_(?:migrator|app|readonly|admin)\b/ },
  { name: "a connection string", re: /postgres(?:ql)?(?:\+\w+)?:\/\//i },
  { name: "the API's server-layer settings", re: /\bAPI_BASE_URL\b/ },
  { name: "mock fixture data (the mock adapter must not ship)", re: /Amara Diallo|Kwame Mensah/ },
];

export function findBundleLeaks(text: string, apiBase?: string): string[] {
  const found = [
    ...findSecrets(text),
    ...FORBIDDEN.filter(({ re }) => re.test(text)).map(({ name }) => name),
  ];
  if (apiBase !== undefined && apiBase.length > 8 && text.includes(apiBase)) {
    found.push("the API address");
  }
  return found;
}
