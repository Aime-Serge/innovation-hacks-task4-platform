// MF-12, MF-13, MF-15, MF-16: settings tabs, password change, preferences and privacy.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsView } from "@/features/settings/SettingsView";
import { installScenario } from "./mock-services";
import { renderApp } from "./render";

const themeState = vi.hoisted(() => ({ theme: "system" as const, setTheme: vi.fn() }));
vi.mock("@/providers/ServicesProvider", () => import("./mock-services"));
vi.mock("@/providers/AuthProvider", () => import("./mock-auth"));
vi.mock("@/providers/ThemeProvider", () => ({ useTheme: () => themeState }));

beforeEach(() => {
  installScenario("default");
  themeState.setTheme.mockReset();
});

describe("MF-12 settings", () => {
  it("shows four tabs and switches between them with arrow keys", async () => {
    const user = userEvent.setup();
    renderApp(<SettingsView />);
    await screen.findByLabelText("First name");
    const profileTab = screen.getByRole("tab", { name: "Profile" });
    expect(profileTab).toHaveAttribute("aria-selected", "true");
    profileTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Privacy" })).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByLabelText("Show my professional details to other members"),
    ).toBeInTheDocument();
  });

  it("MF-13: a wrong current password shows 403 INVALID_CREDENTIALS as a plain message", async () => {
    const user = userEvent.setup();
    renderApp(<SettingsView />);
    await user.click(await screen.findByRole("tab", { name: "Account" }));
    await user.type(screen.getByLabelText("Current password"), "wrong-password");
    await user.type(screen.getByLabelText("New password"), "a-new-password-123");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("That password is incorrect.")).toBeInTheDocument();
  });

  it("MF-15: preferences save the theme and time zone together", async () => {
    const user = userEvent.setup();
    renderApp(<SettingsView />);
    await user.click(await screen.findByRole("tab", { name: "Preferences" }));
    await user.selectOptions(screen.getByLabelText("Theme"), "light");
    expect(themeState.setTheme).toHaveBeenCalledWith("light");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Preferences saved.")).toBeInTheDocument();
  });

  it("MF-16: the privacy switch saves immediately", async () => {
    const user = userEvent.setup();
    renderApp(<SettingsView />);
    await user.click(await screen.findByRole("tab", { name: "Privacy" }));
    const toggle = screen.getByLabelText("Show my professional details to other members");
    expect(toggle).toBeChecked();
    await user.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(await screen.findByText("Privacy setting saved.")).toBeInTheDocument();
  });
});
