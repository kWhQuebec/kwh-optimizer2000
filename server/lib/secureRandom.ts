import crypto from "crypto";

/**
 * Generate cryptographically secure random string without modulo bias
 * Uses rejection sampling to ensure uniform distribution
 */
export function generateSecurePassword(length: number = 12): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const charsetLength = charset.length;

  // Calculate the largest multiple of charsetLength that fits in a byte
  // This eliminates modulo bias
  const maxValid = Math.floor(256 / charsetLength) * charsetLength;

  let result = "";

  while (result.length < length) {
    const randomBytes = crypto.randomBytes(length - result.length);

    for (let i = 0; i < randomBytes.length; i++) {
      const byte = randomBytes[i];
      // Reject bytes that would cause modulo bias
      if (byte < maxValid) {
        result += charset[byte % charsetLength];
        if (result.length === length) break;
      }
    }
  }

  return result;
}

/**
 * Generate a secure token for password reset links
 * Returns URL-safe base64 string
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate a short numeric verification code
 */
export function generateVerificationCode(digits: number = 6): string {
  const max = Math.pow(10, digits);
  const randomNumber = crypto.randomInt(0, max);
  return randomNumber.toString().padStart(digits, "0");
}
