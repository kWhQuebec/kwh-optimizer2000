/**
 * Client Isolation Middleware
 * Ensures clients can only access their own data.
 * Staff (admin/analyst) bypass — they see everything.
 * 
 * Usage in routes:
 *   router.get('/sites', authMiddleware, requireClientIsolation('sites'), handler)
 *   router.get('/leads/:id', authMiddleware, requireOwnership('leads'), handler)
 */

import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Middleware: filter list queries by clientId.
 * Attaches req.clientFilter for use in route handlers.
 * Staff see all; clients see only their own records.
 */
export function requireClientIsolation(tableName?: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.userRole;
    const userClientId = req.userClientId;

    // Staff bypass — see everything
    if (userRole === "admin" || userRole === "analyst") {
      (req as any).clientFilter = null;
      return next();
    }

    // Client must have a clientId
    if (!userClientId) {
      return res.status(403).json({
        error: "Access denied: no client association found",
      });
    }

    // Attach filter for route handlers to use
    (req as any).clientFilter = {
      clientId: userClientId,
      table: tableName || null,
    };

    next();
  };
}

/**
 * Middleware: verify ownership of a specific resource by ID.
 * Checks that the resource's client_id matches the requesting user's clientId.
 * Staff bypass — they can access any resource.
 */
export function requireOwnership(tableName: string, idParam: string = "id") {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userRole = req.userRole;
      const userClientId = req.userClientId;
      const resourceId = req.params[idParam];

      // Staff bypass
      if (userRole === "admin" || userRole === "analyst") {
        return next();
      }

      // Client must have a clientId
      if (!userClientId) {
        return res.status(403).json({
          error: "Access denied: no client association found",
        });
      }

      if (!resourceId) {
        return res.status(400).json({
          error: "Resource ID is required",
        });
      }

      // Query the resource to check ownership
      const result = await db.execute(
        sql`SELECT client_id FROM ${sql.raw(tableName)} WHERE id = ${resourceId} LIMIT 1`
      );

      const rows = result.rows || result;
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: "Resource not found" });
      }

      const resourceClientId = (rows[0] as any).client_id;
      if (String(resourceClientId) !== String(userClientId)) {
        return res.status(403).json({
          error: "Access denied: you do not own this resource",
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Helper: apply client filter to a Drizzle query.
 * Use in route handlers after requireClientIsolation middleware.
 * 
 * Example:
 *   const filter = getClientFilter(req);
 *   let query = db.select().from(sites);
 *   if (filter) {
 *     query = query.where(eq(sites.clientId, filter.clientId));
 *   }
 *   const results = await query;
 */
export function getClientFilter(req: AuthRequest): { clientId: string } | null {
  return (req as any).clientFilter || null;
}
