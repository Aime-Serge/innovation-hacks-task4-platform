import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const run = async <T>(promise: Promise<T>): Promise<T> => {
  const settled = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const result = await settled;
  if ("error" in result) throw result.error;
  return result.value;
};

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  document.cookie = "mock_session=; max-age=0";
  vi.resetModules();
});
afterEach(() => vi.useRealTimers());

// The mock stands in for Task 4's real API and must behave like it: same errors,
// no account enumeration, sessions only from login.
const fresh = async () => (await import("@/adapters/mock")).createMockAuth();
// vi.resetModules() gives each test a fresh module graph, so match the error class by name.
const isServiceError = (value: unknown, status?: number): boolean =>
  value instanceof Error &&
  value.name === "ServiceError" &&
  (status === undefined || (value as { status?: number }).status === status);

describe("TC-004 mock auth adapter", () => {
  it("TC-004 logs in the seed account, sets the session cookie and restores it", async () => {
    const auth = await fresh();
    expect(await run(auth.getSession())).toBeNull();
    const user = await run(auth.login("AIME.SERGE@example.com", "password123"));
    expect(user.email).toBe("aime.serge@example.com");
    expect(document.cookie).toContain("mock_session=user-1");
    expect((await run(auth.getSession()))?.id).toBe("user-1");
    await run(auth.logout());
    expect(document.cookie).not.toContain("mock_session=user-1");
    expect(await run(auth.getSession())).toBeNull();
  });

  it("TC-004 wrong password and unknown email give the same 401", async () => {
    const auth = await fresh();
    const a = await run(auth.login("aime.serge@example.com", "nope")).catch((e: unknown) => e);
    const b = await run(auth.login("ghost@example.com", "password123")).catch((e: unknown) => e);
    expect(isServiceError(a, 401)).toBe(true);
    expect((b as Error).message).toBe((a as Error).message);
  });

  it("TC-005 registering creates the account without starting a session, and rejects duplicates", async () => {
    const auth = await fresh();
    const user = await run(auth.register("Ada", "ada@example.com", "password123"));
    expect(user.name).toBe("Ada");
    expect(document.cookie).not.toContain("mock_session=user");
    expect(await run(auth.getSession())).toBeNull();
    await expect(run(auth.register("Ada", "ada@example.com", "password123"))).rejects.toMatchObject(
      { status: 409 },
    );
    expect((await run(auth.login("ada@example.com", "password123"))).name).toBe("Ada");
  });

  it("TC-004 forgot and reset password: same reply for unknown emails, single-use token", async () => {
    const auth = await fresh();
    expect(await run(auth.forgotPassword("ghost@example.com"))).toEqual({ devResetUrl: null });
    const { devResetUrl } = await run(auth.forgotPassword("aime.serge@example.com"));
    const token = new URL(devResetUrl ?? "", "http://x").searchParams.get("token") ?? "";
    await run(auth.resetPassword(token, "newpassword1"));
    await expect(run(auth.resetPassword(token, "again12345"))).rejects.toSatisfy((e: unknown) =>
      isServiceError(e),
    );
    expect((await run(auth.login("aime.serge@example.com", "newpassword1"))).id).toBe("user-1");
  });

  it("TC-004 an expired reset token is refused", async () => {
    const auth = await fresh();
    const { devResetUrl } = await run(auth.forgotPassword("aime.serge@example.com"));
    const token = new URL(devResetUrl ?? "", "http://x").searchParams.get("token") ?? "";
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);
    await expect(run(auth.resetPassword(token, "newpassword1"))).rejects.toSatisfy((e: unknown) =>
      isServiceError(e),
    );
  });

  it("TC-021 updates the profile and changes the password after checking the old one", async () => {
    const auth = await fresh();
    await run(auth.login("aime.serge@example.com", "password123"));
    expect((await run(auth.updateProfile("user-1", { name: "New Name" }))).name).toBe("New Name");
    await expect(run(auth.changePassword("user-1", "wrong", "abcdefgh1"))).rejects.toSatisfy(
      (e: unknown) => isServiceError(e),
    );
    await run(auth.changePassword("user-1", "password123", "abcdefgh1"));
    expect((await run(auth.login("aime.serge@example.com", "abcdefgh1"))).id).toBe("user-1");
    await expect(run(auth.updateProfile("missing", { name: "x" }))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("TC-021 accepts small PNG avatars and rejects other types or big files", async () => {
    const auth = await fresh();
    await run(auth.login("aime.serge@example.com", "password123"));
    const png = new File(["x"], "a.png", { type: "image/png" });
    expect((await run(auth.uploadAvatar("user-1", png))).avatarUrl).toMatch(/^data:image\/png/);
    expect((await run(auth.deleteAvatar("user-1"))).avatarUrl).toBeUndefined();
    await expect(
      run(auth.uploadAvatar("user-1", new File(["x"], "a.gif", { type: "image/gif" }))),
    ).rejects.toSatisfy((e: unknown) => isServiceError(e));
    const big = new File([new Uint8Array(600_000)], "big.png", { type: "image/png" });
    await expect(run(auth.uploadAvatar("user-1", big))).rejects.toSatisfy((e: unknown) =>
      isServiceError(e),
    );
  });

  it("TC-004 deleting the account ends the session and frees the email", async () => {
    const auth = await fresh();
    await run(auth.login("aime.serge@example.com", "password123"));
    await run(auth.deleteAccount("user-1"));
    expect(await run(auth.getSession())).toBeNull();
    await expect(run(auth.login("aime.serge@example.com", "password123"))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("TC-004 survives corrupt stored accounts by falling back to the seed", async () => {
    window.localStorage.setItem("devdash_mock_accounts", "{not json");
    const auth = await fresh();
    expect((await run(auth.login("aime.serge@example.com", "password123"))).id).toBe("user-1");
  });
});
