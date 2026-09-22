// MF-07: another member's page, privacy-aware, never the email or statistics.
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemberProfileView } from "@/features/profile/MemberProfileView";
import { installScenario } from "./mock-services";
import { renderApp } from "./render";

vi.mock("@/providers/ServicesProvider", () => import("./mock-services"));
vi.mock("@/providers/AuthProvider", () => import("./mock-auth"));

beforeEach(() => installScenario("default"));

describe("MF-07 member profile page", () => {
  it("shows the header and body, but never the email or statistics", async () => {
    renderApp(<MemberProfileView id="user-2" />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Amara Diallo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Full-stack · Lead or above")).toBeInTheDocument();
    expect(screen.queryByText("amara.diallo@example.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Statistics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile completeness" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit profile" })).not.toBeInTheDocument();
  });

  it("hides professional details when the member's privacy switch is off (MB-02)", async () => {
    renderApp(<MemberProfileView id="user-3" />);
    await screen.findByRole("heading", { level: 1, name: "Kwame Mensah" });
    expect(screen.queryByText(/Mobile/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "About" })).not.toBeInTheDocument();
  });
});
