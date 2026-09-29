import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WelcomePage } from "@/features/welcome/WelcomePage";
import LoginRoute from "@/app/(auth)/login/page";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/providers/AuthProvider";

describe("the public front door", () => {
  it("the welcome page greets the visitor and offers login and sign-up", () => {
    render(<WelcomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome to DevDash" }),
    ).toBeInTheDocument();
    const main = screen.getByRole("main");
    // Log in sits in the header only; the hero's single button is the sign-up invitation.
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: "Log in" }),
    ).toHaveAttribute("href", "/login");
    expect(within(main).queryByRole("link", { name: "Log in" })).toBeNull();
    expect(within(main).getByRole("link", { name: "Join Us" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("a signed-in visitor is offered the dashboard instead of login and sign-up", () => {
    render(<WelcomePage signedIn />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome to DevDash" })).toBeVisible();
    const main = screen.getByRole("main");
    expect(within(main).getByRole("link", { name: "Go to your dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(within(main).queryByRole("link", { name: "Log in" })).toBeNull();
    expect(within(main).queryByRole("link", { name: "Join Us" })).toBeNull();
  });

  it("the login page welcomes the visitor back and links home", () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <LoginRoute />
        </AuthProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("Log in to pick up where you left off.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "DevDash home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });
});
