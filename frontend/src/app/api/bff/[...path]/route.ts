import { handleBff } from "@/lib/session/bff";
import { readSessionConfig, type SessionConfig } from "@/lib/session/config";

// The AI calls can take up to the 25 s budget of the API; the function must outlive them (FR-438).
export const maxDuration = 30;
export const dynamic = "force-dynamic";

let config: SessionConfig | null = null;

async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  config ??= readSessionConfig(process.env);
  const { path } = await context.params;
  return handleBff(request, path, { config });
}

export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
