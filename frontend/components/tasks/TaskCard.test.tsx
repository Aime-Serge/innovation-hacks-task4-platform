import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskCard } from "./TaskCard";
import type { Task } from "@/lib/types";

const task: Task = {
  id: "t-1",
  projectId: "proj-atlas",
  title: "Write integration tests for auth middleware",
  status: "in-progress",
  priority: "high",
  dueDate: "2026-09-10",
  createdAt: "2026-07-05T09:00:00.000Z",
};

describe("TaskCard", () => {
  it("renders title, status, priority, and formatted due date", () => {
    render(
      <ul>
        <TaskCard task={task} />
      </ul>,
    );
    expect(screen.getByText(task.title)).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    // Visible text is short ("High"); a visually-hidden sr-only span
    // carries the full "High priority" phrase so screen readers don't
    // lose meaning outside the row's visual context.
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("High priority")).toBeInTheDocument();
    expect(screen.getByText("Sep 10")).toBeInTheDocument();
  });

  it("shows the project name only when explicitly asked to", () => {
    const { rerender } = render(
      <ul>
        <TaskCard task={task} />
      </ul>,
    );
    expect(screen.queryByText("Atlas API Gateway")).not.toBeInTheDocument();

    rerender(
      <ul>
        <TaskCard task={task} projectName="Atlas API Gateway" />
      </ul>,
    );
    expect(screen.getByText("Atlas API Gateway")).toBeInTheDocument();
  });

  it("renders a fallback when there is no due date", () => {
    render(
      <ul>
        <TaskCard task={{ ...task, dueDate: null }} />
      </ul>,
    );
    expect(screen.getByText("No due date")).toBeInTheDocument();
  });
});
