// FR-401 (registration closed, too many attempts), FR-412 (edit only for owner or lead), FR-415 (closed project).
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RegisterForm } from "@/features/auth/RegisterForm";
import { ServiceError } from "@/services/types";
import { renderApp } from "./render";

const holder = vi.hoisted((): { register: unknown; login: unknown } => ({
  register: null,
  login: null,
}));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    auth: { register: holder.register, validateRegistration: vi.fn().mockResolvedValue(undefined) },
    login: holder.login,
  }),
}));

async function submit() {
  const user = userEvent.setup();
  renderApp(<RegisterForm />);
  await user.type(screen.getByLabelText("First name"), "Ada");
  await user.type(screen.getByLabelText("Last name"), "Lovelace");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "long-password-1");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.selectOptions(await screen.findByLabelText("Country"), "RW");
  await user.click(screen.getByLabelText(/accept the Terms/));
  await user.click(screen.getByLabelText(/confirm that I meet/));
  // RF-01: "Create account" now opens the role dialog first.
  await user.click(screen.getByRole("button", { name: "Create account" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("radio", { name: "Developer" }));
  await user.click(within(dialog).getByRole("button", { name: "Create account" }));
}

describe("FR-401 registration failures are explained", () => {
  it.each([
    [new ServiceError("REGISTRATION_DISABLED", "x", 403), /Registration is closed/],
    [new ServiceError("RATE_LIMITED", "x", 429), /Too many attempts/],
    [new ServiceError("EMAIL_ALREADY_EXISTS", "x", 409), /already exists/],
    [new ServiceError("INTERNAL_ERROR", "x", 500), /Something went wrong/],
  ])("shows the right message for %s", async (error, words) => {
    holder.register = vi.fn().mockRejectedValue(error);
    holder.login = vi.fn();
    await submit();
    await waitFor(() => expect(screen.getByText(words)).toBeInTheDocument());
  });
});
