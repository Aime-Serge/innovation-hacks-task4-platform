import { User } from "@/schemas";
import type { AuthService } from "@/services/auth";
import { ServiceError } from "@/services/types";
import { call, callJson } from "./client";

const unsupported = (what: string) => (): never => {
  throw new ServiceError("NOT_SUPPORTED", `${what} is not available in this version.`, 501);
};

async function signIn(email: string, password: string): Promise<User> {
  const body = await callJson<{ user: unknown }>("POST", "auth/login", {
    body: { email, password },
  });
  return User.parse(body.user);
}

/** Sessions live in HttpOnly cookies set by the server layer; this never sees a token. */
export function createHttpAuth(): AuthService {
  return {
    getSession: async () => {
      try {
        return User.parse(await callJson("GET", "auth/me"));
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
      return User.parse(await callJson("PATCH", `users/${userId}`, { body: { name: input.name } }));
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
