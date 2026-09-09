import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "./ProjectCard";
import type { Project } from "@/lib/types";

const project: Project = {
  id: "proj-atlas",
  name: "Atlas API Gateway",
  description: "Rate-limited gateway routing traffic to internal services.",
  ownerId: "user-1",
  createdAt: "2026-07-01T09:00:00.000Z",
};

describe("ProjectCard", () => {
  it("renders name, description, progress, and links to the project detail route", () => {
    render(
      <ul>
        <ProjectCard project={project} progress={{ total: 4, done: 1, percent: 25 }} />
      </ul>,
    );
    expect(screen.getByText(project.name)).toBeInTheDocument();
    expect(screen.getByText(project.description as string)).toBeInTheDocument();
    expect(screen.getByText("1/4 done")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/projects/proj-atlas");
  });
});
