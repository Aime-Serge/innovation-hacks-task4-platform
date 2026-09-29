import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders the done/total label and correct aria value", () => {
    render(<ProgressBar progress={{ total: 4, done: 1, percent: 25 }} />);
    expect(screen.getByText("1/4 done")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

  it("degrades to a single empty segment for a project with zero tasks", () => {
    render(<ProgressBar progress={{ total: 0, done: 0, percent: 0 }} />);
    expect(screen.getByText("0/0 done")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
