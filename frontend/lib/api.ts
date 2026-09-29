const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    // Sends/receives the httpOnly session cookie on every request, even
    // cross-origin (frontend and backend are deployed separately).
    credentials: "include",
    headers: {
      // For FormData bodies (file uploads), the browser must set its own
      // multipart boundary — an explicit Content-Type here would break it.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      // CSRF defense: a plain HTML form can never set this header, so
      // its presence proves the request went through fetch — which
      // means the browser enforced a CORS preflight and the backend's
      // origin allowlist already had to approve it. See backend/app/csrf.py.
      "X-Requested-With": "XMLHttpRequest",
      ...options.headers,
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      body?.error?.message ?? body?.detail ?? "Something went wrong. Please try again.";
    throw new ApiError(res.status, message, body?.error?.code);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
};
