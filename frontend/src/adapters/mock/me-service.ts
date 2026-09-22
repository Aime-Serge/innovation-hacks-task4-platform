// MF-06, MF-08, MF-12 to MF-17: the mock's /me surface, split out of services.ts to keep files
// under the house line-length rule. Behaves like the real API closely enough for unit tests and
// the demo: same status codes, same per-field 422 shape, same 403 on a wrong password.
import type { Project, Task } from "@/schemas";
import { ServiceError } from "@/services/types";
import type { MeService } from "@/services/types";
import { findById, getAccounts, saveAccounts, type Account } from "./accounts";
import { applyProfilePatch, computeCompleteness } from "./profile";
import {
  validateAbout,
  validateGivenOrFamilyName,
  validateHeadline,
  validateLinks,
  validatePasswordField,
  validateProfileDraft,
  validateSkills,
} from "./profile-validate";

const failFields = (details: { field: string; message: string }[]) =>
  new ServiceError("VALIDATION_ERROR", "One or more fields are invalid.", 422, undefined, details);

export type MeServiceDeps = {
  getActorId?: (() => string | undefined) | undefined;
  getProjects: () => Project[];
  getTasks: () => Task[];
  setTasks: (tasks: Task[]) => void;
  wait: () => Promise<void>;
  checkList: () => void;
};

export function createMeService(deps: MeServiceDeps): MeService {
  const unauthenticated = () =>
    new ServiceError("UNAUTHENTICATED", "The access token is missing, invalid or expired.", 401);

  /** The signed-in account, or throws 401 (every /me endpoint needs a session). */
  const meAccount = (): Account => {
    const id = deps.getActorId?.();
    const account = id === undefined ? undefined : findById(id);
    if (account === undefined) throw unauthenticated();
    return account;
  };

  const meStats = (userId: string) => ({
    projectsOwned: deps.getProjects().filter((p) => p.ownerId === userId).length,
    tasksDone: deps.getTasks().filter((t) => t.assigneeId === userId && t.status === "done").length,
    tasksOpen: deps.getTasks().filter((t) => t.assigneeId === userId && t.status !== "done").length,
  });

  const buildMe = (account: Account) => ({
    ...account.user,
    stats: meStats(account.user.id),
    completeness: computeCompleteness(account.user),
    privacy: { showProfessionalDetails: account.showProfessionalDetails },
    legacyProfile: account.legacyProfile,
  });

  const notFound = (what: string) => new ServiceError("not_found", `${what} was not found.`, 404);

  return {
    async get() {
      await deps.wait();
      deps.checkList();
      return buildMe(meAccount());
    },
    async updateProfile(patch) {
      await deps.wait();
      const account = meAccount();
      if (Object.keys(patch).length === 0) {
        throw new ServiceError("VALIDATION_ERROR", "Send at least one field to change.", 422);
      }
      const existing = account.user.profile;
      const errors = [
        patch.givenName !== undefined
          ? validateGivenOrFamilyName("givenName", patch.givenName)
          : null,
        patch.familyName !== undefined
          ? validateGivenOrFamilyName("familyName", patch.familyName)
          : null,
        ...validateProfileDraft(
          {
            discipline: patch.discipline,
            seniority: patch.seniority,
            employmentStatus: patch.employmentStatus ?? existing?.employmentStatus,
            companyName:
              patch.companyName !== undefined ? patch.companyName : existing?.companyName,
            jobTitle: patch.jobTitle !== undefined ? patch.jobTitle : existing?.jobTitle,
            country: patch.country,
            city: patch.city !== undefined ? patch.city : existing?.city,
            timeZone: patch.timeZone,
          },
          { required: false },
        ),
        patch.about !== undefined ? validateAbout(patch.about) : null,
        patch.headline !== undefined ? validateHeadline(patch.headline) : null,
        ...(patch.links !== undefined ? validateLinks(patch.links) : []),
      ].filter((e) => e !== null);
      if (errors.length > 0) throw failFields(errors);
      if (account.user.profile === null) throw notFound("Profile");
      account.user.profile = applyProfilePatch(account.user.profile, patch);
      if (patch.givenName !== undefined) account.user.givenName = patch.givenName;
      if (patch.familyName !== undefined) account.user.familyName = patch.familyName;
      if (patch.givenName !== undefined || patch.familyName !== undefined) {
        account.user.name = `${account.user.givenName} ${account.user.familyName}`;
      }
      saveAccounts();
      return buildMe(account);
    },
    async replaceSkills(skills) {
      await deps.wait();
      const account = meAccount();
      const error = validateSkills(skills);
      if (error !== null) throw failFields([error]);
      if (account.user.profile === null) throw notFound("Profile");
      account.user.profile = { ...account.user.profile, skills };
      saveAccounts();
      return buildMe(account);
    },
    async updatePreferences(input) {
      await deps.wait();
      const account = meAccount();
      if (input.timeZone.trim() === "" || input.timeZone.length > 64) {
        throw failFields([{ field: "timeZone", message: "Choose a time zone." }]);
      }
      account.user.preferences = { theme: input.theme };
      if (account.user.profile !== null) {
        account.user.profile = { ...account.user.profile, timeZone: input.timeZone };
      }
      saveAccounts();
      return buildMe(account);
    },
    async updatePrivacy(showProfessionalDetails) {
      await deps.wait();
      const account = meAccount();
      account.showProfessionalDetails = showProfessionalDetails;
      saveAccounts();
      return buildMe(account);
    },
    async changePassword(input) {
      await deps.wait();
      const account = meAccount();
      if (account.password !== input.currentPassword) {
        throw new ServiceError("INVALID_CREDENTIALS", "The current password is incorrect.", 403);
      }
      const error = validatePasswordField(
        input.newPassword,
        account.user.email ?? "",
        account.user.givenName ?? "",
        account.user.familyName ?? "",
      );
      if (error !== null) throw failFields([error]);
      if (input.newPassword === input.currentPassword) {
        throw failFields([
          { field: "newPassword", message: "Choose a password different from the current one." },
        ]);
      }
      account.password = input.newPassword;
      saveAccounts();
    },
    async signOutAllDevices() {
      await deps.wait();
      meAccount();
    },
    async deleteAccount(password) {
      await deps.wait();
      const account = meAccount();
      if (account.password !== password) {
        throw new ServiceError("INVALID_CREDENTIALS", "The password is incorrect.", 403);
      }
      if (meStats(account.user.id).projectsOwned > 0) {
        throw new ServiceError(
          "USER_OWNS_PROJECTS",
          "You still own projects. Delete them or hand them to someone else first.",
          409,
        );
      }
      deps.setTasks(
        deps
          .getTasks()
          .map((t) => (t.assigneeId === account.user.id ? { ...t, assigneeId: null } : t)),
      );
      const accounts = getAccounts();
      const index = accounts.findIndex((a) => a.user.id === account.user.id);
      if (index !== -1) accounts.splice(index, 1);
      saveAccounts();
    },
  };
}
