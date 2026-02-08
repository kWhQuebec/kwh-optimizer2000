import { Router } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../emailService";
import { generateSecurePassword } from "../lib/secureRandom";
import { asyncHandler, BadRequestError, NotFoundError, ForbiddenError } from "../middleware/errorHandler";
import { createLogger } from "../lib/logger";

const log = createLogger("Users");
const router = Router();

// List all users (admin only)
router.get("/api/users", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  // Only admins can list all users
  if (req.userRole !== "admin") {
    throw new ForbiddenError("Admin access required");
  }
  const users = await storage.getUsers();
  // Remove password hashes from response
  const safeUsers = users.map(({ passwordHash, ...user }) => user);
  res.json(safeUsers);
}));

// Create a client user account (admin only)
router.post("/api/users", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  // Only admins can create users
  if (req.userRole !== "admin") {
    throw new ForbiddenError("Admin access required");
  }

  const { email, name, role, clientId, preferredLanguage } = req.body;

  if (!email) {
    throw new BadRequestError("Email is required");
  }

  // Allow creating admin, client or analyst roles
  if (role && !["client", "analyst", "admin"].includes(role)) {
    throw new BadRequestError("Invalid role. Only 'client', 'analyst', or 'admin' allowed.");
  }

  // Client users must have a clientId
  if (role === "client" && !clientId) {
    throw new BadRequestError("Client users must be linked to a client");
  }

  const tempPassword = generateSecurePassword();

  // Hash password
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  const user = await storage.createUser({
    email,
    passwordHash: hashedPassword,
    name: name || null,
    role: role || "client",
    clientId: clientId || null,
    forcePasswordChange: true, // Force password change on first login
  });

  // Send welcome email with temporary password (async, don't wait for it)
  const protocol = req.protocol || 'https';
  const host = req.get('host') || process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
  const baseUrl = `${protocol}://${host}`;

  const emailLang = preferredLanguage === 'en' ? 'en' : 'fr';
  sendWelcomeEmail({
    userEmail: email,
    userName: name || email.split('@')[0],
    userRole: role || "client",
    tempPassword: tempPassword,
  }, baseUrl, emailLang).catch(err => {
    log.error("Failed to send welcome email:", err);
  });

  // Return user without password hash
  const { passwordHash: _, ...safeUser } = user;
  res.status(201).json(safeUser);
}));

// Delete a user (admin only)
router.delete("/api/users/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  // Only admins can delete users
  if (req.userRole !== "admin") {
    throw new ForbiddenError("Admin access required");
  }

  // Prevent deleting self
  if (req.params.id === req.userId) {
    throw new BadRequestError("Cannot delete your own account");
  }

  const deleted = await storage.deleteUser(req.params.id);
  if (!deleted) {
    throw new NotFoundError("User");
  }
  res.status(204).send();
}));

// Update a user (admin only)
router.patch("/api/users/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  // Only admins can update users
  if (req.userRole !== "admin") {
    throw new ForbiddenError("Admin access required");
  }

  const { name, role, clientId, status, language } = req.body;

  // Validate role if provided
  if (role && !["client", "analyst", "admin"].includes(role)) {
    throw new BadRequestError("Invalid role");
  }

  // Validate status if provided
  if (status && !["active", "inactive"].includes(status)) {
    throw new BadRequestError("Invalid status");
  }

  // Validate language if provided
  if (language && !["fr", "en"].includes(language)) {
    throw new BadRequestError("Invalid language");
  }

  // Prevent demoting yourself from admin
  if (req.params.id === req.userId && role && role !== "admin") {
    throw new BadRequestError("Cannot change your own admin role");
  }

  // Client users must have a clientId
  if (role === "client" && clientId === undefined) {
    // Keep existing clientId if not provided
  } else if (role === "client" && !clientId) {
    throw new BadRequestError("Client users must be linked to a client");
  }

  const updateData: Record<string, any> = {};
  if (name !== undefined) updateData.name = name;
  if (role !== undefined) updateData.role = role;
  if (clientId !== undefined) updateData.clientId = role === "client" ? clientId : null;
  if (status !== undefined) updateData.status = status;
  if (language !== undefined) updateData.language = language;

  const updated = await storage.updateUser(req.params.id, updateData);
  if (!updated) {
    throw new NotFoundError("User");
  }

  // Return user without password hash
  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
}));

// Reset user password (admin only) - auto-generates and emails new password
router.post("/api/users/:id/reset-password", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  // Only admins can reset passwords
  if (req.userRole !== "admin") {
    throw new ForbiddenError("Admin access required");
  }

  // Get user info
  const user = await storage.getUser(req.params.id);
  if (!user) {
    throw new NotFoundError("User");
  }

  // Generate cryptographically secure temporary password
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const randomBytes = crypto.randomBytes(12);
  let tempPassword = '';
  for (let i = 0; i < 12; i++) {
    tempPassword += chars.charAt(randomBytes[i] % chars.length);
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const updated = await storage.updateUser(req.params.id, {
    passwordHash,
    forcePasswordChange: true // Force password change on next login
  });
  if (!updated) {
    throw new NotFoundError("User");
  }

  // Send password reset email
  const emailResult = await sendPasswordResetEmail(user.email, tempPassword, 'fr');

  if (!emailResult.success) {
    // Password was reset but email failed - return the password for manual sharing
    return res.json({
      success: true,
      emailSent: false,
      tempPassword, // Return password since email failed
      warning: "Le mot de passe a été réinitialisé mais l'envoi du courriel a échoué. Partagez le mot de passe manuellement."
    });
  }

  res.json({ success: true, emailSent: true, message: "Password reset and emailed successfully" });
}));

// Resend welcome email (admin only) - generates new temp password and resends
router.post("/api/users/:id/resend-welcome", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  // Only admins can resend welcome emails
  if (req.userRole !== "admin") {
    throw new ForbiddenError("Admin access required");
  }

  // Get user info
  const user = await storage.getUser(req.params.id);
  if (!user) {
    throw new NotFoundError("User");
  }

  // Generate cryptographically secure temporary password
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const randomBytes = crypto.randomBytes(12);
  let tempPassword = '';
  for (let i = 0; i < 12; i++) {
    tempPassword += chars.charAt(randomBytes[i] % chars.length);
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await storage.updateUser(req.params.id, {
    passwordHash,
    forcePasswordChange: true
  });

  // Send welcome email with new password
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'https';
  const host = req.get('host') || 'localhost:5000';
  const baseUrl = `${protocol}://${host}`;

  const emailResult = await sendWelcomeEmail({
    userEmail: user.email,
    userName: user.name || undefined,
    userRole: user.role,
    tempPassword,
  }, baseUrl, 'fr');

  if (!emailResult.success) {
    return res.json({
      success: true,
      emailSent: false,
      tempPassword,
      warning: "Le nouveau mot de passe a été généré mais l'envoi du courriel a échoué."
    });
  }

  res.json({ success: true, emailSent: true, message: "Welcome email resent successfully" });
}));

export default router;
