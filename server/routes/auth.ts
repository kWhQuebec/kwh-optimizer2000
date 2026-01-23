import { Router, Response } from "express";
import { authMiddleware, signToken, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import bcrypt from "bcrypt";
import { sendPasswordResetEmail } from "../emailService";

const router = Router();

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
    console.error("Login error:", error);
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
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    const user = await storage.getUserByEmail(normalizedEmail);
    
    if (!user) {
      console.log(`[Forgot Password] No user found for email: ${normalizedEmail}`);
      return res.json({ success: true, message: "If an account exists, a password reset email has been sent." });
    }
    
    const crypto = await import('crypto');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const randomBytes = crypto.randomBytes(12);
    let tempPassword = '';
    for (let i = 0; i < 12; i++) {
      tempPassword += chars.charAt(randomBytes[i] % chars.length);
    }
    
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    
    await storage.updateUser(user.id, { 
      passwordHash,
      forcePasswordChange: true
    });
    
    await sendPasswordResetEmail(user.email, tempPassword, 'fr');
    
    console.log(`[Forgot Password] Password reset email sent to: ${normalizedEmail}`);
    
    res.json({ success: true, message: "If an account exists, a password reset email has been sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.json({ success: true, message: "If an account exists, a password reset email has been sent." });
  }
});

export default router;
