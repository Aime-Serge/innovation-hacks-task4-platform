import type { components } from "./api";
import type { Activity, Project, Task, User } from "./schemas";

type S = components["schemas"];

// Each line assigns what the API returns to what the Task 1 dashboard expects.
// A compile error is a real mismatch the adapter must handle.
declare const apiTask: S["TaskOut"];
declare const apiProject: S["ProjectOut"];
declare const apiUser: S["UserOut"];
declare const apiActivity: S["ActivityOut"];

export const task: Task = apiTask;
export const project: Project = apiProject;
export const user: User = apiUser;
export const activity: Activity = apiActivity;
