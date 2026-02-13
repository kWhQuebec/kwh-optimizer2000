import path from "path";

/**
 * Validates that a filename or path component doesn't contain path traversal attempts.
 * Returns the sanitized basename, or throws if the input is suspicious.
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path components — only keep the basename
  const basename = path.basename(filename);

  // Block suspicious patterns
  if (
    basename.includes("..") ||
    basename.includes("\0") ||
    basename.startsWith(".") ||
    /[<>:"|?*]/.test(basename)
  ) {
    throw new Error(`Invalid filename: ${basename}`);
  }

  return basename;
}

/**
 * Validates that a resolved file path stays within the allowed base directory.
 * Prevents path traversal attacks via ../
 */
export function validatePathWithinBase(filePath: string, baseDir: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }

  return resolvedPath;
}

/**
 * Sanitize a referenceId to be safe for use in file paths and database lookups.
 * Only allows alphanumeric, hyphens, and underscores.
 */
export function sanitizeReferenceId(referenceId: string): string {
  const sanitized = referenceId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (sanitized.length === 0) {
    throw new Error("Invalid reference ID");
  }
  return sanitized;
}
