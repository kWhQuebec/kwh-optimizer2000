import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

// Ensure upload directories exist
const UPLOAD_BASE = process.cwd();
const METER_UPLOADS_DIR = path.join(UPLOAD_BASE, "uploads", "meters");
const SITE_VISIT_DIR = path.join(UPLOAD_BASE, "uploads", "site-visits");
const PROCURATIONS_DIR = path.join(UPLOAD_BASE, "uploads", "procurations");
const SIGNATURES_DIR = path.join(UPLOAD_BASE, "uploads", "signatures");

[METER_UPLOADS_DIR, SITE_VISIT_DIR, PROCURATIONS_DIR, SIGNATURES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Generate unique filename to prevent collisions
 */
function generateUniqueFilename(originalname: string): string {
  const ext = path.extname(originalname);
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  return `${timestamp}-${random}${ext}`;
}

/**
 * Multer storage with size limits and unique filenames for CSV/meter files
 */
export const meterUpload = multer({
  storage: multer.diskStorage({
    destination: METER_UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, generateUniqueFilename(file.originalname)),
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["text/csv", "application/vnd.ms-excel", "text/plain"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only CSV files are allowed."));
    }
  },
});

/**
 * Multer storage for site visit photos
 */
export const siteVisitUpload = multer({
  storage: multer.diskStorage({
    destination: SITE_VISIT_DIR,
    filename: (req, file, cb) => cb(null, generateUniqueFilename(file.originalname)),
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB for photos
    files: 20,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, WebP and HEIC images are allowed."));
    }
  },
});

/**
 * Safe file deletion helper
 */
export async function safeDeleteFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    // Log but don't throw - file might already be deleted
    console.warn(`Could not delete file ${filePath}:`, error);
  }
}

/**
 * Cleanup old temp files (call periodically)
 */
export async function cleanupOldUploads(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  let deleted = 0;
  const now = Date.now();

  for (const dir of [METER_UPLOADS_DIR, SITE_VISIT_DIR]) {
    try {
      const files = await fs.promises.readdir(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.promises.stat(filePath);

        if (now - stats.mtimeMs > maxAgeMs) {
          await safeDeleteFile(filePath);
          deleted++;
        }
      }
    } catch (error) {
      console.error(`Error cleaning up ${dir}:`, error);
    }
  }

  return deleted;
}

// Export directory constants for use elsewhere
export const UPLOAD_DIRS = {
  meters: METER_UPLOADS_DIR,
  siteVisits: SITE_VISIT_DIR,
  procurations: PROCURATIONS_DIR,
  signatures: SIGNATURES_DIR,
};
