import { vi } from "vitest";

// A controllable stand-in for next/navigation, installed for every test.
export const nav = {
  pathname: "/",
  search: new URLSearchParams(),
  replace: vi.fn<(href: string) => void>(),
  push: vi.fn<(href: string) => void>(),
  /** History API updates (filters, scenario): what replaceUrl() calls. */
  replaceState: vi.fn<(state: unknown, unused: string, url?: string | URL | null) => void>(),
};

export const resetNav = (): void => {
  nav.pathname = "/";
  nav.search = new URLSearchParams();
  nav.replace.mockReset();
  nav.push.mockReset();
  nav.replaceState.mockReset();
};

export const usePathname = (): string => nav.pathname;
export const useSearchParams = (): URLSearchParams => nav.search;
export const useRouter = () => ({
  replace: nav.replace,
  push: nav.push,
  prefetch: vi.fn(),
  back: vi.fn(),
});

// MF-07: mirrors Next's real notFound(), which throws to be caught by the framework boundary.
export const notFound = (): never => {
  throw new Error("NEXT_NOT_FOUND");
};
