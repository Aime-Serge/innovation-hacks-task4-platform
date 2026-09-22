"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createHttpAuth, onSessionEnded } from "@/adapters/http";
import { createMockAuth } from "@/adapters/mock";
import { hardNavigate, safeInternalPath } from "@/lib/navigation";
import type { User } from "@/schemas";
import type { AuthService } from "@/services/auth";
import { useTheme } from "./ThemeProvider";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";
type AuthValue = {
  auth: AuthService;
  user: User | null;
  status: SessionStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  /** Stable and lazy: readers get the current user without re-rendering. */
  getUserId: () => string | undefined;
};

const AuthContext = createContext<AuthValue | null>(null);
const ENTRY_PATHS = ["/login", "/register"];
const PUBLIC_PATHS = [...ENTRY_PATHS, "/forgot-password", "/reset-password"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useMemo(
    () => (process.env["NEXT_PUBLIC_DATA_SOURCE"] === "mock" ? createMockAuth() : createHttpAuth()),
    [],
  );
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const { setTheme } = useTheme();
  const userRef = useRef<User | null>(null);
  const getUserId = useCallback(() => userRef.current?.id, []);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const router = useRouter();
  const pathname = usePathname();
  // A signed-in user on /login goes where ?next= says, so this redirect never
  // races the login form's own deep-link navigation (seen in WebKit).
  const next = safeInternalPath(useSearchParams().get("next"));

  useEffect(() => {
    void auth.getSession().then((session) => {
      setUser(session);
      setStatus(session === null ? "unauthenticated" : "authenticated");
    });
  }, [auth]);

  useEffect(() => {
    if (user !== null) setTheme(user.preferences.theme);
  }, [setTheme, user]);

  // A refresh that fails ends the session wherever the person is (FR-405).
  useEffect(
    () =>
      onSessionEnded(() => {
        setUser(null);
        setStatus("unauthenticated");
      }),
    [],
  );

  // Backs up proxy.ts, which only checks that a cookie exists.
  useEffect(() => {
    if (status === "unauthenticated" && !PUBLIC_PATHS.includes(pathname)) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
    if (status === "authenticated" && ENTRY_PATHS.includes(pathname)) router.replace(next);
  }, [status, pathname, router, next]);

  const login = useCallback(
    async (email: string, password: string) => {
      setUser(await auth.login(email, password));
      setStatus("authenticated");
    },
    [auth],
  );
  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
    setStatus("unauthenticated");
    hardNavigate("/login");
  }, [auth]);

  const value = useMemo(
    () => ({ auth, user, status, login, logout, setUser, getUserId }),
    [auth, user, status, login, logout, getUserId],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
