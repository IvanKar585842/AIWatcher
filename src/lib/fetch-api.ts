export type ApiResult<T> =
  | { success: true; data: T; status: number }
  | { success: false; error: string; status: number; details?: unknown };

export async function fetchApi<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(input, init);
    const text = await res.text();

    if (!text.trim()) {
      return {
        success: false,
        error: res.ok ? "Empty response from server" : `Request failed (${res.status})`,
        status: res.status,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: "Invalid JSON response from server",
        status: res.status,
      };
    }

    const body = parsed as Record<string, unknown>;

    if (body.success === true) {
      if ("data" in body) {
        return { success: true, data: body.data as T, status: res.status };
      }
      if ("monitor" in body) {
        return { success: true, data: { monitor: body.monitor } as T, status: res.status };
      }
      if ("monitors" in body) {
        const monitors = Array.isArray(body.monitors) ? body.monitors : [];
        return { success: true, data: { monitors } as T, status: res.status };
      }
    }

    if (body.success === false && typeof body.error === "string") {
      return {
        success: false,
        error: body.error,
        status: res.status,
        details: body.details,
      };
    }

    if (res.ok) {
      return { success: true, data: parsed as T, status: res.status };
    }

    const legacyError =
      typeof body.error === "string" ? body.error : `Request failed (${res.status})`;
    return { success: false, error: legacyError, status: res.status, details: body.details };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network request failed",
      status: 0,
    };
  }
}
