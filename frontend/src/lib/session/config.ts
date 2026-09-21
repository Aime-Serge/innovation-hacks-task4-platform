// Server-layer settings (section 8). Every value is read on the server only: none of these names
// starts with NEXT_PUBLIC_, so nothing here can reach the browser bundle (NFR-411).

export type SessionConfig = {
  /** The Render API, used only by the server layer. */
  apiBaseUrl: string;
  /** The site's own origin, for the Origin check. */
  siteUrl: string;
  timeoutMs: number;
  /** Plain-HTTP development: relaxes the cookie prefixes and Secure. Production refuses it. */
  insecureCookies: boolean;
};

type Env = Record<string, string | undefined>;

function requireUrl(name: string, value: string | undefined, https: boolean): URL {
  if (value === undefined || value === "") throw new Error(`${name} is required`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (https && url.protocol !== "https:") throw new Error(`${name} must be https in production`);
  return url;
}

export function readSessionConfig(env: Env): SessionConfig {
  const production = env["NODE_ENV"] === "production";
  const insecure = env["ALLOW_INSECURE_COOKIES"] === "true";
  if (production && insecure) {
    throw new Error("ALLOW_INSECURE_COOKIES is a development setting and is refused in production");
  }
  const api = requireUrl("API_BASE_URL", env["API_BASE_URL"], production);
  const site = requireUrl("SITE_URL", env["SITE_URL"], production);
  const timeout = Number(env["BFF_TIMEOUT_MS"] ?? "28000");
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000) {
    throw new Error("BFF_TIMEOUT_MS must be a whole number from 1000 to 60000");
  }
  return {
    apiBaseUrl: api.origin + api.pathname.replace(/\/+$/, ""),
    siteUrl: site.origin,
    timeoutMs: timeout,
    insecureCookies: insecure,
  };
}
