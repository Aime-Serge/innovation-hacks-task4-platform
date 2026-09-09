import { api } from "./api";
import type { User } from "./types";

interface ApiUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toUser(u: ApiUser): User {
  return { id: u.id, name: u.name, email: u.email, initials: getInitials(u.name) };
}

export async function fetchCurrentUser(): Promise<User> {
  const data = await api.get<ApiUser>("/auth/me");
  return toUser(data);
}

export async function login(email: string, password: string): Promise<User> {
  const data = await api.post<{ user: ApiUser }>("/auth/login", { email, password });
  return toUser(data.user);
}

export async function register(name: string, email: string, password: string): Promise<User> {
  const data = await api.post<{ user: ApiUser }>("/auth/register", { name, email, password });
  return toUser(data.user);
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}
