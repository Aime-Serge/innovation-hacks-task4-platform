// MF-08, MF-13, MF-16, MF-17: direct coverage of the mock's /me surface (TC-100 style), the way
// tests/contract/adapter.test.ts covers the other services.
import { beforeEach, describe, expect, it } from "vitest";
import { createMockServices } from "@/adapters/mock";
import { resetAccountsCache } from "@/adapters/mock/accounts";

// Accounts persist in localStorage across `createMockServices` calls (mirrors a real account
// store); each test starts from the seeded account so password/skill/task changes do not leak.
beforeEach(() => {
  window.localStorage.clear();
  resetAccountsCache();
});

const NOW = new Date("2030-01-10T12:00:00Z");
const fresh = () =>
  createMockServices({
    scenario: "default",
    latency: { min: 0, max: 0 },
    now: NOW,
    getActorId: () => "user-1",
  }).services;

describe("MF-06 me.get", () => {
  it("401s without a signed-in actor", async () => {
    const { me } = createMockServices({
      scenario: "default",
      latency: { min: 0, max: 0 },
      now: NOW,
    }).services;
    await expect(me.get()).rejects.toMatchObject({ status: 401 });
  });

  it("returns the owner's stats, completeness and privacy", async () => {
    const { me } = fresh();
    const mine = await me.get();
    expect(mine.privacy.showProfessionalDetails).toBe(true);
    expect(mine.completeness.percent).toBeGreaterThan(0);
    expect(mine.legacyProfile).toBe(false);
  });
});

describe("MF-08 me.updateProfile", () => {
  it("rejects an empty patch, and a company missing while employed", async () => {
    const { me } = fresh();
    await expect(me.updateProfile({})).rejects.toMatchObject({ status: 422 });
    await expect(me.updateProfile({ companyName: null })).rejects.toMatchObject({ status: 422 });
  });

  it("clears the headline and recomposes the display headline", async () => {
    const { me } = fresh();
    const updated = await me.updateProfile({ headline: null });
    expect(updated.profile?.headline).toBeNull();
    expect(updated.profile?.displayHeadline).toContain("Backend");
  });
});

describe("MF-08 me.replaceSkills (MB-05)", () => {
  it("rejects more than 10 skills", async () => {
    const { me } = fresh();
    const many = Array.from({ length: 11 }, (_, i) => `skill-${i}`);
    await expect(me.replaceSkills(many)).rejects.toMatchObject({ status: 422 });
  });

  it("replaces the list", async () => {
    const { me } = fresh();
    const updated = await me.replaceSkills(["Go"]);
    expect(updated.profile?.skills).toEqual(["Go"]);
  });
});

describe("MF-15 me.updatePreferences", () => {
  it("rejects a blank time zone", async () => {
    const { me } = fresh();
    await expect(me.updatePreferences({ theme: "dark", timeZone: "" })).rejects.toMatchObject({
      status: 422,
    });
  });

  it("saves the theme and time zone", async () => {
    const { me } = fresh();
    const updated = await me.updatePreferences({ theme: "light", timeZone: "Europe/Paris" });
    expect(updated.preferences.theme).toBe("light");
    expect(updated.profile?.timeZone).toBe("Europe/Paris");
  });
});

describe("MF-13 me.changePassword", () => {
  it("403s on a wrong current password", async () => {
    const { me } = fresh();
    await expect(
      me.changePassword({ currentPassword: "nope", newPassword: "a-fresh-password-1" }),
    ).rejects.toMatchObject({ status: 403, code: "INVALID_CREDENTIALS" });
  });

  it("rejects a new password equal to the current one", async () => {
    const { me } = fresh();
    await expect(
      me.changePassword({ currentPassword: "password123", newPassword: "password123" }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("changes the password", async () => {
    const { me } = fresh();
    await expect(
      me.changePassword({ currentPassword: "password123", newPassword: "a-fresh-password-1" }),
    ).resolves.toBeUndefined();
  });
});

describe("MF-14 me.signOutAllDevices and MF-17 me.deleteAccount", () => {
  it("signOutAllDevices needs a session", async () => {
    const { me } = fresh();
    await expect(me.signOutAllDevices()).resolves.toBeUndefined();
  });

  it("deleteAccount 403s on a wrong password", async () => {
    const { me } = fresh();
    await expect(me.deleteAccount("wrong")).rejects.toMatchObject({ status: 403 });
  });

  it("deleteAccount blocks while the person owns a project (409)", async () => {
    const { me, projects } = fresh();
    await projects.create({
      name: "Mine",
      description: "",
      status: "active",
      dueDate: null,
      ownerId: "user-1",
    });
    await expect(me.deleteAccount("password123")).rejects.toMatchObject({
      status: 409,
      code: "USER_OWNS_PROJECTS",
    });
  });

  it("deleteAccount succeeds when the person owns no projects", async () => {
    // The "empty" scenario has no projects at all, so user-1 (the only account) owns none.
    const services = createMockServices({
      scenario: "empty",
      latency: { min: 0, max: 0 },
      now: NOW,
      getActorId: () => "user-1",
    }).services;
    await expect(services.me.deleteAccount("password123")).resolves.toBeUndefined();
  });
});

describe("MB-02 users.get / users.search respect the privacy switch", () => {
  it("hides another member's profile and email; a lead still sees the email", async () => {
    const asDeveloper = fresh().users;
    const kwame = await asDeveloper.get("user-3");
    expect(kwame?.profile).toBeNull();
    expect(kwame?.email).toBeNull();
    const asLead = createMockServices({
      scenario: "default",
      latency: { min: 0, max: 0 },
      now: NOW,
      getActorId: () => "user-2",
    }).services.users;
    const kwameForLead = await asLead.get("user-3");
    expect(kwameForLead?.email).not.toBeNull();
  });

  it("users.update changes the name and theme", async () => {
    const { users } = fresh();
    const updated = await users.update("user-1", { name: "New Name", theme: "light" });
    expect(updated.name).toBe("New Name");
    expect(updated.preferences.theme).toBe("light");
  });

  it("users.update 404s for an unknown id", async () => {
    const { users } = fresh();
    await expect(users.update("nope", { name: "x" })).rejects.toMatchObject({ status: 404 });
  });
});
