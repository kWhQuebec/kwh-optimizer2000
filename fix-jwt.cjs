const fs = require('fs');

// === 1. Fix auth middleware ===
let auth = fs.readFileSync('server/middleware/auth.ts', 'utf8');

// Change 7d to 15m
auth = auth.replace('expiresIn: "7d"', 'expiresIn: "15m"');

// Add signRefreshToken + verifyRefreshToken after signToken
const newFunctions = `

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; type?: string };
  if (decoded.type !== "refresh") throw new Error("Not a refresh token");
  return { userId: decoded.userId };
}`;

auth = auth.trimEnd() + '\n' + newFunctions + '\n';
fs.writeFileSync('server/middleware/auth.ts', auth);
console.log('OK: auth.ts - signToken 7d->15m + signRefreshToken added');

// === 2. Fix auth routes ===
let routes = fs.readFileSync('server/routes/auth.ts', 'utf8');

// Update import
routes = routes.replace(
  'import { authMiddleware, signToken, AuthRequest } from "../middleware/auth";',
  'import { authMiddleware, signToken, signRefreshToken, verifyRefreshToken, AuthRequest } from "../middleware/auth";'
);

// Add refreshToken to login response (line 82 area)
routes = routes.replace(
  '    const token = signToken(user.id);',
  '    const token = signToken(user.id);\n    const refreshToken = signRefreshToken(user.id);'
);

routes = routes.replace(
  '    res.json({\n      token,\n      user:',
  '    res.json({\n      token,\n      refreshToken,\n      user:'
);

fs.writeFileSync('server/routes/auth.ts', routes);
console.log('OK: auth routes - refreshToken in login response');

// === 3. Add refresh endpoint to auth routes ===
// Find the last route and add before module.exports or end of file
const refreshEndpoint = `
// POST /api/auth/refresh — exchange refresh token for new access token
router.post("/api/auth/refresh", asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "refreshToken required" });
  }
  try {
    const { userId } = verifyRefreshToken(refreshToken);
    const newToken = signToken(userId);
    res.json({ token: newToken });
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
}));
`;

// Insert before the last export default or at end
if (routes.includes('export default router')) {
  routes = fs.readFileSync('server/routes/auth.ts', 'utf8');
  routes = routes.replace('export default router', refreshEndpoint + '\nexport default router');
  fs.writeFileSync('server/routes/auth.ts', routes);
  console.log('OK: refresh endpoint added');
} else {
  console.log('WARN: could not find export default router');
}

console.log('\n=== JWT Fix Complete ===');
