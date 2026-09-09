import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and message as real text", () => {
    render(<EmptyState title="No projects yet" message="Projects you create will show up here." />);
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Projects you create will show up here.")).toBeInTheDocument();
  });

  it("omits the action button when no action is given", () => {
    render(<EmptyState title="No tasks yet" message="Tasks you create will show up here." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onAction when the action button is clicked", async () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="No projects match your filters"
        message="Try a different search term or clear your filters."
        actionLabel="Clear filters"
        onAction={onAction}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
