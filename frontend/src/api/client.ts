const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  return localStorage.getItem("pc_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("pc_token", token);
  else localStorage.removeItem("pc_token");
}

export function getRefreshToken() {
  return localStorage.getItem("pc_refresh_token");
}

export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem("pc_refresh_token", token);
  else localStorage.removeItem("pc_refresh_token");
}

function clearSession() {
  setToken(null);
  setRefreshToken(null);
  localStorage.removeItem("pc_user");
}

// Coalesces concurrent 401s into a single /auth/refresh call instead of firing
// one refresh request per failed request that happened to land at the same time.
let refreshInFlight: Promise<string | null> | null = null;

async function tryRefreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      setToken(data.token);
      setRefreshToken(data.refreshToken);
      return data.token as string;
    } catch {
      return null;
    }
  })();

  const result = await refreshInFlight;
  refreshInFlight = null;
  return result;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && !isRetry && path !== "/auth/refresh" && path !== "/auth/login") {
    // Access token likely expired (15m lifetime) - try a silent refresh before
    // giving up on the session, so a short token life doesn't mean re-logging-in
    // every 15 minutes.
    const newToken = await tryRefreshAccessToken();
    if (newToken) {
      return request<T>(path, options, true);
    }
    clearSession();
    window.location.href = "/login";
    throw new ApiError("Session expired", 401);
  }

  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new ApiError("Session expired", 401);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    const body = contentType.includes("application/json") ? await res.json() : { error: res.statusText };
    throw new ApiError(body.error || "Request failed", res.status);
  }

  if (contentType.includes("application/json")) {
    return res.json();
  }
  // CSV / blob downloads
  return res.blob() as unknown as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
};

export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadReport(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const blob = await res.blob();
  downloadFile(blob, filename);
}
