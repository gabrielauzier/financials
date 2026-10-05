import { supabase } from "@/integrations/supabase/client";
import type { ApiErrorPayload, ApiRequestOptions } from "./types";
import { mockRequest, shouldMock } from "./mock";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (!value || typeof value !== "object" || !("error" in value)) return false;
  const error = (value as { error?: unknown }).error;
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string",
  );
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, ...fetchOptions } = options;
  const method = fetchOptions.method?.toUpperCase() ?? "GET";
  if (shouldMock(path)) return mockRequest<T>({ method, path, body });

  const { data } = await supabase.auth.getSession();
  const headers = new Headers(fetchOptions.headers);
  if (data.session?.access_token)
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  headers.set("X-Timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers.set("Content-Type", "application/json");

  const requestInit: RequestInit = {
    ...fetchOptions,
    method,
    headers,
  };
  if (body !== undefined) requestInit.body = isFormData ? body : JSON.stringify(body);
  const response = await fetch(`${import.meta.env["VITE_API_URL"] ?? ""}${path}`, requestInit);

  if (response.status === 401) {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    if (isApiErrorPayload(payload)) {
      throw new ApiError(
        payload.error.code,
        payload.error.message,
        response.status,
        payload.error.field,
      );
    }
    throw new ApiError(
      "unexpected_error",
      "Não foi possível concluir a solicitação.",
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
