import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectCard } from "@/features/projects/ProjectCard";
import { ProjectDetailView } from "@/features/projects/ProjectDetailView";
import { ProjectsView } from "@/features/projects/ProjectsView";
import { TaskCard } from "@/features/tasks/TaskCard";
import { TasksView } from "@/features/tasks/TasksView";
import { useTaskQuery } from "@/features/tasks/useTaskQuery";
import { useProjectQuery } from "@/features/projects/useProjectQuery";
import { emptyTaskQuery, type Scenario } from "@/schemas";
import { renderHook, act } from "@testing-library/react";
import { makeProject, makeTask } from "./helpers";
import { nav } from "./next-mock";
import { installScenario } from "./mock-services";
import { renderApp } from "./render";

vi.mock("@/providers/ServicesProvider", () => import("./mock-services"));
vi.mock("@/providers/AuthProvider", () => import("./mock-auth"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2030-01-10T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const open = (ui: React.ReactElement, scenario: Scenario = "default") => {
  installScenario(scenario);
  return renderApp(ui);
};

describe("TC-030 cards show every field (FR-11, FR-12)", () => {
  it("TC-030 the task card shows title, status, priority, due date, assignee and project", () => {
    renderApp(
      <TaskCard
        task={makeTask({
          title: "Fix login",
          status: "in_review",
          priority: "high",
          dueDate: "2030-02-03",
        })}
        projectName="Alpha"
        assigneeName="Ada Lovelace"
        onStatusChange={() => undefined}
      />,
    );
    expect(screen.getByRole("heading", { name: "Fix login" })).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Feb 3")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Change status of Fix login" })).toHaveValue(
      "in_review",
    );
  });

  it("TC-030 long titles truncate visually but stay readable through a title tooltip", () => {
    const long = "A".repeat(120);
    renderApp(
      <TaskCard
        task={makeTask({ title: long })}
        projectName={undefined}
        assigneeName={undefined}
        onStatusChange={() => undefined}
      />,
    );
    const heading = screen.getByRole("heading");
    expect(heading).toHaveClass("truncate");
    expect(heading).toHaveAttribute("title", long);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText("No due date")).toBeInTheDocument();
  });

  it("TC-031 an overdue task is marked with visible text, not colour alone", () => {
    renderApp(
      <TaskCard
        task={makeTask({ dueDate: "2030-01-01", status: "todo" })}
        projectName="P"
        assigneeName="A"
        onStatusChange={() => undefined}
      />,
    );
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("TC-031 a finished or future task is not marked overdue", () => {
    renderApp(
      <>
        <TaskCard
          task={makeTask({ dueDate: "2030-01-01", status: "done" })}
          projectName="P"
          assigneeName="A"
          onStatusChange={() => undefined}
        />
        <TaskCard
          task={makeTask({ dueDate: "2030-03-01", status: "todo" })}
          projectName="P"
          assigneeName="A"
          onStatusChange={() => undefined}
        />
      </>,
    );
    expect(screen.queryByText("Overdue")).toBeNull();
  });

  it("TC-030 changing the status select reports the new status", async () => {
    const onStatusChange = vi.fn();
    renderApp(
      <TaskCard
        task={makeTask({ title: "T" })}
        projectName="P"
        assigneeName="A"
        onStatusChange={onStatusChange}
      />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), "done");
    expect(onStatusChange).toHaveBeenCalledWith(expect.any(String), "done");
  });

  it("TC-030 the project card shows name, status, due date, progress and counts", () => {
    renderApp(
      <ProjectCard
        project={makeProject({
          id: "p-9",
          name: "Alpha",
          status: "on_hold",
          dueDate: "2030-05-06",
        })}
        progress={{ total: 4, done: 1, percent: 25 }}
      />,
    );
    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute("href", "/projects/p-9");
    expect(screen.getByText("On hold")).toBeInTheDocument();
    expect(screen.getByText("Due May 6")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progress of Alpha" })).toHaveAttribute(
      "aria-valuenow",
      "25",
    );
    expect(screen.getByText("1 of 4 tasks done")).toBeInTheDocument();
  });

  it("TC-030 counts are singular for one task", () => {
    renderApp(<ProjectCard project={makeProject()} progress={{ total: 1, done: 0, percent: 0 }} />);
    expect(screen.getByText("0 of 1 task done")).toBeInTheDocument();
  });
});

describe("TC-053 URL state (FR-17, TH-02)", () => {
  it("TC-053 restores search, filters and sort from the URL", () => {
    nav.search = new URLSearchParams(
      "q=login&status=todo,done&priority=high&project=p-1&sort=title&dir=desc",
    );
    const { result } = renderHook(() => useTaskQuery());
    expect(result.current.query).toEqual({
      q: "login",
      status: ["todo", "done"],
      priority: ["high"],
      projectId: ["p-1"],
      assigneeId: null,
      sort: "title",
      dir: "desc",
    });
    expect(result.current.filtered).toBe(true);
  });

  it("TC-053 unknown or hostile values fall back to defaults", () => {
    nav.search = new URLSearchParams("status=bogus,todo&priority=<script>&sort=drop&dir=sideways");
    const { result } = renderHook(() => useTaskQuery());
    expect(result.current.query.status).toEqual(["todo"]);
    expect(result.current.query.priority).toEqual([]);
    expect(result.current.query.sort).toBe("due_date");
    expect(result.current.query.dir).toBe("asc");
  });

  it("TC-053 updates write the URL, keep other params and drop defaults", () => {
    nav.pathname = "/tasks";
    nav.search = new URLSearchParams("scenario=empty");
    const { result } = renderHook(() => useTaskQuery());
    act(() => result.current.update({ q: " hi ", status: ["done"] }));
    expect(nav.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/tasks?scenario=empty&q=hi&status=done",
    );
    act(() => result.current.clear());
    expect(nav.replaceState).toHaveBeenLastCalledWith(null, "", "/tasks?scenario=empty");
  });

  it("TC-053 the project list uses the same contract", () => {
    nav.pathname = "/projects";
    nav.search = new URLSearchParams("q=x&status=active,nope&sort=due_date&dir=desc");
    const { result } = renderHook(() => useProjectQuery());
    expect(result.current.query).toEqual({
      q: "x",
      status: ["active"],
      sort: "due_date",
      dir: "desc",
    });
    act(() => result.current.update({ sort: "name", dir: "asc" }));
    expect(nav.replaceState).toHaveBeenCalledWith(null, "", "/projects?q=x&status=active");
    act(() => result.current.clear());
    expect(nav.replaceState).toHaveBeenLastCalledWith(null, "", "/projects?sort=due_date&dir=desc");
    expect(emptyTaskQuery().q).toBe("");
  });
});

describe("TC-054 tasks page (FR-15..19, FR-21)", () => {
  it("TC-050 lists tasks with a live count and caps rendering for large sets", async () => {
    open(<TasksView />, "large");
    expect(await screen.findByText("500 tasks")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(24);
    await userEvent.click(screen.getByRole("button", { name: /Show more/ }));
    expect(screen.getAllByRole("article")).toHaveLength(48);
    expect(screen.getByRole("status")).toHaveTextContent("500 tasks");
  });

  it("TC-054 no results differs from no data", async () => {
    nav.search = new URLSearchParams("q=zzzzzzzz");
    open(<TasksView />);
    expect(await screen.findByRole("heading", { name: "No results" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Clear filters" }).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.queryByRole("button", { name: "Create a task" })).toBeNull();
  });

  it("TC-071 the empty scenario offers a create-first action that opens the form", async () => {
    open(<TasksView />, "empty");
    expect(await screen.findByRole("heading", { name: "No tasks yet" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create a task" }));
    expect(await screen.findByRole("dialog", { name: "New task" })).toBeInTheDocument();
  });

  it("TC-072 the error scenario shows an error and Retry refetches", async () => {
    open(<TasksView />, "error");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("TC-051 filter checkboxes and search write to the URL", async () => {
    nav.pathname = "/tasks";
    open(<TasksView />);
    await screen.findByText(/\d+ tasks/);
    await userEvent.click(screen.getByRole("checkbox", { name: "To do" }));
    expect(nav.replaceState).toHaveBeenCalledWith(null, "", "/tasks?status=todo");
    await userEvent.click(screen.getByRole("checkbox", { name: "Urgent" }));
    expect(nav.replaceState).toHaveBeenLastCalledWith(null, "", "/tasks?priority=urgent");
    await userEvent.click(screen.getByRole("button", { name: /Sort: Due date/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Title" }));
    expect(nav.replaceState).toHaveBeenLastCalledWith(null, "", "/tasks?sort=title");
  });

  it("TC-019 update-fails rolls the status back and shows an error toast", async () => {
    open(<TasksView />, "update-fails");
    const first = (await screen.findAllByRole("article"))[0] as HTMLElement;
    const select = within(first).getByRole("combobox");
    const before = (select as HTMLSelectElement).value;
    const next = before === "done" ? "todo" : "done";
    await userEvent.selectOptions(select, next);
    expect(
      await screen.findByText("Could not update the task. The change was undone."),
    ).toBeInTheDocument();
    await waitFor(() => {
      const card = screen.getAllByRole("article")[0] as HTMLElement;
      expect(within(card).getByRole<HTMLSelectElement>("combobox").value).toBe(before);
    });
  });

  it("TC-019 a successful status change sticks", async () => {
    open(<TasksView />);
    const first = (await screen.findAllByRole("article"))[0] as HTMLElement;
    const select = within(first).getByRole<HTMLSelectElement>("combobox");
    const next = select.value === "done" ? "todo" : "done";
    await userEvent.selectOptions(select, next);
    await waitFor(() => expect(screen.queryByText(/could not update/i)).toBeNull());
    expect(screen.queryByText("Could not update the task. The change was undone.")).toBeNull();
  });

  it("TC-030 creating a task validates required fields, then saves with a toast", async () => {
    open(<TasksView />);
    await screen.findByText(/\d+ tasks/);
    await userEvent.click(screen.getByRole("button", { name: "New task" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a title of 1 to 120 characters.")).toBeInTheDocument();
    expect(screen.getByText("Choose the project this task belongs to.")).toBeInTheDocument();
    const dialog = await screen.findByRole("dialog", { name: "New task" });
    await userEvent.type(within(dialog).getByLabelText("Title"), "Brand new task");
    const project = within(dialog).getByLabelText<HTMLSelectElement>("Project");
    await userEvent.selectOptions(project, project.options[1]?.value ?? "");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Task created.")).toBeInTheDocument();
  });
});

describe("TC-054 projects pages (FR-11, FR-14)", () => {
  it("TC-030 lists project cards with progress and a count", async () => {
    open(<ProjectsView />);
    expect(await screen.findByText(/^\d+ projects$/)).toBeInTheDocument();
    expect(screen.getAllByRole("article").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("progressbar").length).toBeGreaterThan(0);
  });

  it("TC-071 the empty scenario offers Create a project", async () => {
    open(<ProjectsView />, "empty");
    expect(await screen.findByRole("heading", { name: "No projects yet" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create a project" }));
    expect(await screen.findByRole("dialog", { name: "New project" })).toBeInTheDocument();
  });

  it("TC-054 a search with no match shows no-results, not the empty state", async () => {
    nav.search = new URLSearchParams("q=qqqqqq");
    open(<ProjectsView />);
    expect(await screen.findByRole("heading", { name: "No results" })).toBeInTheDocument();
  });

  it("TC-072 the error scenario shows Retry", async () => {
    open(<ProjectsView />, "error");
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("TC-030 creating a project validates, then saves", async () => {
    open(<ProjectsView />);
    await screen.findByText(/^\d+ projects$/);
    await userEvent.click(screen.getByRole("button", { name: "New project" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Enter a name of 1 to 80 characters.")).toBeInTheDocument();
    expect(screen.getByText("Choose a due date.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Name"), "Fresh project");
    await userEvent.type(screen.getByLabelText("Due date"), "2030-06-01");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Project created.")).toBeInTheDocument();
  });

  it("TC-040 the detail page shows the ring, counts and that project's tasks", async () => {
    open(<ProjectDetailView id="project-1" />);
    expect(await screen.findByRole("progressbar", { name: /^Progress of/ })).toBeInTheDocument();
    expect(await screen.findAllByRole("article")).not.toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument();
  });

  it("TC-014 an unknown project id shows a not-found state with a way back", async () => {
    open(<ProjectDetailView id="does-not-exist" />);
    expect(await screen.findByRole("heading", { name: "Project not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
  });

  it("TC-072 the detail page shows an error with Retry when the request fails", async () => {
    open(<ProjectDetailView id="project-1" />, "error");
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("TC-030 the detail page can open the edit and add-task dialogs", async () => {
    open(<ProjectDetailView id="project-1" />);
    await screen.findByRole("progressbar");
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("dialog", { name: "Edit project" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "New task" }));
    expect(await screen.findByRole("dialog", { name: "New task" })).toBeInTheDocument();
  });
});
