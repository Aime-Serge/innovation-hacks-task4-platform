import { api } from "./api";
import { getInitials } from "./format";
import type { User } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ApiUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
  has_avatar: boolean;
}

function toUser(u: ApiUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    initials: getInitials(u.name),
    hasAvatar: u.has_avatar,
  };
}

export function avatarUrl(userId: string): string {
  return `${API_URL}/users/${userId}/avatar`;
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

export async function forgotPassword(
  email: string,
): Promise<{ message: string; devResetUrl: string | null }> {
  const data = await api.post<{ message: string; dev_reset_url: string | null }>(
    "/auth/forgot-password",
    { email },
  );
  return { message: data.message, devResetUrl: data.dev_reset_url };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post("/auth/reset-password", { token, new_password: newPassword });
}

export async function updateProfile(
  userId: string,
  input: { name?: string; email?: string },
): Promise<User> {
  const data = await api.patch<ApiUser>(`/users/${userId}`, input);
  return toUser(data);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.post(`/users/${userId}/change-password`, {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function uploadAvatar(userId: string, file: File): Promise<User> {
  const form = new FormData();
  form.append("file", file);
  const data = await api.postForm<ApiUser>(`/users/${userId}/avatar`, form);
  return toUser(data);
}

export async function deleteAvatar(userId: string): Promise<User> {
  const data = await api.delete<ApiUser>(`/users/${userId}/avatar`);
  return toUser(data);
}

export async function deleteAccount(userId: string): Promise<void> {
  await api.delete(`/users/${userId}`);
}
