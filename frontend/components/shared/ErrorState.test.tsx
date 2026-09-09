import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("renders the message and calls onRetry when Retry is clicked", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Unable to load projects." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load projects.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
