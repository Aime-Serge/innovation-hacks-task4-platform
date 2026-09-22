// MT-01: the two-step registration wizard, per-step validation, and the final sign-in.
import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "@/features/auth/RegisterForm";
import type { RegistrationCheck } from "@/services/auth";
import { ServiceError } from "@/services/types";
import { renderApp } from "./render";

// RF-01: "Create account" on step 2 now opens the role dialog rather than submitting directly;
// the dialog has its own "Create account" button as its confirm action.
async function chooseRoleAndCreate(user: UserEvent, role: "Developer" | "Team Lead" = "Developer") {
  await user.click(screen.getByRole("button", { name: "Create account" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("radio", { name: role }));
  await user.click(within(dialog).getByRole("button", { name: "Create account" }));
}

const holder = vi.hoisted(() => ({
  validateRegistration: vi.fn(),
  register: vi.fn(),
  login: vi.fn(),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    auth: { validateRegistration: holder.validateRegistration, register: holder.register },
    login: holder.login,
  }),
}));

beforeEach(() => {
  holder.validateRegistration.mockReset().mockResolvedValue(undefined);
  holder.register.mockReset();
  holder.login.mockReset();
  window.sessionStorage.clear();
});

describe("MT-01 registration wizard", () => {
  it("moves to step 2 only after step 1 validates, and back preserves the values", async () => {
    const user = userEvent.setup();
    renderApp(<RegisterForm />);
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123456");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(holder.validateRegistration).toHaveBeenCalledWith({
      step: 1,
      givenName: "Ada",
      familyName: "Lovelace",
      email: "ada@example.com",
      password: "password123456",
    });
    expect(
      await screen.findByRole("heading", { name: "Tell us about your work" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveValue("Ada");
  });

  it("shows per-field messages from a 422 and does not advance", async () => {
    // A real per-field check, not a one-shot mock: the field also blurs (and re-validates) as
    // each earlier field is filled in, so the assertion has to hold for every call, not just one.
    holder.validateRegistration.mockImplementation((check: RegistrationCheck) => {
      if (check.step === 1 && check.email === "not-an-email") {
        return Promise.reject(
          new ServiceError("VALIDATION_ERROR", "bad", 422, undefined, [
            { field: "email", message: "Enter a valid email address." },
          ]),
        );
      }
      return Promise.resolve(undefined);
    });
    const user = userEvent.setup();
    renderApp(<RegisterForm />);
    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "password123456");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });

  it("shows company and job title only when employed or freelance", async () => {
    const user = userEvent.setup();
    renderApp(<RegisterForm />);
    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123456");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Tell us about your work" });
    expect(screen.getByLabelText("Company")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Employment status"), "student");
    expect(screen.queryByLabelText("Company")).not.toBeInTheDocument();
  });

  it("submits, signs in, and redirects to the dashboard (MF-01, MF-05)", async () => {
    holder.register.mockResolvedValue({ id: "user-9", name: "Ada Lovelace" });
    holder.login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderApp(<RegisterForm />);
    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123456");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Tell us about your work" });
    await user.selectOptions(screen.getByLabelText("Country"), "RW");
    await user.click(screen.getByLabelText(/accept the Terms/));
    await user.click(screen.getByLabelText(/confirm that I meet/));
    await chooseRoleAndCreate(user);
    await waitFor(() => expect(holder.register).toHaveBeenCalled());
    expect(holder.register).toHaveBeenCalledWith(
      expect.objectContaining({ role: "developer" }),
    );
    expect(holder.login).toHaveBeenCalledWith("ada@example.com", "password123456");
    expect(window.sessionStorage.getItem("devdash_show_welcome")).toBe("1");
  });

  it("RF-02: choosing Team Lead in the role dialog sends role=lead", async () => {
    holder.register.mockResolvedValue({ id: "user-9", name: "Ada Lovelace" });
    holder.login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderApp(<RegisterForm />);
    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123456");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Tell us about your work" });
    await user.selectOptions(screen.getByLabelText("Country"), "RW");
    await user.click(screen.getByLabelText(/accept the Terms/));
    await user.click(screen.getByLabelText(/confirm that I meet/));
    await chooseRoleAndCreate(user, "Team Lead");
    await waitFor(() =>
      expect(holder.register).toHaveBeenCalledWith(expect.objectContaining({ role: "lead" })),
    );
  });

  it("RT-01: the role dialog blocks Create account until an option is chosen, keyboard-reachable", async () => {
    const user = userEvent.setup();
    renderApp(<RegisterForm />);
    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123456");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Tell us about your work" });
    await user.selectOptions(screen.getByLabelText("Country"), "RW");
    await user.click(screen.getByLabelText(/accept the Terms/));
    await user.click(screen.getByLabelText(/confirm that I meet/));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Create account" });
    expect(confirm).toBeDisabled();
    expect(holder.register).not.toHaveBeenCalled();
    // Keyboard-only: focus the radio (as Tab would land on it) and select with Space, no mouse.
    const developerRadio = within(dialog).getByRole("radio", { name: "Developer" });
    developerRadio.focus();
    expect(developerRadio).toHaveFocus();
    await user.keyboard(" ");
    expect(developerRadio).toBeChecked();
    expect(confirm).toBeEnabled();
    // Escape leaves the account form exactly as it was, nothing submitted.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(holder.register).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Tell us about your work" }),
    ).toBeInTheDocument();
  });

  it("ADR-426: registering with an image link sends it as avatarUrl", async () => {
    holder.register.mockResolvedValue({ id: "user-9", name: "Ada Lovelace" });
    holder.login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderApp(<RegisterForm />);
    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123456");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Tell us about your work" });
    await user.selectOptions(screen.getByLabelText("Country"), "RW");
    await user.type(
      screen.getByLabelText("Or paste an image link"),
      "https://example.com/ada.png",
    );
    await user.click(screen.getByLabelText(/accept the Terms/));
    await user.click(screen.getByLabelText(/confirm that I meet/));
    await chooseRoleAndCreate(user);
    await waitFor(() =>
      expect(holder.register).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: "https://example.com/ada.png" }),
      ),
    );
  });

  it("ADR-426: registering with an uploaded photo sends the file read to a data: URL", async () => {
    holder.register.mockResolvedValue({ id: "user-9", name: "Ada Lovelace" });
    holder.login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { container } = renderApp(<RegisterForm />);
    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123456");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Tell us about your work" });
    await user.selectOptions(screen.getByLabelText("Country"), "RW");
    const file = new File(["fake-bytes"], "ada.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Upload a photo"), file);
    // The live preview proves the file was read before the account is ever submitted. Avatar's
    // <img> has alt="" (decorative), so it has no accessible "img" role to query by; check the
    // DOM directly instead, as Task 1's own Avatar test does.
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    await user.click(screen.getByLabelText(/accept the Terms/));
    await user.click(screen.getByLabelText(/confirm that I meet/));
    await chooseRoleAndCreate(user);
    await waitFor(() => expect(holder.register).toHaveBeenCalled());
    const sent = holder.register.mock.calls[0]?.[0] as { avatarUrl?: string };
    expect(sent.avatarUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("ADR-426: an http link is refused without a request, and blocks submission until fixed", async () => {
    const user = userEvent.setup();
    renderApp(<RegisterForm />);
    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123456");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Tell us about your work" });
    await user.selectOptions(screen.getByLabelText("Country"), "RW");
    await user.type(screen.getByLabelText("Or paste an image link"), "http://example.com/a.png");
    await user.click(screen.getByLabelText("Or paste an image link"));
    await user.tab();
    expect(await screen.findByText("Enter a valid https:// image link.")).toBeInTheDocument();
    await user.click(screen.getByLabelText(/accept the Terms/));
    await user.click(screen.getByLabelText(/confirm that I meet/));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(holder.register).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove photo" }));
    await chooseRoleAndCreate(user);
    await waitFor(() =>
      expect(holder.register).toHaveBeenCalledWith(
        expect.not.objectContaining({ avatarUrl: expect.anything() }),
      ),
    );
  });

  it("registering with no photo omits avatarUrl entirely", async () => {
    holder.register.mockResolvedValue({ id: "user-9", name: "Ada Lovelace" });
    holder.login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderApp(<RegisterForm />);
    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123456");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Tell us about your work" });
    await user.selectOptions(screen.getByLabelText("Country"), "RW");
    await user.click(screen.getByLabelText(/accept the Terms/));
    await user.click(screen.getByLabelText(/confirm that I meet/));
    await chooseRoleAndCreate(user);
    await waitFor(() => expect(holder.register).toHaveBeenCalled());
    const sent = holder.register.mock.calls[0]?.[0] as Record<string, unknown>;
    expect("avatarUrl" in sent).toBe(false);
  });

  it("a duplicate email sends the person back to step 1 with a message", async () => {
    holder.register.mockRejectedValueOnce(new ServiceError("EMAIL_ALREADY_EXISTS", "x", 409));
    const user = userEvent.setup();
    renderApp(<RegisterForm />);
    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password123456");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Tell us about your work" });
    await user.selectOptions(screen.getByLabelText("Country"), "RW");
    await user.click(screen.getByLabelText(/accept the Terms/));
    await user.click(screen.getByLabelText(/confirm that I meet/));
    await chooseRoleAndCreate(user);
    expect(await screen.findByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByText(/already exists/)).toBeInTheDocument();
    // The failed submission's dialog is gone; nothing is left half-open (RF-01).
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
