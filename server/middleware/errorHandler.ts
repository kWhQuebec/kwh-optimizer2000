import { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodError } from "zod";
import { AuthRequest } from "./auth";
import { createLogger } from "../lib/logger";

const log = createLogger("ErrorHandler");

export class AppError extends Error {
  public details?: unknown[];
  
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown[]) {
    super(400, message);
    this.name = "BadRequestError";
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public validationDetails: unknown[]) {
    super(400, message);
    this.name = "ValidationError";
    this.details = validationDetails;
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown[]) {
    super(409, message);
    this.name = "ConflictError";
    this.details = details;
  }
}

type AsyncRequestHandler = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthRequest, res, next)).catch(next);
  };
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const authReq = req as AuthRequest;
  
  const logContext = {
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: authReq.userId,
    userRole: authReq.userRole,
  };

  if (err instanceof AppError) {
    if (!err.isOperational) {
      log.error("Non-operational error:", logContext);
    }
    const response: { error: string; details?: unknown[] } = { error: err.message };
    if (err.details) {
      response.details = err.details;
    }
    return res.status(err.statusCode).json(response);
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.errors,
    });
  }

  log.error("Unhandled error:", logContext);

  res.status(500).json({ error: "Internal server error" });
}
