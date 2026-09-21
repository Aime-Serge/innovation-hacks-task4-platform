import vm from "node:vm";
import { render, renderHook, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCard } from "@/features/auth/AuthCard";
import { ProjectStatusBadge, PriorityBadge, TaskStatusBadge } from "@/features/shared/badges";
import { assertNever } from "@/lib/assert";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { Providers } from "@/providers";
import { storeScenario, useScenario } from "@/providers/scenario";
import { ServicesProvider, useServices } from "@/providers/ServicesProvider";
import { readTheme, resolveTheme, THEME_INIT_SCRIPT, THEME_KEY } from "@/providers/theme";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { emptyProjectQuery } from "@/schemas";
import { nav } from "./next-mock";

const hardNavigate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/navigation", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  hardNavigate,
}));

// Evaluates the inline theme script the way a browser would, in the jsdom globals.
const runThemeScript = (): void => {
  vm.runInNewContext(THEME_INIT_SCRIPT, {
    localStorage: window.localStorage,
    matchMedia: (query: string) => window.matchMedia(query),
    document,
  });
};

function matchMedia(dark: boolean) {
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("dark") ? dark : false,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  return listeners;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.cookie = "mock_session=; max-age=0";
  document.documentElement.removeAttribute("data-theme");
  hardNavigate.mockReset();
  matchMedia(false);
});

describe("TC-009 theme (FR-24)", () => {
  it("TC-009 reads the stored choice, falling back to system", () => {
    expect(readTheme()).toBe("system");
    window.localStorage.setItem(THEME_KEY, "dark");
    expect(readTheme()).toBe("dark");
    window.localStorage.setItem(THEME_KEY, "purple");
    expect(readTheme()).toBe("system");
  });

  it("TC-009 resolves system to the OS preference", () => {
    matchMedia(true);
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
    matchMedia(false);
    expect(resolveTheme("system")).toBe("light");
  });

  it("TC-009 the no-flash script sets data-theme before paint from storage or the OS", () => {
    window.localStorage.setItem(THEME_KEY, "dark");
    runThemeScript();
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    window.localStorage.setItem(THEME_KEY, "light");
    runThemeScript();
    expect(document.documentElement.dataset["theme"]).toBe("light");
    window.localStorage.removeItem(THEME_KEY);
    matchMedia(true);
    runThemeScript();
    expect(document.documentElement.dataset["theme"]).toBe("dark");
  });

  it("TC-009 changing the theme updates data-theme and persists it", async () => {
    const Probe = () => {
      const { theme, setTheme } = useTheme();
      return (
        <button type="button" onClick={() => setTheme("dark")}>
          {theme}
        </button>
      );
    };
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.documentElement.dataset["theme"]).toBe("light"));
    await userEvent.click(screen.getByRole("button", { name: "system" }));
    expect(await screen.findByRole("button", { name: "dark" })).toBeInTheDocument();
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("TC-009 the system theme follows OS changes live", async () => {
    const listeners = matchMedia(false);
    render(
      <ThemeProvider>
        <p>x</p>
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.documentElement.dataset["theme"]).toBe("light"));
    matchMedia(true);
    act(() => listeners.forEach((fn) => fn()));
    expect(document.documentElement.dataset["theme"]).toBe("dark");
  });

  it("TC-009 useTheme outside its provider is a programming error", () => {
    expect(() => renderHook(() => useTheme())).toThrow(/ThemeProvider/);
  });
});

describe("TC-022 scenario selection (FR-22)", () => {
  it("TC-022 the URL wins, then the remembered choice, then default", () => {
    expect(renderHook(() => useScenario()).result.current).toBe("default");
    storeScenario("flaky");
    expect(renderHook(() => useScenario()).result.current).toBe("flaky");
    nav.search = new URLSearchParams("scenario=empty");
    expect(renderHook(() => useScenario()).result.current).toBe("empty");
    nav.search = new URLSearchParams("scenario=bogus");
    expect(renderHook(() => useScenario()).result.current).toBe("flaky");
  });
});

describe("TC-004 session handling", () => {
  const Probe = () => {
    const { status, user, login, logout } = useAuth();
    return (
      <>
        <p>status:{status}</p>
        <p>user:{user?.name ?? "none"}</p>
        <button type="button" onClick={() => void login("aime.serge@example.com", "password123")}>
          in
        </button>
        <button type="button" onClick={() => void logout()}>
          out
        </button>
      </>
    );
  };

  it("TC-004 an anonymous visitor on a protected page is redirected to login with ?next=", async () => {
    nav.pathname = "/tasks";
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText("status:unauthenticated")).toBeInTheDocument();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/login?next=%2Ftasks"));
  });

  it("TC-004 public pages do not redirect an anonymous visitor", async () => {
    nav.pathname = "/register";
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("status:unauthenticated");
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("TC-004 logging in authenticates, and logging out clears the session with a full page load", async () => {
    nav.pathname = "/";
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("status:unauthenticated");
    await userEvent.click(screen.getByRole("button", { name: "in" }));
    expect(await screen.findByText("user:Aime Serge UKOBIZABA")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "out" }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login"));
    expect(screen.getByText("status:unauthenticated")).toBeInTheDocument();
  });

  it("TC-004 a signed-in visitor on /login is sent to the dashboard", async () => {
    document.cookie = "mock_session=user-1";
    window.localStorage.setItem("devdash_session_user_id", "user-1");
    nav.pathname = "/login";
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("status:authenticated");
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/"));
  });

  it("TC-004 a signed-in visitor on /login with ?next= is sent there, not to the dashboard", async () => {
    document.cookie = "mock_session=user-1";
    window.localStorage.setItem("devdash_session_user_id", "user-1");
    nav.pathname = "/login";
    nav.search = new URLSearchParams("next=%2Ftasks");
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/tasks"));
  });

  it("TC-004 useAuth outside its provider is a programming error", () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});

describe("TC-100 services provider", () => {
  it("TC-100 hands features the service interfaces for the selected scenario", async () => {
    nav.search = new URLSearchParams("scenario=empty");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>
        <ServicesProvider>{children}</ServicesProvider>
      </AuthProvider>
    );
    const { result } = renderHook(() => useServices(), { wrapper });
    const page = await result.current.projects.list(emptyProjectQuery());
    expect(page.total).toBe(0);
  });

  it("TC-100 useServices outside its provider is a programming error", () => {
    expect(() => renderHook(() => useServices())).toThrow(/ServicesProvider/);
  });

  it("TC-100 the full provider stack renders its children", async () => {
    render(
      <Providers>
        <p>hello</p>
      </Providers>,
    );
    expect(await screen.findByText("hello")).toBeInTheDocument();
  });
});

describe("TC-030 small shared pieces", () => {
  it("TC-030 every status and priority badge carries text", () => {
    render(
      <>
        {(["todo", "in_progress", "in_review", "done"] as const).map((s) => (
          <TaskStatusBadge key={s} status={s} />
        ))}
        {(["low", "medium", "high", "urgent"] as const).map((p) => (
          <PriorityBadge key={p} priority={p} />
        ))}
        {(["planned", "active", "on_hold", "completed"] as const).map((s) => (
          <ProjectStatusBadge key={s} status={s} />
        ))}
      </>,
    );
    for (const text of ["To do", "In review", "Low", "Urgent", "Planned", "Completed"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("TC-030 the auth card has one h1 and the brand bar", () => {
    render(
      <AuthCard title="Log in">
        <p>form</p>
      </AuthCard>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("TC-100 assertNever fails loudly for an impossible value", () => {
    expect(() => assertNever("surprise" as never)).toThrow(/surprise/);
  });
});
