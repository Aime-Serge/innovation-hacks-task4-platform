import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/features/dashboard/DashboardView";
import { ActivityFeed } from "@/features/dashboard/ActivityFeed";
import { DeadlineList } from "@/features/dashboard/DeadlineList";
import { ProfileView } from "@/features/profile/ProfileView";
import { installScenario } from "./mock-services";
import { renderApp } from "./render";
import { makeProject, makeTask } from "./helpers";
import type { Scenario } from "@/schemas";

vi.mock("@/providers/ServicesProvider", () => import("./mock-services"));
vi.mock("@/providers/AuthProvider", () => import("./mock-auth"));
vi.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));

// Freeze "today" so KPI and deadline expectations do not drift.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-01-10T12:00:00Z"));
});

afterEach(() => vi.useRealTimers());

const open = (scenario: Scenario) => {
  installScenario(scenario);
  renderApp(<DashboardView />);
};

describe("TC-001 dashboard content (FR-01..04)", () => {
  it("TC-001 shows the h1, four KPIs, deadlines and activity", async () => {
    open("default");
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    const kpis = await screen.findByText("Active projects");
    const region = kpis.closest("section") as HTMLElement;
    for (const label of ["Active projects", "Open tasks", "Overdue tasks", "Completion rate"]) {
      expect(within(region).getByText(label)).toBeInTheDocument();
    }
    expect(await screen.findByRole("heading", { name: "Upcoming deadlines" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Recent activity" })).toBeInTheDocument();
  });

  it("TC-002 KPI values are numbers derived from the data", async () => {
    open("default");
    const label = await screen.findByText("Open tasks");
    await waitFor(() => expect(label.nextElementSibling?.textContent).toMatch(/^\d+$/));
    expect(Number(label.nextElementSibling?.textContent)).toBeGreaterThan(0);
    const overdue = screen.getByText("Overdue tasks").nextElementSibling?.textContent;
    expect(Number(overdue)).toBeGreaterThan(0);
  });

  it("TC-070 shows skeletons while loading", () => {
    open("loading");
    expect(document.querySelectorAll("[aria-busy='true']").length).toBeGreaterThan(0);
  });

  it("TC-071 empty scenario: zero KPIs plus empty deadline and activity states", async () => {
    open("empty");
    expect(await screen.findByText("No deadlines this week")).toBeInTheDocument();
    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(3);
  });

  it("TC-072 error scenario: every region shows an error with Retry", async () => {
    open("error");
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBe(3));
    expect(screen.getAllByRole("button", { name: "Retry" }).length).toBe(3);
  });

  it("TC-073 partial error: tasks regions fail, the activity feed still works", async () => {
    open("partial-error");
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBe(2));
    expect(await screen.findByRole("list")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent activity" })).toBeInTheDocument();
  });

  it("TC-072 flaky scenario recovers when Retry is pressed", async () => {
    open("flaky");
    const retry = (await screen.findAllByRole("button", { name: "Retry" }))[0];
    await userEvent.click(retry as HTMLElement);
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeLessThan(3));
  });
});

describe("TC-003 dashboard lists", () => {
  it("TC-003 deadline rows show title, project, priority and date", () => {
    const project = makeProject({ id: "p-x", name: "Alpha" });
    const task = makeTask({
      title: "Ship it",
      projectId: "p-x",
      priority: "urgent",
      dueDate: "2030-01-12",
    });
    renderApp(<DeadlineList tasks={[task]} projects={new Map([["p-x", project]])} />);
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute("href", "/projects/p-x");
    expect(screen.getByText("Urgent")).toBeInTheDocument();
    expect(screen.getByText("Jan 12")).toBeInTheDocument();
  });

  it("TC-003 activity rows read as sentences with relative times", () => {
    const items = [
      {
        id: "a1",
        actorId: "u1",
        projectId: "p1",
        type: "completed" as const,
        at: "2030-01-10T10:00:00.000Z",
      },
      {
        id: "a2",
        actorId: "ghost",
        projectId: "ghost",
        type: "created" as const,
        at: "2030-01-09T10:00:00.000Z",
      },
    ];
    renderApp(
      <ActivityFeed
        items={items}
        users={
          new Map([
            [
              "u1",
              {
                id: "u1",
                name: "Ada",
                email: "a@b.co",
                role: "lead",
                preferences: { theme: "system" },
              },
            ],
          ])
        }
        projects={new Map([["p1", makeProject({ id: "p1", name: "Alpha" })]])}
      />,
    );
    expect(screen.getByText("Ada completed a task in Alpha")).toBeInTheDocument();
    expect(screen.getByText("Someone created a task in Unknown project")).toBeInTheDocument();
    expect(document.querySelectorAll("time")).toHaveLength(2);
  });
});

describe("TC-020 profile page (FR-09)", () => {
  it("TC-020 shows avatar initials, name, email, role and stats", async () => {
    installScenario("default");
    renderApp(<ProfileView />);
    expect(screen.getByRole("heading", { level: 1, name: "Profile" })).toBeInTheDocument();
    expect(screen.getAllByText("Aime Serge UKOBIZABA").length).toBeGreaterThan(0);
    expect(screen.getByText("aime.serge@example.com")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(await screen.findByText("Assigned")).toBeInTheDocument();
    expect(screen.getByText("Completion rate")).toBeInTheDocument();
  });

  it("TC-072 the stats region shows an error with Retry when tasks fail", async () => {
    installScenario("error");
    renderApp(<ProfileView />);
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Edit profile" })).toBeInTheDocument();
  });
});
