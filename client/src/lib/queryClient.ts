import { QueryClient, QueryFunction } from "@tanstack/react-query";

function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// --- Auto-refresh token interceptor ---
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem("token", data.token);
    return data.token;
  } catch {
    return null;
  }
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 401) return res;
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken();
  }
  const newToken = await refreshPromise;
  isRefreshing = false;
  refreshPromise = null;
  if (!newToken) return res;
  const newInit = { ...init, headers: { ...Object(init?.headers), Authorization: `Bearer ${newToken}` } };
  return fetch(url, newInit);
}


async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await authFetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  return {} as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await authFetch(url, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
