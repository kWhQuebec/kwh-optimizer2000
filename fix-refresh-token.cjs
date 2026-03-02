const fs = require('fs');

// === FIX 1: auth.tsx — store refreshToken on login, remove on logout ===
let auth = fs.readFileSync('client/src/lib/auth.tsx', 'utf8');

// 1a. After localStorage.setItem("token", data.token); add refreshToken storage
auth = auth.replace(
  'localStorage.setItem("token", data.token);',
  `localStorage.setItem("token", data.token);
    if (data.refreshToken) {
      localStorage.setItem("refreshToken", data.refreshToken);
    }`
);

// 1b. In logout, after localStorage.removeItem("token"); add refreshToken removal
auth = auth.replace(
  `const logout = useCallback(() => {
    localStorage.removeItem("token");`,
  `const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");`
);

fs.writeFileSync('client/src/lib/auth.tsx', auth);
console.log('OK 1: auth.tsx — refreshToken stored on login, removed on logout');

// === FIX 2: queryClient.ts — add auto-refresh interceptor ===
let qc = fs.readFileSync('client/src/lib/queryClient.ts', 'utf8');

// 2a. After getAuthHeaders function, add refreshAccessToken + authFetch
const refreshBlock = `

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
  // Try refresh exactly once
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken();
  }
  const newToken = await refreshPromise;
  isRefreshing = false;
  refreshPromise = null;
  if (!newToken) return res; // refresh failed, return original 401
  // Retry with new token
  const newInit = { ...init, headers: { ...Object(init?.headers), Authorization: \`Bearer \${newToken}\` } };
  return fetch(url, newInit);
}
`;

// Insert after the closing brace of getAuthHeaders
qc = qc.replace(
  /function getAuthHeaders\(\): HeadersInit \{[^}]+\n\s*return \{\};\n\}/,
  (match) => match + refreshBlock
);

// 2b. Replace fetch in getQueryFn with authFetch
qc = qc.replace(
  'const res = await fetch(url, {\n      credentials: "include",\n      headers: getAuthHeaders(),\n    });',
  'const res = await authFetch(url, {\n      credentials: "include",\n      headers: getAuthHeaders(),\n    });'
);

// 2c. Replace fetch in apiRequest with authFetch
qc = qc.replace(
  'const res = await fetch(url, {\n    method,\n    headers,\n    body: data ? JSON.stringify(data) : undefined,\n    credentials: "include",\n  });',
  'const res = await authFetch(url, {\n    method,\n    headers,\n    body: data ? JSON.stringify(data) : undefined,\n    credentials: "include",\n  });'
);

fs.writeFileSync('client/src/lib/queryClient.ts', qc);
console.log('OK 2: queryClient.ts — refreshAccessToken + authFetch interceptor added');
console.log('OK 3: queryClient.ts — getQueryFn fetch replaced with authFetch');
console.log('OK 4: queryClient.ts — apiRequest fetch replaced with authFetch');
console.log('ALL DONE');
