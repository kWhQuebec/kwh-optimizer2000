#!/bin/bash
echo "=== Fix #3: CORS regex → explicit whitelist ==="

# Replace the CORS block in server/index.ts
# Current: regex patterns that can be bypassed
# New: explicit whitelist of allowed origins

sed -i '/\/\/ CORS configuration/,/}));/{
/\/\/ CORS configuration/c\// CORS configuration — explicit whitelist (no regex bypass)\nconst ALLOWED_ORIGINS = [\n  "https://kwhoptimizer.replit.app",\n  "https://kwh.quebec",\n  "https://www.kwh.quebec",\n  "https://app.kwh.quebec",\n  "https://dashboard.kwh.quebec",\n];\napp.use(cors({\n  origin: env.NODE_ENV === "production"\n    ? (origin, callback) => {\n        if (!origin || ALLOWED_ORIGINS.includes(origin)) {\n          callback(null, true);\n        } else {\n          callback(new Error("CORS not allowed"));\n        }\n      }\n    : true,\n  credentials: true,\n}));
/\/\/ CORS configuration/!d
}' server/index.ts

echo "--- Verify CORS fix ---"
sed -n '43,65p' server/index.ts
echo "=== Done ==="
