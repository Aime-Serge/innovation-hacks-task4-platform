import type { components } from "@/generated/api-types";

// The AI features (section 7). They only suggest: nothing is created or changed until the person
// confirms, and confirmed changes go through the ordinary task services (FR-432).

export type AiStatus = components["schemas"]["AiStatusOut"];
export type TaskSuggestion = components["schemas"]["SuggestionOut"];
export type TaskSuggestions = components["schemas"]["SuggestionsOut"];
export type PriorityRanking = components["schemas"]["PrioritizationOut"];
export type ProjectSummary = components["schemas"]["AiSummaryOut"];

export interface AiService {
  status(signal?: AbortSignal): Promise<AiStatus>;
  suggestTasks(
    projectId: string,
    input: { brief?: string; count?: number },
    signal?: AbortSignal,
  ): Promise<TaskSuggestions>;
  prioritize(projectId: string, signal?: AbortSignal): Promise<PriorityRanking>;
  summarize(projectId: string, signal?: AbortSignal): Promise<ProjectSummary>;
}
