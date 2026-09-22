import { vi } from "vitest";
import type { User } from "@/schemas";
import type { AuthService } from "@/services/auth";

export const testUser: User = {
  id: "user-1",
  name: "Aime Serge UKOBIZABA",
  givenName: "Aime Serge",
  familyName: "UKOBIZABA",
  email: "aime.serge@example.com",
  role: "developer",
  preferences: { theme: "system" },
  profile: {
    discipline: "backend",
    seniority: "senior",
    employmentStatus: "employed",
    companyName: "DevDash Inc.",
    jobTitle: "Backend Engineer",
    country: "RW",
    city: "Kigali",
    timeZone: "Africa/Kigali",
    headline: null,
    displayHeadline: "Senior Backend engineer at DevDash Inc.",
    about: "I build the services behind DevDash.",
    links: { github: "https://github.com/aime-serge", linkedin: null, website: null },
    skills: ["Python", "PostgreSQL"],
  },
};

export const auth = {
  getSession: vi.fn(),
  login: vi.fn(),
  validateRegistration: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  deleteAccount: vi.fn(),
} satisfies Record<keyof AuthService, ReturnType<typeof vi.fn>>;

export const authState = {
  user: testUser as User | null,
  login: vi.fn<(email: string, password: string) => Promise<void>>(),
  logout: vi.fn<() => Promise<void>>(),
  setUser: vi.fn<(user: User) => void>(),
};

export const useAuth = () => ({
  auth: auth as unknown as AuthService,
  user: authState.user,
  status: authState.user === null ? ("unauthenticated" as const) : ("authenticated" as const),
  login: authState.login,
  logout: authState.logout,
  setUser: authState.setUser,
  getUserId: () => authState.user?.id,
});
