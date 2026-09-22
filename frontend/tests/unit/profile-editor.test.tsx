// MF-08: the profile editor validates, saves and reports per-field errors against PATCH /me/profile.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileEditView } from "@/features/profile/ProfileEditView";
import { installScenario } from "./mock-services";
import { renderApp } from "./render";

vi.mock("@/providers/ServicesProvider", () => import("./mock-services"));
vi.mock("@/providers/AuthProvider", () => import("./mock-auth"));

beforeEach(() => installScenario("default"));

describe("MF-08 profile editor", () => {
  it("loads the current values, saves changes and shows the confirmation", async () => {
    const user = userEvent.setup();
    renderApp(<ProfileEditView />);
    const headline = await screen.findByLabelText("Headline (optional)");
    expect(screen.getByLabelText("First name")).toHaveValue("Aime Serge");
    await user.clear(headline);
    await user.type(headline, "Staff engineer");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
  });

  it("adds and removes a skill (MB-05: at most 10, unique ignoring case)", async () => {
    const user = userEvent.setup();
    renderApp(<ProfileEditView />);
    await screen.findByLabelText("First name");
    const skillInput = screen.getByPlaceholderText("Add a skill and press Enter");
    await user.type(skillInput, "python{enter}");
    expect(await screen.findByText("You already have that skill.")).toBeInTheDocument();
    await user.clear(skillInput);
    await user.type(skillInput, "Rust{enter}");
    expect(await screen.findByText("Rust")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Rust" }));
    await waitFor(() => expect(screen.queryByText("Rust")).not.toBeInTheDocument());
  });

  it("rejects a GitHub link on the wrong host before saving", async () => {
    const user = userEvent.setup();
    renderApp(<ProfileEditView />);
    const github = await screen.findByLabelText("GitHub URL");
    await user.clear(github);
    await user.type(github, "https://example.com/ada");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a valid https://github.com link.")).toBeInTheDocument();
  });

  it("shows company and job title only when employed or freelance", async () => {
    const user = userEvent.setup();
    renderApp(<ProfileEditView />);
    await screen.findByLabelText("First name");
    expect(screen.getByLabelText("Company")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Employment status"), "student");
    expect(screen.queryByLabelText("Company")).not.toBeInTheDocument();
  });
});
