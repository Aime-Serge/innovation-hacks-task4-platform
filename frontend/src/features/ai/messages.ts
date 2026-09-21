import { t, tCount } from "@/i18n";
import { ServiceError } from "@/services/types";

/** Every AI failure in the words of section 7: what happened and what the person can do. */
export function aiErrorMessage(error: unknown): string {
  if (!(error instanceof ServiceError)) return t("ai.error.generic");
  switch (error.code) {
    case "AI_DISABLED":
      return t("ai.error.disabled");
    case "AI_UNAVAILABLE":
      return t("ai.error.unavailable");
    case "AI_BAD_RESPONSE":
      return t("ai.error.bad");
    case "AI_QUOTA_EXCEEDED": {
      const seconds = error.retryAfter ?? 0;
      return seconds < 60
        ? t("ai.error.quotaSoon")
        : tCount("ai.error.quota", Math.ceil(seconds / 60));
    }
    case "FORBIDDEN":
    case "NOT_FOUND":
      return t("ai.error.forbidden");
    default:
      return t("ai.error.generic");
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
