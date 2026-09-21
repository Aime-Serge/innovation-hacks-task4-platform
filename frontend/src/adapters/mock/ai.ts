import type { AiService } from "@/services/ai";

// A deterministic stand-in for tests and the mock scenarios: the same answers every time.
const META = {
  model: "mock-model",
  promptVersion: "mock-v1",
  requestId: "00000000-0000-4000-8000-000000000000",
};

export function createMockAi(): AiService {
  return {
    status: () =>
      Promise.resolve({
        enabled: true,
        features: ["task_generation", "prioritization", "project_summary"],
        quota: { dailyLimit: 20, remainingToday: 20, resetsAt: "2026-01-02T00:00:00Z" },
      }),
    suggestTasks: () =>
      Promise.resolve({
        suggestions: [
          {
            title: "Define the scope and goals",
            description: "Write down what is in scope.",
            priority: "high",
            dueInDays: 3,
          },
          {
            title: "Review progress with the team",
            description: "",
            priority: "low",
            dueInDays: null,
          },
        ],
        meta: META,
      }),
    prioritize: () => Promise.resolve({ items: [], meta: META }),
    summarize: () =>
      Promise.resolve({ summary: "The project is moving.", risks: [], nextSteps: [], meta: META }),
  };
}
