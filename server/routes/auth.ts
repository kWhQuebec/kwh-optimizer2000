import { Router, Response } from "express";
import { authMiddleware, signToken, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import bcrypt from "bcrypt";
import { z } from "zod";
import { sendPasswordResetEmail } from "../emailService";
import { generateSecurePassword } from "../lib/secureRandom";
import { asyncHandler, BadRequestError, NotFoundError } from "../middleware/errorHandler";
import { createLogger } from "../lib/logger";

const log = createLogger("Auth");
const router = Router();

const emailSchema = z.string().email().transform(e => e.toLowerCase().trim());

// Rate limiting map (in production, use Redis)
const resetAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_RESET_ATTEMPTS = 5;
const RESET_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const attempts = resetAttempts.get(email);

  if (!attempts || now > attempts.resetAt) {
    resetAttempts.set(email, { count: 1, resetAt: now + RESET_WINDOW_MS });
    return true;
  }

  if (attempts.count >= MAX_RESET_ATTEMPTS) {
    return false;
  }

  attempts.count++;
  return true;
}

router.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    if (user.status === "inactive") {
      return res.status(403).json({ error: "Account is deactivated. Please contact an administrator." });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await storage.updateUser(user.id, { lastLoginAt: new Date() });

    const token = signToken(user.id);
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        forcePasswordChange: user.forcePasswordChange || false,
      },
    });
  } catch (error) {
    log.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    let clientName = null;
    if (user.clientId) {
      const client = await storage.getClient(user.clientId);
      clientName = client?.name || null;
    }
    
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name || null,
      clientId: user.clientId || null,
      clientName,
      forcePasswordChange: user.forcePasswordChange || false,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/auth/change-password", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }
    
    const user = await storage.getUser(req.userId!);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    if (!user.forcePasswordChange) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required" });
      }
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    await storage.updateUser(user.id, { 
      passwordHash,
      forcePasswordChange: false
    });
    
    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    log.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/auth/forgot-password", asyncHandler(async (req, res) => {
  const { email, language = "fr" } = req.body;
  
  if (!email) {
    throw new BadRequestError("Email is required");
  }
  
  // Validate and normalize email
  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) {
    // Return success anyway to prevent email enumeration
    res.json({ success: true, message: "If an account exists, a password reset email has been sent." });
    return;
  }
  
  const normalizedEmail = emailResult.data;
  
  // Rate limiting
  if (!checkRateLimit(normalizedEmail)) {
    // Return success anyway to prevent timing attacks
    log.info(`Rate limited: ${normalizedEmail}`);
    res.json({ success: true, message: "If an account exists, a password reset email has been sent." });
    return;
  }
  
  const user = await storage.getUserByEmail(normalizedEmail);
  
  if (!user) {
    log.info(`No user found for email: ${normalizedEmail}`);
    // Return success anyway to prevent email enumeration
    res.json({ success: true, message: "If an account exists, a password reset email has been sent." });
    return;
  }
  
  // Generate secure temporary password (no modulo bias)
  const tempPassword = generateSecurePassword(14);
  
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  
  await storage.updateUser(user.id, { 
    passwordHash,
    forcePasswordChange: true
  });
  
  await sendPasswordResetEmail(user.email, tempPassword, language);
  
  log.info(`Password reset email sent to: ${normalizedEmail}`);
  
  res.json({ success: true, message: "If an account exists, a password reset email has been sent." });
}));

export default router;
