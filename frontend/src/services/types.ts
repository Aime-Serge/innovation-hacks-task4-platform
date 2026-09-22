import type { AiService } from "./ai";
import type {
  Activity,
  ErrorDetail,
  Me,
  NewProject,
  NewTask,
  Page,
  ProfilePatch,
  Project,
  ProjectQuery,
  Task,
  TaskQuery,
  TaskStatus,
  Theme,
  User,
} from "@/schemas";

/** Failure raised by any service. `code` and `status` match the API envelope. */
export class ServiceError extends Error {
  readonly code: string;
  readonly status: number;
  /** Seconds to wait, from a 429's Retry-After header. */
  readonly retryAfter: number | undefined;
  /** Per-field messages from a 422 (MF-02, MF-08): `[{ field, message }]`. */
  readonly details: ErrorDetail[] | undefined;

  constructor(
    code: string,
    message: string,
    status: number,
    retryAfter?: number,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.retryAfter = retryAfter;
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** The message for one field, if the server named it. */
  fieldMessage(field: string): string | undefined {
    return this.details?.find((d) => d.field === field)?.message;
  }
}

export interface ProjectService {
  list(query: ProjectQuery, signal?: AbortSignal): Promise<Page<Project>>;
  /** Resolves to null when the id is unknown (drives the not-found state). */
  get(id: string, signal?: AbortSignal): Promise<Project | null>;
  create(input: NewProject): Promise<Project>;
  update(id: string, patch: Partial<NewProject>): Promise<Project>;
  remove(id: string): Promise<void>;
}

export interface TaskService {
  list(query: TaskQuery, signal?: AbortSignal): Promise<Page<Task>>;
  updateStatus(id: string, status: TaskStatus): Promise<Task>;
  create(input: NewTask): Promise<Task>;
  update(id: string, patch: Partial<NewTask>): Promise<Task>;
  remove(id: string): Promise<void>;
}

export type UserPatch = { name?: string; theme?: Theme };

export interface UserService {
  list(signal?: AbortSignal): Promise<User[]>;
  /** MF-11: the people picker's search, at most 20 results (GET /users?q=). */
  search(query: string, signal?: AbortSignal): Promise<User[]>;
  get(id: string, signal?: AbortSignal): Promise<User | null>;
  update(id: string, patch: UserPatch): Promise<User>;
}

export interface ActivityService {
  /** Newest first. */
  list(limit: number, signal?: AbortSignal): Promise<Activity[]>;
}

export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
  refreshToken?: string | null;
};

/** The signed-in person's own view and its writes (MF-06, MF-08, MF-12 to MF-17). */
export interface MeService {
  get(signal?: AbortSignal): Promise<Me>;
  updateProfile(patch: ProfilePatch): Promise<Me>;
  replaceSkills(skills: string[]): Promise<Me>;
  updatePreferences(input: { theme: Theme; timeZone: string }): Promise<Me>;
  updatePrivacy(showProfessionalDetails: boolean): Promise<Me>;
  /** 204; ends every other session (or every session when `refreshToken` is omitted). */
  changePassword(input: PasswordChangeInput): Promise<void>;
  /** 204; DELETE /me/sessions, revokes every session including the caller's. */
  signOutAllDevices(): Promise<void>;
  /** 204; 409 USER_OWNS_PROJECTS while the person still owns a project. */
  deleteAccount(password: string): Promise<void>;
}

export interface Services {
  projects: ProjectService;
  tasks: TaskService;
  users: UserService;
  activity: ActivityService;
  ai: AiService;
  me: MeService;
}
