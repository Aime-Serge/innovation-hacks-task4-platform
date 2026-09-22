// MF-11, MB-02, BR-403: the mock's users list/search/get, split out of services.ts to keep
// files under the house line-length rule.
import { User } from "@/schemas";
import { array } from "zod/mini";
import { ServiceError } from "@/services/types";
import type { UserService } from "@/services/types";
import { findById, getAccounts, saveAccounts } from "./accounts";

export type UserServiceDeps = {
  getActorId?: (() => string | undefined) | undefined;
  getFixtureUsers: () => User[];
  getPrivacy: () => Record<string, boolean>;
  wait: (signal?: AbortSignal) => Promise<void>;
  checkList: () => void;
};

export function createUserService(deps: UserServiceDeps): UserService {
  const notFound = (what: string) => new ServiceError("not_found", `${what} was not found.`, 404);

  /** Fixture users overlaid with registered accounts (which win on id). */
  const allUsers = (): User[] => {
    const accounts = getAccounts().map((a) => a.user);
    const ids = new Set(accounts.map((u) => u.id));
    return [...deps.getFixtureUsers().filter((u) => !ids.has(u.id)), ...accounts];
  };

  // MB-02: another member's professional details show only when their switch is on; the switch
  // itself lives on the account for a signed-in-capable user, or in the session's privacy map
  // for a fixture-only "teammate" that nobody can log in as.
  const showsProfessionalDetails = (id: string): boolean => {
    const account = findById(id);
    return account !== undefined
      ? account.showProfessionalDetails
      : (deps.getPrivacy()[id] ?? true);
  };

  const actorUser = (): User | undefined => {
    const id = deps.getActorId?.();
    return id === undefined ? undefined : allUsers().find((u) => u.id === id);
  };

  // BR-403 / MB-02: email only to the person themself and to leads; profile only when allowed.
  const visibleUser = (user: User, actor: User | undefined): User => {
    const isSelf = actor !== undefined && actor.id === user.id;
    const isLead = actor?.role === "lead";
    return {
      ...user,
      email: isSelf || isLead ? user.email : null,
      profile: isSelf || showsProfessionalDetails(user.id) ? user.profile : null,
    };
  };

  return {
    async list(signal) {
      await deps.wait(signal);
      deps.checkList();
      const actor = actorUser();
      return array(User).parse(allUsers().map((u) => visibleUser(u, actor)));
    },
    // MF-11: the picker; the caller enforces the two-character minimum, this is defence in depth.
    async search(query, signal) {
      await deps.wait(signal);
      deps.checkList();
      const needle = query.trim().toLowerCase();
      if (needle.length < 2) return [];
      const actor = actorUser();
      return allUsers()
        .filter((u) => u.name.toLowerCase().includes(needle))
        .slice(0, 20)
        .map((u) => visibleUser(u, actor));
    },
    async get(id, signal) {
      await deps.wait(signal);
      deps.checkList();
      const found = allUsers().find((u) => u.id === id);
      return found === undefined ? null : User.parse(visibleUser(found, actorUser()));
    },
    async update(id, patch) {
      await deps.wait();
      const account = findById(id);
      const target = account?.user ?? deps.getFixtureUsers().find((u) => u.id === id);
      if (target === undefined) throw notFound("That user");
      if (patch.name !== undefined) target.name = patch.name;
      if (patch.theme !== undefined) target.preferences = { theme: patch.theme };
      if (account !== undefined) saveAccounts();
      return User.parse(target);
    },
  };
}
