// MT-01: the two-step registration wizard, per-step validation, and the final sign-in.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "@/features/auth/RegisterForm";
import type { RegistrationCheck } from "@/services/auth";
import { ServiceError } from "@/services/types";
import { renderApp } from "./render";

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
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(holder.register).toHaveBeenCalled());
    expect(holder.login).toHaveBeenCalledWith("ada@example.com", "password123456");
    expect(window.sessionStorage.getItem("devdash_show_welcome")).toBe("1");
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
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByText(/already exists/)).toBeInTheDocument();
  });
});
