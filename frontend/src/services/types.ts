import type {
  Activity,
  NewProject,
  NewTask,
  Page,
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

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
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
  get(id: string, signal?: AbortSignal): Promise<User | null>;
  update(id: string, patch: UserPatch): Promise<User>;
}

export interface ActivityService {
  /** Newest first. */
  list(limit: number, signal?: AbortSignal): Promise<Activity[]>;
}

export interface Services {
  projects: ProjectService;
  tasks: TaskService;
  users: UserService;
  activity: ActivityService;
}
