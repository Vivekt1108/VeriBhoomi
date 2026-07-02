// Tiny API client. Stores the JWT in localStorage and attaches it to requests.
// All calls go to /api/* which Next.js proxies to the Express backend.

const TOKEN_KEY = "vb_token";
const USER_KEY = "vb_user";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "CITIZEN" | "OFFICER" | "AUTHORITY" | "ADMIN";
  jurisdiction?: string | null;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function setSession(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Patch the cached session user in place (e.g. after a profile name change),
// keeping the existing token. No-op if there's no session.
export function updateSessionUser(patch: Partial<SessionUser>) {
  const current = getUser();
  if (!current) return;
  localStorage.setItem(USER_KEY, JSON.stringify({ ...current, ...patch }));
}

// Where each role lands after login — these are four genuinely different apps.
export function roleHome(role: SessionUser["role"]): string {
  switch (role) {
    case "CITIZEN": return "/citizen";
    case "OFFICER": return "/officer";
    case "AUTHORITY": return "/authority";
    case "ADMIN": return "/admin";
    default: return "/login";
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// Fetch a file (PDF/image) WITH the auth header and return a blob object URL the
// browser can render in an <iframe>/<img>. An iframe's src can't carry a Bearer
// token, so we fetch the bytes ourselves. fetch transparently follows the
// signed-URL redirect when storage is in cloud mode. Caller must revokeObjectURL.
export async function apiFile(path: string): Promise<{ url: string; type: string }> {
  const token = getToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not load file (${res.status})`);
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}

// An error that carries the parsed response body + HTTP status, so callers can
// react to structured failures (e.g. a 409 conflict that includes the list of
// contradictions) rather than just a message string.
export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    const msg = body.error ? (typeof body.error === "string" ? body.error : JSON.stringify(body.error)) : `Request failed (${status})`;
    super(msg);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// Multipart upload (FormData). Do NOT set Content-Type — the browser adds the
// multipart boundary itself.
export async function apiUpload<T = unknown>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}
