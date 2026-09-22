import type { Profile, User } from "@/schemas";
import type { AuthService, RegistrationCheck } from "@/services/auth";
import { ServiceError } from "@/services/types";
import { findByEmail, findById, getAccounts, saveAccounts } from "./accounts";
import { composeDisplayHeadline } from "./profile";
import {
  validateDisplayName,
  validateEmailField,
  validateGivenOrFamilyName,
  validatePasswordField,
  validateProfileDraft,
} from "./profile-validate";

const SESSION_COOKIE = "mock_session";
const SESSION_KEY = "devdash_session_user_id";
const RESET_TTL_MS = 30 * 60 * 1000;
const AVATAR_MAX_BYTES = 500_000;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const fail = (message: string, status = 400, code = "bad_request") =>
  new ServiceError(code, message, status);
const failFields = (details: { field: string; message: string }[]) =>
  new ServiceError("VALIDATION_ERROR", "One or more fields are invalid.", 422, undefined, details);
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
    // MF-01: one step at a time, and it creates nothing (~30/min in the real API; not
    // reproduced here, since the mock is single-user and has no shared rate limiter).
    async validateRegistration(check: RegistrationCheck) {
      await wait(200);
      const errors =
        check.step === 1
          ? [
              check.givenName !== undefined
                ? validateGivenOrFamilyName("givenName", check.givenName)
                : null,
              check.familyName !== undefined
                ? validateGivenOrFamilyName("familyName", check.familyName)
                : null,
              check.givenName !== undefined && check.familyName !== undefined
                ? validateDisplayName(check.givenName, check.familyName)
                : null,
              check.email !== undefined ? validateEmailField(check.email) : null,
              check.email !== undefined && check.password !== undefined
                ? validatePasswordField(
                    check.password,
                    check.email,
                    check.givenName ?? "",
                    check.familyName ?? "",
                  )
                : null,
            ].filter((e) => e !== null)
          : [
              ...(check.profile !== undefined
                ? validateProfileDraft(check.profile, { required: false })
                : []),
              check.termsAccepted !== undefined && !check.termsAccepted
                ? { field: "termsAccepted", message: "You must accept the terms." }
                : null,
              check.ageConfirmed !== undefined && !check.ageConfirmed
                ? { field: "ageConfirmed", message: "You must confirm you meet the minimum age." }
                : null,
            ].filter((e) => e !== null);
      if (errors.length > 0) throw failFields(errors);
    },
    // S-A: creates the account only; the caller signs in with POST /auth/login afterwards.
    async register(input) {
      await wait(400);
      const step1Errors = [
        validateGivenOrFamilyName("givenName", input.givenName),
        validateGivenOrFamilyName("familyName", input.familyName),
        validateDisplayName(input.givenName, input.familyName),
        validateEmailField(input.email),
        validatePasswordField(input.password, input.email, input.givenName, input.familyName),
      ].filter((e) => e !== null);
      // termsAccepted and ageConfirmed are typed `true` (RegisterInput): the wizard cannot send
      // false, so there is nothing to validate here beyond the compiler's own check.
      const step2Errors = validateProfileDraft(input.profile, { required: true });
      if (step1Errors.length > 0 || step2Errors.length > 0)
        throw failFields([...step1Errors, ...step2Errors]);
      if (findByEmail(input.email) !== undefined) {
        throw fail("An account with this email already exists.", 409, "EMAIL_ALREADY_EXISTS");
      }
      const profile: Profile = {
        discipline: input.profile.discipline,
        seniority: input.profile.seniority,
        employmentStatus: input.profile.employmentStatus,
        companyName: input.profile.companyName ?? null,
        jobTitle: input.profile.jobTitle ?? null,
        country: input.profile.country,
        city: input.profile.city ?? null,
        timeZone: input.profile.timeZone,
        headline: null,
        displayHeadline: null,
        about: "",
        links: { github: null, linkedin: null, website: null },
        skills: [],
      };
      const user: User = {
        id: `user-${token().slice(0, 7)}`,
        name: `${input.givenName} ${input.familyName}`,
        givenName: input.givenName,
        familyName: input.familyName,
        email: input.email,
        role: "developer",
        preferences: { theme: "system" },
        createdAt: new Date().toISOString(),
        profile: { ...profile, displayHeadline: composeDisplayHeadline(profile) },
      };
      getAccounts().push({
        user,
        password: input.password,
        resetToken: null,
        resetExpiresAt: null,
        showProfessionalDetails: true,
        legacyProfile: false,
      });
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
