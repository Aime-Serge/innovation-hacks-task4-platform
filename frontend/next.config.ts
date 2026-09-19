import type { NextConfig } from "next";

// Production deploys serve the frontend (Vercel) and the API (Render) from
// different domains. A session cookie set by the API's domain is never
// sent to the frontend's domain, so proxy.ts (which runs on the frontend
// and checks for that cookie) would bounce every logged-in user back to
// /login, and Safari/Firefox block such third-party cookies outright.
// Proxying API calls through this app under /api keeps everything
// same-origin, so the cookie is first-party on the frontend's own domain.
// Set API_PROXY_TARGET (server-side only) to the API's base URL and
// NEXT_PUBLIC_API_URL=/api; leave both unset locally to talk to the API
// directly.
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: "/api/:path*", destination: `${apiProxyTarget}/:path*` }];
  },
};

export default nextConfig;
