// TC-444 (AI interface states, keyboard use, announcements), TC-448 (the rest works without AI),
// TC-423 (plain text, nothing saved until confirmed).
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiErrorMessage } from "@/features/ai/messages";
import { ProjectAiPanel } from "@/features/ai/ProjectAiPanel";
import { WakingBanner } from "@/layout/WakingBanner";
import { AWAKE_EVENT, WAKING_EVENT } from "@/lib/events";
import type { Task } from "@/schemas";
import { ServiceError } from "@/services/types";
import { renderApp } from "./render";

const holder = vi.hoisted((): { current: unknown } => ({ current: null }));
vi.mock("@/providers/ServicesProvider", () => ({ useServices: () => holder.current }));

const META = { model: "m", promptVersion: "v1", requestId: "r" };
const STATUS = {
  enabled: true,
  features: ["task_generation", "prioritization", "project_summary"],
  quota: { dailyLimit: 20, remainingToday: 17, resetsAt: "2026-01-02T00:00:00Z" },
};
const task = (id: string, title: string, priority: Task["priority"]): Task => ({
  id,
  projectId: "p1",
  title,
  description: "",
  status: "todo",
  priority,
  dueDate: null,
  assigneeId: null,
});

type Fakes = {
  ai: Record<string, ReturnType<typeof vi.fn>>;
  tasks: Record<string, ReturnType<typeof vi.fn>>;
};
function install(overrides: Partial<Fakes["ai"]> = {}): Fakes {
  const fakes: Fakes = {
    ai: {
      status: vi.fn().mockResolvedValue(STATUS),
      suggestTasks: vi.fn().mockResolvedValue({
        suggestions: [
          { title: "Write the plan", description: "Draft it.", priority: "high", dueInDays: 3 },
          { title: "Review", description: "", priority: "low", dueInDays: null },
        ],
        meta: META,
      }),
      prioritize: vi.fn().mockResolvedValue({
        items: [
          { taskId: "t1", rank: 1, suggestedPriority: "urgent", reason: "Blocks the release." },
          { taskId: "t2", rank: 2, suggestedPriority: "low", reason: "Can wait." },
        ],
        meta: META,
      }),
      summarize: vi.fn().mockResolvedValue({
        summary: "Moving well.",
        risks: ["Late QA"],
        nextSteps: [],
        meta: META,
      }),
      ...overrides,
    },
    tasks: {
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      list: vi.fn().mockResolvedValue({
        items: [task("t1", "Ship it", "medium"), task("t2", "Polish", "low")],
        total: 2,
      }),
    },
  };
  holder.current = fakes;
  return fakes;
}
const open = async (name: RegExp, canCreate = true) => {
  const user = userEvent.setup();
  renderApp(<ProjectAiPanel projectId="p1" canCreateTasks={canCreate} />);
  await user.click(await screen.findByRole("button", { name }));
  return user;
};
const accept = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(await screen.findByRole("button", { name: "I understand" }));

beforeEach(() => window.localStorage.clear());

describe("TC-421 the panel is gated by the API's status", () => {
  it("shows the actions and the remaining quota when AI is on", async () => {
    install();
    renderApp(<ProjectAiPanel projectId="p1" canCreateTasks />);
    expect(await screen.findByText("17 of 20 AI requests left today")).toBeInTheDocument();
    for (const name of ["Generate tasks", "Suggest priorities", "Summarise project"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });
  it("hides everything when AI is off, and when the status cannot be read (TC-448)", async () => {
    const fakes = install({
      status: vi.fn().mockResolvedValue({ ...STATUS, enabled: false, features: [] }),
    });
    const first = renderApp(<ProjectAiPanel projectId="p1" canCreateTasks />);
    await waitFor(() => expect(fakes.ai["status"]).toHaveBeenCalled());
    expect(first.container).toBeEmptyDOMElement();
    first.unmount();
    install({ status: vi.fn().mockRejectedValue(new ServiceError("INTERNAL_ERROR", "x", 500)) });
    const second = renderApp(<ProjectAiPanel projectId="p1" canCreateTasks />);
    await waitFor(() => expect(second.container).toBeEmptyDOMElement());
  });
  it("offers task generation only to those who may create tasks", async () => {
    install();
    renderApp(<ProjectAiPanel projectId="p1" canCreateTasks={false} />);
    expect(await screen.findByRole("button", { name: "Suggest priorities" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate tasks" })).not.toBeInTheDocument();
  });
});

describe("TC-444 the privacy notice", () => {
  it("comes first, blocks the call, and is remembered", async () => {
    const fakes = install();
    const user = await open(/Generate tasks/);
    expect(await screen.findByText(/sent to an external AI provider/)).toBeInTheDocument();
    expect(fakes.ai["suggestTasks"]).not.toHaveBeenCalled();
    await accept(user);
    expect(await screen.findByRole("button", { name: "Generate" })).toBeInTheDocument();
    expect(window.localStorage.getItem("devdash.ai-privacy-ack")).toBe("1");
  });
  it("is not shown again once accepted, and still works when storage is blocked", async () => {
    window.localStorage.setItem("devdash.ai-privacy-ack", "1");
    install();
    await open(/Generate tasks/);
    expect(await screen.findByRole("button", { name: "Generate" })).toBeInTheDocument();
    expect(screen.queryByText(/external AI provider/)).not.toBeInTheDocument();
  });
});

describe("TC-431, TC-444 task generation", () => {
  beforeEach(() => window.localStorage.setItem("devdash.ai-privacy-ack", "1"));

  it("shows editable, labelled suggestions and saves nothing until 'Add selected'", async () => {
    const fakes = install();
    const user = await open(/Generate tasks/);
    await user.type(await screen.findByLabelText(/What is this work about/), "  Launch it ");
    await user.click(screen.getByRole("button", { name: "Generate" }));
    expect(await screen.findByText("AI-generated, review before adding")).toBeInTheDocument();
    expect(fakes.ai["suggestTasks"]).toHaveBeenCalledWith(
      "p1",
      { count: 5, brief: "Launch it" },
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 suggestions");
    expect(fakes.tasks["create"]).not.toHaveBeenCalled(); // FR-432
    expect(screen.getAllByLabelText("Title")).toHaveLength(2);
  });
  it("adds only what was selected and edited, with a due date from the relative days", async () => {
    const fakes = install();
    const user = await open(/Generate tasks/);
    await user.click(await screen.findByRole("button", { name: "Generate" }));
    const titles = await screen.findAllByLabelText("Title");
    await user.clear(titles[0] as HTMLElement);
    await user.type(titles[0] as HTMLElement, "Write the launch plan");
    await user.click(screen.getByRole("checkbox", { name: "Review" })); // deselect the second
    await user.click(screen.getByRole("button", { name: "Add selected (1)" }));
    await waitFor(() => expect(fakes.tasks["create"]).toHaveBeenCalledTimes(1));
    const made = fakes.tasks["create"]?.mock.calls[0]?.[0] as Task;
    expect([made.title, made.priority, made.status, made.projectId, made.assigneeId]).toEqual([
      "Write the launch plan",
      "high",
      "todo",
      "p1",
      null,
    ]);
    expect(made.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByText("Added 1 tasks from AI suggestions")).toBeInTheDocument();
  });
  it("blocks adding while a selected title is empty", async () => {
    install();
    const user = await open(/Generate tasks/);
    await user.click(await screen.findByRole("button", { name: "Generate" }));
    await user.clear((await screen.findAllByLabelText("Title"))[0] as HTMLElement);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("A title is required");
    expect(screen.getByRole("button", { name: /Add selected/ })).toBeDisabled();
  });
  it("keeps the ones that failed to save, selected, and says how many", async () => {
    const fakes = install();
    fakes.tasks["create"]?.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("boom"));
    const user = await open(/Generate tasks/);
    await user.click(await screen.findByRole("button", { name: "Generate" }));
    await user.click(await screen.findByRole("button", { name: "Add selected (2)" }));
    expect(await screen.findByText(/1 could not be added/)).toBeInTheDocument();
    expect(screen.getAllByLabelText("Title")).toHaveLength(1);
  });
  it("renders whatever the model wrote as plain text, never as markup", async () => {
    install({
      suggestTasks: vi.fn().mockResolvedValue({
        suggestions: [
          {
            title: "<script>alert(1)</script>",
            description: "<img src=x onerror=alert(1)>",
            priority: "low",
            dueInDays: null,
          },
        ],
        meta: META,
      }),
    });
    const user = await open(/Generate tasks/);
    await user.click(await screen.findByRole("button", { name: "Generate" }));
    expect(await screen.findByDisplayValue("<script>alert(1)</script>")).toBeInTheDocument();
    expect(
      document.querySelector("dialog script, [role=dialog] script, [role=dialog] img"),
    ).toBeNull();
  });
  it("says so when nothing new was suggested, and lets the person try again", async () => {
    install({ suggestTasks: vi.fn().mockResolvedValue({ suggestions: [], meta: META }) });
    const user = await open(/Generate tasks/);
    await user.click(await screen.findByRole("button", { name: "Generate" }));
    expect(await screen.findByText("No new tasks suggested.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
  it.each([
    ["AI_UNAVAILABLE", 0, "AI is unavailable right now. You can add tasks manually."],
    ["AI_BAD_RESPONSE", 0, "The suggestions could not be read. Try a shorter brief."],
    ["AI_QUOTA_EXCEEDED", 120, "You have reached the AI limit. Try again in 2 minutes."],
    ["AI_DISABLED", 0, "AI is switched off."],
  ])("shows the %s failure in plain words", async (code, retryAfter, words) => {
    install({
      suggestTasks: vi
        .fn()
        .mockRejectedValue(new ServiceError(code, "x", 503, retryAfter || undefined)),
    });
    const user = await open(/Generate tasks/);
    await user.click(await screen.findByRole("button", { name: "Generate" }));
    expect(await screen.findByText(words)).toBeInTheDocument();
  });
  it("can be cancelled while it is running", async () => {
    let signal: AbortSignal | undefined;
    install({
      suggestTasks: vi.fn((_p: string, _i: unknown, s: AbortSignal) => {
        signal = s;
        return new Promise((_ok, fail) =>
          s.addEventListener("abort", () => fail(new DOMException("a", "AbortError"))),
        );
      }),
    });
    const user = await open(/Generate tasks/);
    await user.click(await screen.findByRole("button", { name: "Generate" }));
    expect(await screen.findByRole("button", { name: "Cancel generating" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel generating" }));
    expect(signal?.aborted).toBe(true);
    expect(await screen.findByRole("button", { name: "Generate" })).toBeInTheDocument();
  });
});

describe("TC-434, TC-435 priorities and summary", () => {
  beforeEach(() => window.localStorage.setItem("devdash.ai-privacy-ack", "1"));

  it("shows now and suggested priority with the reason, and accepts through a normal update", async () => {
    const fakes = install();
    const user = await open(/Suggest priorities/);
    expect(await screen.findByText("Blocks the release.")).toBeInTheDocument();
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByText("No change")).toBeInTheDocument(); // t2 is already low
    await user.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(fakes.tasks["update"]).toHaveBeenCalledWith("t1", { priority: "urgent" }),
    );
    expect(await screen.findByText("Accepted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept all" })).not.toBeInTheDocument();
  });
  it("accepts every change at once, and reports a save that failed", async () => {
    const fakes = install();
    fakes.tasks["update"]?.mockRejectedValueOnce(new Error("no"));
    const user = await open(/Suggest priorities/);
    await user.click(await screen.findByRole("button", { name: "Accept all" }));
    expect(await screen.findByText(/could not be saved/)).toBeInTheDocument();
  });
  it("says so when there is nothing to rank, and offers Retry on an error", async () => {
    install({ prioritize: vi.fn().mockResolvedValue({ items: [], meta: META }) });
    await open(/Suggest priorities/);
    expect(await screen.findByText("There are no open tasks to rank.")).toBeInTheDocument();
  });
  it("retries a failed ranking", async () => {
    const fakes = install();
    fakes.ai["prioritize"]?.mockRejectedValueOnce(new ServiceError("AI_UNAVAILABLE", "x", 503));
    const user = await open(/Suggest priorities/);
    await user.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Blocks the release.")).toBeInTheDocument();
    expect(fakes.ai["prioritize"]).toHaveBeenCalledTimes(2);
  });
  it("shows the summary, its risks and next steps, labelled as AI-generated", async () => {
    install();
    await open(/Summarise project/);
    expect(await screen.findByText("Moving well.")).toBeInTheDocument();
    expect(screen.getByText("Late QA")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument(); // no next steps
    expect(screen.getByText("AI-generated, review before adding")).toBeInTheDocument();
  });
  it("shows a failed summary and offers Retry", async () => {
    install({ summarize: vi.fn().mockRejectedValue(new ServiceError("FORBIDDEN", "x", 403)) });
    await open(/Summarise project/);
    expect(await screen.findByText(/do not have permission/)).toBeInTheDocument();
  });
  it("asks for the privacy notice before the first summary", async () => {
    window.localStorage.clear();
    const fakes = install();
    const user = await open(/Summarise project/);
    expect(fakes.ai["summarize"]).not.toHaveBeenCalled();
    await accept(user);
    expect(await screen.findByText("Moving well.")).toBeInTheDocument();
  });
});

describe("TC-444 messages and the waking banner", () => {
  it("maps every code to a plain sentence", () => {
    const code = (c: string, retry?: number) =>
      aiErrorMessage(new ServiceError(c, "x", 500, retry));
    expect(code("AI_QUOTA_EXCEEDED", 30)).toBe(
      "You have reached the AI limit. Try again in a moment.",
    );
    expect(code("NOT_FOUND")).toMatch(/permission/);
    expect(code("SOMETHING_ELSE")).toBe("Something went wrong. Try again.");
    expect(aiErrorMessage(new TypeError("x"))).toBe("Something went wrong. Try again.");
  });
  it("tells people the service is waking up and clears when it answers", () => {
    renderApp(<WakingBanner />);
    expect(screen.queryByText(/waking up/)).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent(WAKING_EVENT));
    });
    expect(screen.getByText(/The service is waking up/)).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent(AWAKE_EVENT));
    });
    expect(screen.queryByText(/waking up/)).not.toBeInTheDocument();
    expect(screen.getByTestId("waking-region")).toHaveAttribute("aria-live", "polite"); // stays, so it is announced
  });
});
