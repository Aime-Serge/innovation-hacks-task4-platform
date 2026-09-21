import type { User } from "@/schemas";

// Mock accounts for the login demo. Task 1 has no backend, so credentials are
// plaintext and unsigned; Task 4 has the real version (Argon2id, signed JWTs).
// Accounts persist to localStorage so a reload keeps a freshly registered
// account. This is auth data only: task and project data never touch storage.

export type Account = {
  user: User;
  password: string;
  resetToken: string | null;
  resetExpiresAt: number | null;
};

const STORAGE_KEY = "devdash_mock_accounts";

function seed(): Account[] {
  return [
    {
      user: {
        id: "user-1",
        name: "Aime Serge UKOBIZABA",
        email: "aime.serge@example.com",
        role: "developer",
        preferences: { theme: "dark" },
      },
      password: "password123",
      resetToken: null,
      resetExpiresAt: null,
    },
  ];
}

function load(): Account[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Account[];
  } catch {
    // Corrupt or blocked storage: start from the seed.
  }
  return seed();
}

let accounts: Account[] | null = null;

export function getAccounts(): Account[] {
  accounts ??= load();
  return accounts;
}

export function saveAccounts(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(getAccounts()));
  } catch {
    // Storage full or blocked: changes still apply for this tab.
  }
}

export function findByEmail(email: string): Account | undefined {
  const needle = email.trim().toLowerCase();
  return getAccounts().find((a) => (a.user.email ?? "").toLowerCase() === needle);
}

export function findById(id: string): Account | undefined {
  return getAccounts().find((a) => a.user.id === id);
}

/** Test hook: forget the in-memory cache so the next read reloads storage. */
export function resetAccountsCache(): void {
  accounts = null;
}
