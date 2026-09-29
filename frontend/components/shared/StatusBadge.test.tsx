import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";
import type { TaskStatus } from "@/lib/types";

const CASES: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "Todo" },
  { status: "in-progress", label: "In progress" },
  { status: "done", label: "Done" },
  { status: "blocked", label: "Blocked" },
];

describe("StatusBadge", () => {
  it.each(CASES)("renders the $label text for status $status", ({ status, label }) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("never conveys status through color alone: an icon is present alongside the text", () => {
    const { container } = render(<StatusBadge status="blocked" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });
});
