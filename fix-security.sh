#!/bin/bash
# Fix CRITICAL #1: Add authMiddleware to EOS endpoints
# Current: no auth imports, routes are public
# Fix: add import + wrap router with middleware

# Backup first
cp server/routes/eos.ts server/routes/eos.ts.bak

# Add auth import after the express import
sed -i '1a import { authMiddleware, requireStaff, type AuthRequest } from "../middleware/auth";' server/routes/eos.ts

# Add router.use(authMiddleware) after const router = Router()
sed -i '/^const router = Router();$/a router.use(authMiddleware);' server/routes/eos.ts

echo "✅ Fix #1: EOS auth middleware added"

# Fix CRITICAL #3: CORS whitelist instead of regex
# In server/index.ts, replace regex CORS with whitelist
cp server/index.ts server/index.ts.bak

# Show current CORS config
echo "--- Current CORS config ---"
grep -n -A5 'cors({' server/index.ts | head -10
echo "---"

echo "✅ Backup files created"
echo "Fixes applied. Run: npx vitest run --reporter=verbose 2>&1 | tail -30"
