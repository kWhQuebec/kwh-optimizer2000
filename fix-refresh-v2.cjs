const fs = require('fs');
let qc = fs.readFileSync('client/src/lib/queryClient.ts', 'utf8');

// Check current state
console.log('authFetch count:', (qc.match(/authFetch/g) || []).length);
console.log('refreshAccessToken count:', (qc.match(/refreshAccessToken/g) || []).length);

// The regex failed before because [^}] stops at inner braces.
// Use a simple string match instead.
const anchor = 'function getAuthHeaders(): HeadersInit {';
const anchorIdx = qc.indexOf(anchor);
if (anchorIdx === -1) { console.log('ERROR: anchor not found'); process.exit(1); }

// Find the end of getAuthHeaders function (closing brace at column 0)
const afterAnchor = qc.substring(anchorIdx);
// Match: return {};\n}
const endMatch = afterAnchor.indexOf('  return {};\n}');
if (endMatch === -1) { console.log('ERROR: function end not found'); process.exit(1); }

const insertPoint = anchorIdx + endMatch + '  return {};\n}'.length;

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
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken();
  }
  const newToken = await refreshPromise;
  isRefreshing = false;
  refreshPromise = null;
  if (!newToken) return res;
  const newInit = { ...init, headers: { ...Object(init?.headers), Authorization: \`Bearer \${newToken}\` } };
  return fetch(url, newInit);
}
`;

qc = qc.substring(0, insertPoint) + refreshBlock + qc.substring(insertPoint);
fs.writeFileSync('client/src/lib/queryClient.ts', qc);

// Verify
const updated = fs.readFileSync('client/src/lib/queryClient.ts', 'utf8');
console.log('authFetch count after:', (updated.match(/authFetch/g) || []).length);
console.log('refreshAccessToken count after:', (updated.match(/refreshAccessToken/g) || []).length);
console.log('DONE');
