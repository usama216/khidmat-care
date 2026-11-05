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

export async function apiPost<TResponse>(path: string, body: unknown): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(`${site.apiUrl}/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // Sends the auth cookies once login exists.
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the server.");
  }

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
