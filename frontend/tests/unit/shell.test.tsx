import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";
import { LoginForm } from "@/features/auth/LoginForm";
import { RegisterForm } from "@/features/auth/RegisterForm";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { AppShell } from "@/layout/AppShell";
import { MobileNav } from "@/layout/MobileNav";
import { NavLinks } from "@/layout/NavLinks";
import { ScenarioSwitcher } from "@/layout/ScenarioSwitcher";
import { SkipLink } from "@/layout/SkipLink";
import { CreateMenu } from "@/layout/CreateMenu";
import { HeaderSearch } from "@/layout/HeaderSearch";
import { UserMenu } from "@/layout/UserMenu";
import { t, tCount } from "@/i18n";
import { reportError, setErrorReporter } from "@/lib/report-error";
import { ServiceError } from "@/services/types";
import { auth, authState, testUser } from "./mock-auth";
import { nav } from "./next-mock";
import { renderApp } from "./render";

const hardNavigate = vi.hoisted(() => vi.fn());
const themeState = vi.hoisted(() => ({ theme: "system", setTheme: vi.fn() }));

vi.mock("@/providers/AuthProvider", () => import("./mock-auth"));
vi.mock("@/providers/ServicesProvider", () => import("./mock-services"));
vi.mock("@/providers/ThemeProvider", () => ({ useTheme: () => themeState }));
vi.mock("@/lib/navigation", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  hardNavigate,
}));

beforeEach(() => {
  authState.user = testUser;
  hardNavigate.mockReset();
  themeState.theme = "system";
  themeState.setTheme.mockReset();
  for (const fn of Object.values(auth)) fn.mockReset();
  authState.login.mockReset();
  authState.logout.mockReset();
  authState.setUser.mockReset();
});

describe("TC-010 navigation (FR-05..08)", () => {
  it("TC-010 marks the current page with aria-current and no other", () => {
    nav.pathname = "/projects/abc";
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("TC-010 the dashboard link is current only on /", () => {
    nav.pathname = "/";
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Tasks" })).not.toHaveAttribute("aria-current");
  });

  it("TC-012 the skip link is the first focusable element and targets main", async () => {
    renderApp(
      <AppShell>
        <p>Body</p>
      </AppShell>,
    );
    await userEvent.tab();
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("TC-012 the shell ends with a labelled footer landmark and safe external links", () => {
    renderApp(
      <AppShell>
        <p>Body</p>
      </AppShell>,
    );
    const footer = screen.getByRole("contentinfo", { name: "Site footer" });
    const repo = within(footer).getByRole("link", { name: "Source on GitHub" });
    expect(repo).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(footer).getByText(/mock data and mock login/)).toBeInTheDocument();
  });

  it("TC-012 the shell has header, nav and one main landmark", () => {
    renderApp(
      <AppShell>
        <p>Body</p>
      </AppShell>,
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getAllByRole("navigation").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    render(<SkipLink />);
  });

  it("TC-011 the drawer opens from the menu button, lists the links, closes on Escape and on link selection", async () => {
    render(<MobileNav />);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    expect(dialog).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await userEvent.click(screen.getByRole("link", { name: "Tasks" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("TC-008 the account menu shows the user, links to their pages and logs out", async () => {
    render(<UserMenu />);
    await userEvent.click(
      screen.getByRole("button", { name: "Account menu for Aime Serge UKOBIZABA" }),
    );
    expect(await screen.findByText(testUser.email ?? "")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("menuitem", { name: "Projects" })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("menuitem", { name: "Tasks" })).toHaveAttribute("href", "/tasks");
    await userEvent.click(screen.getByRole("menuitem", { name: "Log out" }));
    expect(authState.logout).toHaveBeenCalled();
  });

  it("TC-008 renders nothing without a user", () => {
    authState.user = null;
    const { container } = render(<UserMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it("TC-009 Appearance lists system, light and dark, marks the current one and applies a choice", async () => {
    render(<UserMenu />);
    await userEvent.click(
      screen.getByRole("button", { name: "Account menu for Aime Serge UKOBIZABA" }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: "Appearance" }));
    expect(await screen.findAllByRole("menuitemradio")).toHaveLength(3);
    expect(screen.getByRole("menuitemradio", { name: "System" })).toBeChecked();
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(themeState.setTheme).toHaveBeenLastCalledWith("dark");
  });

  it("the create menu offers a new project and a new task", async () => {
    render(<CreateMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Create new…" }));
    expect(await screen.findByRole("menuitem", { name: "New project" })).toHaveAttribute(
      "href",
      "/projects?new=1",
    );
    expect(screen.getByRole("menuitem", { name: "New task" })).toHaveAttribute(
      "href",
      "/tasks?new=1",
    );
  });

  it("the header search opens the task list with the query, and / focuses it", async () => {
    render(<HeaderSearch />);
    const field = screen.getByRole("searchbox", { name: "Quick search" });
    expect(field).toHaveAttribute("placeholder", "Type / to search");
    await userEvent.keyboard("/");
    expect(field).toHaveFocus();
    await userEvent.type(field, "  api docs{Enter}");
    expect(nav.push).toHaveBeenCalledWith("/tasks?q=api%20docs");
    await userEvent.clear(field);
    await userEvent.type(field, "{Enter}");
    expect(nav.push).toHaveBeenLastCalledWith("/tasks");
  });

  it("TC-022 the scenario switcher lists all nine scenarios and writes ?scenario=", async () => {
    nav.pathname = "/tasks";
    nav.search = new URLSearchParams("q=x");
    render(<ScenarioSwitcher />);
    const select = screen.getByRole("combobox", { name: "Scenario" });
    expect(screen.getAllByRole("option")).toHaveLength(9);
    await userEvent.selectOptions(select, "error");
    expect(nav.replaceState).toHaveBeenCalledWith(null, "", "/tasks?q=x&scenario=error");
  });
});

describe("TC-021 profile form (FR-10)", () => {
  it("TC-021 Save is disabled until the name changes and is valid", async () => {
    renderApp(<ProfileForm user={testUser} />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    expect(save).toBeDisabled();
    expect(name).toHaveAccessibleDescription("Enter your name.");
    expect(name).toHaveAttribute("aria-invalid", "true");
    await userEvent.type(name, "Ada");
    expect(save).toBeEnabled();
    expect(name).not.toHaveAttribute("aria-invalid");
  });

  it("TC-021 rejects names over 80 characters with a message", async () => {
    renderApp(<ProfileForm user={testUser} />);
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "x".repeat(81));
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription(
      "Use 80 characters or fewer.",
    );
  });

  it("TC-021 saving updates the profile and confirms with a toast", async () => {
    auth.updateProfile.mockResolvedValue({ ...testUser, name: "Ada" });
    renderApp(<ProfileForm user={testUser} />);
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "  Ada  ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(auth.updateProfile).toHaveBeenCalledWith("user-1", { name: "Ada" });
    expect(authState.setUser).toHaveBeenCalled();
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
  });

  it("TC-021 a failed save shows a plain error and never the raw failure", async () => {
    setErrorReporter(() => undefined);
    auth.updateProfile.mockRejectedValue(new Error("db exploded at line 42"));
    renderApp(<ProfileForm user={testUser} />);
    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("We could not save your changes. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/exploded/)).toBeNull();
  });

  it("TC-009 the theme select applies the chosen theme", async () => {
    renderApp(<ProfileForm user={testUser} />);
    await userEvent.selectOptions(screen.getByLabelText("Theme"), "dark");
    expect(themeState.setTheme).toHaveBeenCalledWith("dark");
  });
});

describe("TC-005 auth forms (register redirects to login)", () => {
  it("TC-005 registering creates the account and sends the user to the login page, not the app", async () => {
    auth.register.mockResolvedValue(testUser);
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("Name"), " Ada ");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login?registered=1"));
    expect(auth.register).toHaveBeenCalledWith("Ada", "ada@example.com", "password123");
    expect(authState.login).not.toHaveBeenCalled();
  });

  it("TC-005 short and mismatched passwords are rejected before any request", async () => {
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "Use at least 8 characters.",
    );
    await userEvent.clear(screen.getByLabelText("Password"));
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different1");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "The passwords do not match.",
    );
    expect(auth.register).not.toHaveBeenCalled();
  });

  it("TC-005 a taken email names the fix, any other failure stays generic", async () => {
    auth.register.mockRejectedValueOnce(new ServiceError("conflict", "x", 409));
    render(<RegisterForm />);
    const fill = async () => {
      await userEvent.type(screen.getByLabelText("Name"), "Ada");
      await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
      await userEvent.type(screen.getByLabelText("Password"), "password123");
      await userEvent.type(screen.getByLabelText("Confirm password"), "password123");
      await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    };
    await fill();
    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    auth.register.mockRejectedValueOnce(new Error("boom"));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("TC-004 login sends the user to the requested page, never an external one", async () => {
    authState.login.mockResolvedValue();
    nav.search = new URLSearchParams("next=%2Ftasks");
    const { unmount } = render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/tasks"));
    unmount();
    hardNavigate.mockReset();
    nav.search = new URLSearchParams("next=https%3A%2F%2Fevil.example");
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/"));
  });

  it("TC-004 the login page confirms a new account and shows credential errors", async () => {
    nav.search = new URLSearchParams("registered=1");
    authState.login.mockRejectedValue(
      new ServiceError("unauthorized", "Incorrect email or password.", 401),
    );
    render(<LoginForm />);
    expect(screen.getByRole("status")).toHaveTextContent("Account created. Log in to continue.");
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "wrongwrong");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    authState.login.mockRejectedValue(new Error("network"));
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong"),
    );
  });

  it("TC-004 forgot password never reveals whether the email exists", async () => {
    auth.forgotPassword.mockResolvedValue({ devResetUrl: null });
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email"), "nobody@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If an account exists");
    expect(screen.queryByRole("link", { name: /reset link/i })).toBeNull();
  });

  it("TC-004 forgot password offers the demo link when the mock issues one, and reports failures", async () => {
    auth.forgotPassword.mockResolvedValueOnce({ devResetUrl: "/reset-password?token=abc" });
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("link", { name: "Open reset link (demo)" })).toHaveAttribute(
      "href",
      "/reset-password?token=abc",
    );
    auth.forgotPassword.mockRejectedValueOnce(new Error("x"));
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("TC-004 reset password validates, resets and returns to login", async () => {
    nav.search = new URLSearchParams("token=abc");
    auth.resetPassword.mockResolvedValue(undefined);
    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText("New password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("at least 8");
    await userEvent.clear(screen.getByLabelText("New password"));
    await userEvent.type(screen.getByLabelText("New password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password124");
    await userEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("do not match");
    await userEvent.clear(screen.getByLabelText("Confirm password"));
    await userEvent.type(screen.getByLabelText("Confirm password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/login?registered=0"));
    expect(auth.resetPassword).toHaveBeenCalledWith("abc", "password123");
  });

  it("TC-004 reset password without a token, or with an expired one, explains itself", async () => {
    nav.search = new URLSearchParams();
    const { unmount } = render(<ResetPasswordForm />);
    expect(screen.getByRole("alert")).toHaveTextContent("invalid or has expired");
    unmount();
    nav.search = new URLSearchParams("token=old");
    auth.resetPassword.mockRejectedValue(new Error("expired"));
    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText("New password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or has expired");
  });
});

describe("TC-023 i18n and error reporting (NFR-20, NFR-21)", () => {
  it("TC-023 t() fills parameters and leaves unknown ones visible", () => {
    expect(t("project.due", { date: "May 6" })).toBe("Due May 6");
    expect(t("project.due")).toBe("Due {date}");
    expect(t("project.due", { other: "x" })).toBe("Due {date}");
  });

  it("TC-023 tCount() picks singular or plural", () => {
    expect(tCount("tasks.count", 1)).toBe("1 task");
    expect(tCount("tasks.count", 0)).toBe("0 tasks");
    expect(tCount("tasks.count", 12)).toBe("12 tasks");
  });

  it("TC-024 every client error goes through one swappable reporter", () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const failure = new Error("secret internals");
    reportError(failure, "unit");
    expect(reporter).toHaveBeenCalledWith({ error: failure, context: "unit" });
  });
});
