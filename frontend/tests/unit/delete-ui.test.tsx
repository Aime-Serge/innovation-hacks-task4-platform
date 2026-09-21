// TC-421 (delete project and the 409 message), TC-422 (delete task, restore on failure), FR-413, FR-420.
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteTask } from "@/features/data/hooks";
import { DeleteProjectButton } from "@/features/projects/DeleteProjectButton";
import { TaskList } from "@/features/tasks/TaskList";
import { useTaskDeletion } from "@/features/tasks/useTaskDeletion";
import type { Project, Task } from "@/schemas";
import { ServiceError } from "@/services/types";
import { ToastProvider } from "@/ui/Toast";
import { nav } from "./next-mock";
import { renderApp } from "./render";

const holder = vi.hoisted((): { services: unknown; user: unknown } => ({
  services: null,
  user: null,
}));
vi.mock("@/providers/ServicesProvider", () => ({ useServices: () => holder.services }));
vi.mock("@/providers/AuthProvider", () => ({ useAuth: () => ({ user: holder.user }) }));

const project: Project = {
  id: "p1",
  name: "Atlas",
  description: "",
  status: "active",
  dueDate: null,
  ownerId: "owner",
};
const task = (id: string, title: string, projectId = "p1"): Task => ({
  id,
  projectId,
  title,
  description: "",
  status: "todo",
  priority: "low",
  dueDate: null,
  assigneeId: null,
});
const as = (id: string, role: "developer" | "lead") => {
  holder.user = { id, name: id, email: null, role, preferences: { theme: "system" } };
};
const install = (remove: ReturnType<typeof vi.fn>) => {
  holder.services = { projects: { remove }, tasks: { remove } };
};
beforeEach(() => nav.push.mockReset());

describe("FR-413 delete a project", () => {
  it("asks first, and deleting goes back to the projects with a confirmation", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    install(remove);
    renderApp(<DeleteProjectButton id="p1" name="Atlas" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete project" }));
    expect(
      await screen.findByText("“Atlas” will be removed. This cannot be undone."),
    ).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled(); // nothing happens until it is confirmed
    await user.click(
      screen.getAllByRole("button", { name: "Delete project" }).at(-1) as HTMLElement,
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/projects"));
  });
  it("can be cancelled without deleting", async () => {
    const remove = vi.fn();
    install(remove);
    renderApp(<DeleteProjectButton id="p1" name="Atlas" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete project" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(remove).not.toHaveBeenCalled();
    expect(nav.push).not.toHaveBeenCalled();
  });
  it("explains a project that still has tasks, with a link to them", async () => {
    install(vi.fn().mockRejectedValue(new ServiceError("PROJECT_NOT_EMPTY", "x", 409)));
    renderApp(<DeleteProjectButton id="p1" name="Atlas" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete project" }));
    await user.click(
      (await screen.findAllByRole("button", { name: "Delete project" })).at(-1) as HTMLElement,
    );
    expect(
      await screen.findByText(/still has tasks, so it cannot be deleted yet/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View its tasks" })).toHaveAttribute(
      "href",
      "/tasks?project=p1",
    );
    expect(nav.push).not.toHaveBeenCalled();
  });
  it("says so plainly for any other failure", async () => {
    install(vi.fn().mockRejectedValue(new ServiceError("INTERNAL_ERROR", "x", 500)));
    renderApp(<DeleteProjectButton id="p1" name="Atlas" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete project" }));
    await user.click(
      (await screen.findAllByRole("button", { name: "Delete project" })).at(-1) as HTMLElement,
    );
    expect(
      await screen.findByText("The project could not be deleted. Try again."),
    ).toBeInTheDocument();
  });
});

function Harness({ tasks }: { tasks: Task[] }) {
  const deletion = useTaskDeletion([project]);
  return (
    <>
      <TaskList
        status="success"
        tasks={tasks}
        projects={[project]}
        users={[]}
        filtered={false}
        onRetry={() => undefined}
        onClear={() => undefined}
        onCreate={() => undefined}
        onStatusChange={() => undefined}
        onDelete={deletion.requestDelete}
        canDelete={deletion.canDelete}
      />
      {deletion.dialog}
    </>
  );
}
const withApp = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
};

describe("FR-420 delete a task", () => {
  it("offers deletion only to the project's owner and to leads (BR-203)", () => {
    install(vi.fn());
    for (const [id, role, shown] of [
      ["owner", "developer", true],
      ["lead-1", "lead", true],
      ["someone", "developer", false],
    ] as const) {
      as(id, role);
      const view = withApp(<Harness tasks={[task("t1", "Write docs")]} />);
      expect(screen.queryByRole("button", { name: "Delete Write docs" }) !== null, id).toBe(shown);
      view.unmount();
    }
  });
  it("asks first, then deletes, and can be cancelled", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    install(remove);
    as("owner", "developer");
    withApp(<Harness tasks={[task("t1", "Write docs")]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete Write docs" }));
    expect(
      await screen.findByText("“Write docs” will be removed. This cannot be undone."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete Write docs" }));
    await user.click(
      (await screen.findAllByRole("button", { name: "Delete task" })).at(-1) as HTMLElement,
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith("t1"));
    expect((await screen.findAllByText("Task deleted.")).length).toBeGreaterThan(0);
  });
  it("puts the task back and says so when the delete fails", async () => {
    const remove = vi.fn().mockRejectedValue(new ServiceError("FORBIDDEN", "x", 403));
    install(remove);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const list = [task("t1", "Write docs"), task("t2", "Other")];
    client.setQueryData(["tasks", "q"], { items: list, total: 2 });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const failed = vi.fn();
    const { result } = renderHook(() => useDeleteTask(failed), { wrapper });
    result.current.mutate("t1");
    await waitFor(() => expect(failed).toHaveBeenCalled());
    expect(client.getQueryData<{ items: Task[]; total: number }>(["tasks", "q"])).toEqual({
      items: list,
      total: 2,
    });
  });
  it("removes the task from the list at once, before the server answers", async () => {
    let finish: () => void = () => undefined;
    install(vi.fn(() => new Promise<void>((done) => (finish = done))));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["tasks", "q"], { items: [task("t1", "A"), task("t2", "B")], total: 2 });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        del: useDeleteTask(() => undefined),
        q: useQuery({
          queryKey: ["tasks", "q"],
          queryFn: () => new Promise(() => undefined),
          initialData: { items: [], total: 0 },
          staleTime: Infinity,
        }),
      }),
      { wrapper },
    );
    result.current.del.mutate("t1");
    await waitFor(() =>
      expect(client.getQueryData<{ items: Task[]; total: number }>(["tasks", "q"])).toEqual({
        items: [task("t2", "B")],
        total: 1,
      }),
    );
    finish();
  });
});
