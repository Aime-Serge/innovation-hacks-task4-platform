import type { Project, User } from "@/schemas";

export const byId = <T extends { id: string }>(items: readonly T[] | undefined): Map<string, T> =>
  new Map((items ?? []).map((item) => [item.id, item]));

export type Lookups = { users: Map<string, User>; projects: Map<string, Project> };
