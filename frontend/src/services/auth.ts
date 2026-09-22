import type { ProfileDraft, User } from "@/schemas";

// MF-01, S-A: registration step 1 (account) and step 2 (professional details and consent),
// checked one at a time by POST /users/validate before the final POST /users.
export type RegistrationStep1 = Partial<{
  givenName: string;
  familyName: string;
  email: string;
  password: string;
}>;
export type RegistrationStep2 = Partial<{
  profile: Partial<ProfileDraft>;
  termsAccepted: boolean;
  ageConfirmed: boolean;
}>;
export type RegistrationCheck =
  ({ step: 1 } & RegistrationStep1) | ({ step: 2 } & RegistrationStep2);

export type RegisterInput = {
  givenName: string;
  familyName: string;
  email: string;
  password: string;
  profile: ProfileDraft;
  termsAccepted: true;
  ageConfirmed: true;
};

/** Session and account management. Mocked in Task 1; the real API in Task 4. */
export interface AuthService {
  getSession(): Promise<User | null>;
  login(email: string, password: string): Promise<User>;
  /** Checks one registration step and creates nothing (MF-01). Throws on a 422, with per-field details. */
  validateRegistration(check: RegistrationCheck): Promise<void>;
  /** Creates the account only: registering never starts a session (the caller then calls login). */
  register(input: RegisterInput): Promise<User>;
  logout(): Promise<void>;
  forgotPassword(email: string): Promise<{ devResetUrl: string | null }>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  updateProfile(userId: string, input: { name?: string; email?: string }): Promise<User>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  uploadAvatar(userId: string, file: File): Promise<User>;
  deleteAvatar(userId: string): Promise<User>;
  deleteAccount(userId: string): Promise<void>;
}
