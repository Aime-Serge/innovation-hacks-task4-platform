import type {
  Activity,
  Priority,
  Project,
  ProjectStatus,
  Scenario,
  Task,
  TaskStatus,
  User,
} from "@/schemas";
import { addDays, todayIso } from "@/lib/dates";
import { createRandom, pick } from "./random";

export type Fixtures = {
  users: User[];
  projects: Project[];
  tasks: Task[];
  activity: Activity[];
};

const USERS: User[] = [
  {
    id: "user-1",
    name: "Aime Serge UKOBIZABA",
    email: "aime.serge@example.com",
    role: "developer",
    preferences: { theme: "dark" },
  },
  {
    id: "user-2",
    name: "Amara Diallo",
    email: "amara.diallo@example.com",
    role: "lead",
    preferences: { theme: "dark" },
  },
  {
    id: "user-3",
    name: "Kwame Mensah",
    email: "kwame.mensah@example.com",
    role: "developer",
    preferences: { theme: "dark" },
  },
  {
    id: "user-4",
    name: "Sofia Alvarez",
    email: "sofia.alvarez@example.com",
    role: "developer",
    preferences: { theme: "dark" },
  },
];

const PROJECTS: { name: string; description: string; status: ProjectStatus; due: number }[] = [
  {
    name: "Atlas API Gateway",
    description: "Rate-limited gateway routing traffic to internal services.",
    status: "active",
    due: 21,
  },
  {
    name: "Beacon Notifications",
    description: "Push, email and SMS delivery pipeline with retries.",
    status: "active",
    due: 35,
  },
  {
    name: "Cairn Design System",
    description: "Shared component library used across product surfaces.",
    status: "active",
    due: 14,
  },
  {
    name: "Delta Data Pipeline",
    description: "Nightly ingestion and reporting jobs for analytics.",
    status: "active",
    due: 49,
  },
  {
    name: "Ember Mobile App",
    description: "Companion app for on-call engineers.",
    status: "planned",
    due: 90,
  },
  {
    name: "Flint Auth Service",
    description: "Single sign-on and session management. Paused pending review.",
    status: "on_hold",
    due: 60,
  },
  {
    name: "Grove Analytics",
    description: "Usage dashboards. Scoped, but no tasks have been created yet.",
    status: "active",
    due: 70,
  },
  {
    name: "Harbor Billing",
    description: "Invoice generation and payment reconciliation.",
    status: "completed",
    due: -10,
  },
];

const VERBS = [
  "Add",
  "Review",
  "Fix",
  "Document",
  "Refactor",
  "Test",
  "Migrate",
  "Profile",
  "Automate",
];
const NOUNS = [
  "rate limit config",
  "error codes",
  "retry queue",
  "webhook receipts",
  "token tests",
  "build cache",
  "release notes",
  "load balancer",
  "audit log",
  "email templates",
];
// Due-date offsets from today: overdue, due today, this week and beyond.
const OFFSETS = [-9, -4, -1, 0, 1, 2, 3, 5, 6, 9, 12, -2, 7, 15];
const STATUSES: TaskStatus[] = [
  "done",
  "todo",
  "in_progress",
  "in_review",
  "todo",
  "in_progress",
  "done",
  "in_review",
];
const PRIORITIES: Priority[] = ["medium", "high", "low", "urgent", "medium", "low", "high"];

function buildTasks(projects: Project[], scenario: Scenario, today: string): Task[] {
  const rand = createRandom(7);
  const tasks: Task[] = [];
  const perProject = scenario === "large" ? Math.ceil(500 / projects.length) : 9;
  let n = 0;
  for (const project of projects) {
    const isHarbor = project.name === "Harbor Billing";
    const count = isHarbor ? 6 : perProject;
    if (project.name === "Grove Analytics" && scenario !== "large") continue;
    for (let i = 0; i < count && tasks.length < (scenario === "large" ? 500 : 60); i += 1) {
      const offset = OFFSETS[(n + i) % OFFSETS.length];
      const noDate = (n + i) % 17 === 16;
      tasks.push({
        id: `task-${n + 1}`,
        projectId: project.id,
        title: `${pick(rand, VERBS)} ${pick(rand, NOUNS)} (${project.name.split(" ")[0]} ${i + 1})`,
        description: `Part of ${project.name}.`,
        status: isHarbor ? "done" : (STATUSES[(n + i) % STATUSES.length] ?? "todo"),
        priority: PRIORITIES[(n + i) % PRIORITIES.length] ?? "medium",
        dueDate: noDate || offset === undefined ? null : addDays(today, offset),
        assigneeId: (n + i) % 5 === 4 ? null : (USERS[(n + i) % USERS.length]?.id ?? null),
      });
      n += 1;
    }
  }
  return tasks;
}

function buildActivity(projects: Project[], tasks: Task[], now: Date): Activity[] {
  const rand = createRandom(11);
  const items: Activity[] = [];
  const source = tasks.length > 0 ? tasks : [];
  for (let i = 0; i < 40 && source.length > 0; i += 1) {
    const task = source[(i * 7) % source.length];
    if (task === undefined) break;
    const type =
      task.status === "done" && i % 3 === 0
        ? "completed"
        : i % 3 === 1
          ? "status_changed"
          : "created";
    items.push({
      id: `activity-${i + 1}`,
      actorId: pick(rand, USERS).id,
      projectId: task.projectId,
      taskId: task.id,
      type,
      at: new Date(now.getTime() - (i + 1) * 47 * 60_000).toISOString(),
    });
  }
  return projects.length === 0 ? [] : items;
}

function makeProjects(scenario: Scenario, today: string): Project[] {
  const base: Project[] = PROJECTS.map((p, i) => ({
    id: `project-${i + 1}`,
    name: p.name,
    description: p.description,
    status: p.status,
    dueDate: addDays(today, p.due),
    ownerId: USERS[i % USERS.length]?.id ?? "user-1",
  }));
  if (scenario !== "large") return base;
  const extra: Project[] = Array.from({ length: 32 }, (_, i) => ({
    id: `project-${i + 9}`,
    name: `Service ${i + 9} Platform`,
    description: "Generated project for the large scenario.",
    status: (["active", "planned", "on_hold", "completed"] as const)[i % 4] ?? "active",
    dueDate: addDays(today, (i % 40) - 5),
    ownerId: USERS[i % USERS.length]?.id ?? "user-1",
  }));
  return [...base, ...extra];
}

const LONG_WORD = "Supercalifragilisticexpialidocious".repeat(2);
const EDGE_NAMES = [
  "Extraordinarily long project name that keeps going ".repeat(2).slice(0, 80),
  LONG_WORD.slice(0, 80),
  "Launch 🚀 planning 🎉 sprint ✨ retro",
  "مشروع لوحة التحكم للمطورين",
  "פרויקט לוח בקרה למפתחים",
];

function applyEdgeText(fixtures: Fixtures): Fixtures {
  const projects = fixtures.projects.map((p, i) => ({
    ...p,
    name: EDGE_NAMES[i % EDGE_NAMES.length] ?? p.name,
  }));
  const tasks = fixtures.tasks.map((t, i) => ({
    ...t,
    title:
      i % 3 === 0
        ? `${LONG_WORD}${LONG_WORD}${LONG_WORD}`.slice(0, 120)
        : i % 3 === 1
          ? `Fix the 🐛 in the checkout flow ${"very ".repeat(18)}`.slice(0, 120).trimEnd()
          : "إصلاح خطأ في صفحة تسجيل الدخول",
  }));
  return { ...fixtures, projects, tasks };
}

/** Builds the dataset for a scenario. Dates are relative to `now`. */
export function buildFixtures(scenario: Scenario, now: Date = new Date()): Fixtures {
  if (scenario === "empty")
    return { users: USERS.map((u) => ({ ...u })), projects: [], tasks: [], activity: [] };
  const today = todayIso(now);
  const projects = makeProjects(scenario, today);
  const tasks = buildTasks(projects, scenario, today);
  const base: Fixtures = {
    users: USERS.map((u) => ({ ...u })),
    projects,
    tasks,
    activity: buildActivity(projects, tasks, now),
  };
  return scenario === "edge-text" ? applyEdgeText(base) : base;
}
