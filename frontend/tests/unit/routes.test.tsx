import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RootError from "@/app/error";
import Loading from "@/app/(app)/loading";
import NotFound from "@/app/not-found";
import robots from "@/app/robots";
import { setErrorReporter } from "@/lib/report-error";

describe("TC-072 route-level states (NFR-19)", () => {
  it("TC-072 the last-resort error boundary reports the error, shows plain text and retries", async () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const reset = vi.fn();
    const failure = new Error("stack trace with internals");
    render(<RootError error={failure} reset={reset} />);
    expect(reporter).toHaveBeenCalledWith({ error: failure, context: "route" });
    expect(screen.getByRole("alert")).not.toHaveTextContent(/stack trace/);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("TC-072 unknown routes get a not-found page with a way home", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/");
  });

  it("TC-070 the route loading state is marked busy", () => {
    const { container } = render(<Loading />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("TC-016 robots.txt allows crawling", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" } });
  });
});
