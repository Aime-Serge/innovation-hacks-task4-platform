export function formatDueDate(iso: string | null): string {
  if (!iso) return "No due date";
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!first || !last) return "?";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}
