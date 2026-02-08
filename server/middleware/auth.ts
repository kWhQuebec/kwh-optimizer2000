import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

const JWT_SECRET = process.env.SESSION_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userClientId?: string | null;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as { userId: string };
    req.userId = decoded.userId;
    
    const user = await storage.getUser(decoded.userId);
    if (user) {
      req.userRole = user.role;
      req.userClientId = user.clientId || null;
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireStaff(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "admin" && req.userRole !== "analyst") {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}
