import { dataSource } from "@/lib/data-source";
import { cookieNames } from "./cookies";

/**
 * The cookie that only says "a session exists" (ADR-425): the mock adapter's own in tests, the
 * server layer's marker otherwise. A presence check for redirects and wording, never authorization.
 */
export function sessionMarkerName(): string {
  return dataSource() === "mock"
    ? "mock_session"
    : cookieNames(process.env["ALLOW_INSECURE_COOKIES"] === "true").marker;
}
