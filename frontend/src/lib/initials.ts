/** "Ada Lovelace" -> "AL"; a single word gives its first two letters. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (first === undefined || last === undefined) return "?";
  if (parts.length === 1) return Array.from(first).slice(0, 2).join("").toUpperCase();
  return (Array.from(first)[0] ?? "") + (Array.from(last)[0] ?? "").toUpperCase();
}
