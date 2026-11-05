import { site } from "@/config/site";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    request_id?: string | null;
  };
};

export type ApiFieldError = { field: string; message: string; type: string };

// Mirrors the API's error shape. Callers branch on `code`, which stays stable.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get fieldErrors(): ApiFieldError[] {
    return this.code === "validation_error" && Array.isArray(this.details) ? (this.details as ApiFieldError[]) : [];
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const API_PREFIX = `${site.apiUrl}/api/v1`;

type Method = "GET" | "POST" | "PATCH" | "PUT";

async function send(method: Method, path: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(`${API_PREFIX}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      credentials: "include", // Sends the HttpOnly session cookies.
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the server.");
  }
}

// Requests that fail together while the session expires share one refresh, because refresh
// tokens work only once.
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= send("POST", "/auth/refresh")
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

const NO_REFRESH_PATHS = new Set(["/auth/login", "/auth/refresh", "/auth/logout"]);

async function request<TResponse>(method: Method, path: string, body?: unknown): Promise<TResponse> {
  let response = await send(method, path, body);

  if (response.status === 401 && !NO_REFRESH_PATHS.has(path)) {
    // Retried even if this refresh lost a race with another tab, whose new cookies may work.
    await refreshSession();
    response = await send(method, path, body);
  }

  if (response.status === 204) return undefined as TResponse;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "unknown_error",
      error?.message ?? "The request failed.",
      error?.details,
      error?.request_id,
    );
  }
  return data as TResponse;
}

export type QueryParams = Record<string, string | number | undefined>;

export function apiGet<TResponse>(path: string, params?: QueryParams): Promise<TResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const suffix = query.size > 0 ? `?${query}` : "";
  return request<TResponse>("GET", `${path}${suffix}`);
}

export function apiPost<TResponse>(path: string, body?: unknown): Promise<TResponse> {
  return request<TResponse>("POST", path, body);
}

export function apiPatch<TResponse>(path: string, body: unknown): Promise<TResponse> {
  return request<TResponse>("PATCH", path, body);
}

export function apiPut<TResponse>(path: string, body: unknown): Promise<TResponse> {
  return request<TResponse>("PUT", path, body);
}
