import type { User } from "@/schemas";

/** Session and account management. Mocked in Task 1; the real API in Task 4. */
export interface AuthService {
  getSession(): Promise<User | null>;
  login(email: string, password: string): Promise<User>;
  /** Creates the account only: registering never starts a session. */
  register(name: string, email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  forgotPassword(email: string): Promise<{ devResetUrl: string | null }>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  updateProfile(userId: string, input: { name?: string; email?: string }): Promise<User>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  uploadAvatar(userId: string, file: File): Promise<User>;
  deleteAvatar(userId: string): Promise<User>;
  deleteAccount(userId: string): Promise<void>;
}
