import { api } from "./api";
import { getInitials } from "./format";
import type { User } from "./types";

interface ApiUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
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
