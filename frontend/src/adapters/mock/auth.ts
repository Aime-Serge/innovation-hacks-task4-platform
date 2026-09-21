import type { User } from "@/schemas";
import type { AuthService } from "@/services/auth";
import { ServiceError } from "@/services/types";
import { findByEmail, findById, getAccounts, saveAccounts } from "./accounts";

const SESSION_COOKIE = "mock_session";
const SESSION_KEY = "devdash_session_user_id";
const RESET_TTL_MS = 30 * 60 * 1000;
const AVATAR_MAX_BYTES = 500_000;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const fail = (message: string, status = 400, code = "bad_request") =>
  new ServiceError(code, message, status);
const token = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

// A plain readable cookie (there is no server to keep a secret from) that
// proxy.ts checks for presence only, to avoid flashing a protected page.
function persistSession(userId: string | null): void {
  if (typeof document === "undefined") return;
  document.cookie = userId
    ? `${SESSION_COOKIE}=${userId}; path=/; max-age=${7 * 86_400}`
    : `${SESSION_COOKIE}=; path=/; max-age=0`;
  if (userId) window.localStorage.setItem(SESSION_KEY, userId);
  else window.localStorage.removeItem(SESSION_KEY);
}

function readSessionCookie(): string | null {
  const match = new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`).exec(document.cookie);
  return match?.[1] ?? null;
}

function account(userId: string) {
  const found = findById(userId);
  if (found === undefined) throw fail("Account not found.", 404, "not_found");
  return found;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(fail("Failed to read the image."));
    };
    reader.onerror = () => reject(fail("Failed to read the image."));
    reader.readAsDataURL(file);
  });
}

export function createMockAuth(): AuthService {
  return {
    async getSession(): Promise<User | null> {
      if (typeof window === "undefined") return null;
      await wait(150);
      const id = window.localStorage.getItem(SESSION_KEY) ?? readSessionCookie();
      const found = id === null ? undefined : findById(id);
      // A cookie for an account that no longer exists would bounce between the
      // route guard and the login page, so drop it.
      if (found === undefined && id !== null) persistSession(null);
      return found?.user ?? null;
    },
    async login(email, password) {
      await wait(400);
      const found = findByEmail(email);
      if (found === undefined || found.password !== password) {
        throw fail("Invalid email or password.", 401, "unauthorized");
      }
      persistSession(found.user.id);
      return found.user;
    },
    async register(name, email, password) {
      await wait(400);
      if (findByEmail(email) !== undefined) {
        throw fail("An account with this email already exists.", 409, "conflict");
      }
      const user: User = {
        id: `user-${token().slice(0, 7)}`,
        name,
        email,
        role: "developer",
        preferences: { theme: "dark" },
      };
      getAccounts().push({ user, password, resetToken: null, resetExpiresAt: null });
      saveAccounts();
      return user;
    },
    async logout() {
      persistSession(null);
      await wait(150);
    },
    async forgotPassword(email) {
      await wait(400);
      const found = findByEmail(email);
      if (found === undefined) return { devResetUrl: null };
      found.resetToken = token();
      found.resetExpiresAt = Date.now() + RESET_TTL_MS;
      saveAccounts();
      return { devResetUrl: `/reset-password?token=${found.resetToken}` };
    },
    async resetPassword(resetToken, newPassword) {
      await wait(400);
      const found = getAccounts().find((a) => a.resetToken === resetToken);
      const expired = found?.resetExpiresAt == null || found.resetExpiresAt < Date.now();
      if (found === undefined || expired) throw fail("Invalid or expired reset link.");
      found.password = newPassword;
      found.resetToken = null;
      found.resetExpiresAt = null;
      saveAccounts();
    },
    async updateProfile(userId, input) {
      await wait(300);
      const found = account(userId);
      if (input.name !== undefined) found.user.name = input.name;
      if (input.email !== undefined) found.user.email = input.email;
      saveAccounts();
      return found.user;
    },
    async changePassword(userId, currentPassword, newPassword) {
      await wait(300);
      const found = account(userId);
      if (found.password !== currentPassword) throw fail("Current password is incorrect.");
      found.password = newPassword;
      saveAccounts();
    },
    async uploadAvatar(userId, file) {
      if (!AVATAR_TYPES.includes(file.type))
        throw fail("Only PNG, JPEG, or WebP images are allowed.");
      if (file.size > AVATAR_MAX_BYTES) throw fail("Image must be 500 KB or smaller.");
      const url = await readFile(file);
      await wait(300);
      const found = account(userId);
      found.user.avatarUrl = url;
      saveAccounts();
      return found.user;
    },
    async deleteAvatar(userId) {
      await wait(300);
      const found = account(userId);
      delete found.user.avatarUrl;
      saveAccounts();
      return found.user;
    },
    async deleteAccount(userId) {
      await wait(300);
      const accounts = getAccounts();
      const index = accounts.findIndex((a) => a.user.id === userId);
      if (index !== -1) accounts.splice(index, 1);
      saveAccounts();
      persistSession(null);
    },
  };
}
