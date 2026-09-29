import { AppError } from "./errors";

export async function requestJson<T>(url: string, init: RequestInit, service: string, timeoutMs = 20000): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) }); }
  catch { throw new AppError("UPSTREAM_UNREACHABLE", `${service} timed out or could not be reached. Check the store before retrying a publish.`); }
  if (!response.ok) {
    if (response.status === 429) throw new AppError("RATE_LIMITED", `${service} quota or rate limit reached. Wait before retrying; no paid fallback is enabled.`, 429);
    throw new AppError("UPSTREAM_ERROR", `${service} returned HTTP ${response.status}. Check credentials, permissions and model availability.`);
  }
  try { return await response.json() as T; }
  catch { throw new AppError("UPSTREAM_INVALID_RESPONSE", `${service} returned an invalid response.`); }
}
