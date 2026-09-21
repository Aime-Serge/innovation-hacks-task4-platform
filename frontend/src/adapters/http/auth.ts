import type { AuthService } from "@/services/auth";
import { ServiceError } from "@/services/types";
import { call, callJson } from "./client";
import { parseUser } from "./mappers";

const unsupported = (what: string) => (): never => {
  throw new ServiceError("NOT_SUPPORTED", `${what} is not available in this version.`, 501);
};

async function signIn(email: string, password: string): Promise<ReturnType<typeof parseUser>> {
  const body = await callJson<{ user: unknown }>("POST", "auth/login", {
    body: { email, password },
  });
  return parseUser(body.user);
}

/** Sessions live in HttpOnly cookies set by the server layer; this never sees a token. */
export function createHttpAuth(): AuthService {
  return {
    getSession: async () => {
      try {
        return parseUser(await callJson("GET", "auth/me"));
      } catch (error) {
        if (error instanceof ServiceError && error.status === 401) return null;
        throw error;
      }
    },
    login: signIn,
    // FR-401: a successful registration signs the person in.
    register: async (name, email, password) => {
      await call("POST", "users", { body: { name, email, password } });
      return signIn(email, password);
    },
    logout: async () => {
      await call("POST", "auth/logout");
    },
    updateProfile: async (userId, input) => {
      if (input.email !== undefined) unsupported("Changing the email address")();
      return parseUser(await callJson("PATCH", `users/${userId}`, { body: { name: input.name } }));
    },
    // Out of scope for this task (section 2): no password reset, avatar upload or account removal.
    forgotPassword: unsupported("Password reset"),
    resetPassword: unsupported("Password reset"),
    changePassword: unsupported("Changing the password"),
    uploadAvatar: unsupported("Avatar upload"),
    deleteAvatar: unsupported("Avatar removal"),
    deleteAccount: unsupported("Deleting the account"),
  };
}
