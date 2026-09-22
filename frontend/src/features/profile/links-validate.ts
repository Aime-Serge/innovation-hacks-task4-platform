// MF-08: client-side link host validation, mirroring the server's rules (MB-04). The server
// is authoritative; this only gives immediate feedback before the round trip.
const HTTPS_RE = /^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^\s]*)?$/;
const GITHUB_RE = /^https:\/\/([A-Za-z0-9-]+\.)?github\.com([/?#][^\s]*)?$/;
const LINKEDIN_RE = /^https:\/\/([A-Za-z0-9-]+\.)?linkedin\.com([/?#][^\s]*)?$/;

export function validateGithub(value: string): boolean {
  return value === "" || GITHUB_RE.test(value);
}
export function validateLinkedin(value: string): boolean {
  return value === "" || LINKEDIN_RE.test(value);
}
export function validateWebsite(value: string): boolean {
  return value === "" || HTTPS_RE.test(value);
}

/** MB-05: at most 10, 1-30 characters, unique ignoring case (client-side; server is authoritative). */
export function skillProblem(
  skill: string,
  existing: readonly string[],
): "empty" | "long" | "limit" | "duplicate" | null {
  const trimmed = skill.trim();
  if (trimmed === "") return "empty";
  if (trimmed.length > 30) return "long";
  if (existing.length >= 10) return "limit";
  if (existing.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return "duplicate";
  return null;
}
