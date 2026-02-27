/**
 * Stripe Validation Middleware
 * Wraps Stripe API calls with proper error handling, input validation,
 * idempotency checks, and structured logging.
 * 
 * Fixes identified by Improvement Agent:
 * - No try/catch around stripe.checkout.sessions.create()
 * - No sessionId validation on confirm-payment
 * - No idempotency check (calling twice could double-confirm)
 * - payment_intent forced to string (could be null)
 * - No email format validation
 * - No rate limiting context
 */

import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";

// ── Types ──────────────────────────────────────────────────────────────

export interface StripeError {
  type: "card_error" | "api_error" | "idempotency_error" | "validation_error" | "unknown";
  message: string;
  code?: string;
  statusCode: number;
}

// ── Input Validators ───────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_LANGUAGES = ["fr", "en"] as const;

/**
 * Validate checkout request body before hitting Stripe.
 * Returns null if valid, error message if invalid.
 */
export function validateCheckoutInput(body: any): string | null {
  const { name, email, signatureData, language } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return "Name is required and must be at least 2 characters";
  }

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return "A valid email address is required";
  }

  if (!signatureData || typeof signatureData !== "string") {
    return "Signature data is required";
  }

  if (signatureData.length > 500000) {
    return "Signature data exceeds maximum size";
  }

  if (language && !VALID_LANGUAGES.includes(language as any)) {
    return "Language must be 'fr' or 'en'";
  }

  return null;
}

/**
 * Validate confirm-payment request body.
 */
export function validateConfirmPaymentInput(body: any): string | null {
  const { sessionId } = body;

  if (!sessionId || typeof sessionId !== "string") {
    return "Session ID is required";
  }

  // Stripe session IDs start with "cs_"
  if (!sessionId.startsWith("cs_")) {
    return "Invalid session ID format";
  }

  if (sessionId.length > 200) {
    return "Session ID exceeds maximum length";
  }

  return null;
}

// ── Stripe Error Handler ───────────────────────────────────────────────

/**
 * Parse a Stripe error into a structured format.
 * Prevents leaking internal error details to clients.
 */
export function parseStripeError(error: unknown): StripeError {
  if (error instanceof Stripe.errors.StripeError) {
    switch (error.type) {
      case "StripeCardError":
        return {
          type: "card_error",
          message: error.message || "Your card was declined",
          code: error.code || undefined,
          statusCode: 402,
        };
      case "StripeRateLimitError":
        return {
          type: "api_error",
          message: "Too many requests. Please try again in a moment.",
          statusCode: 429,
        };
      case "StripeInvalidRequestError":
        return {
          type: "validation_error",
          message: "Invalid payment request. Please check your information.",
          code: error.code || undefined,
          statusCode: 400,
        };
      case "StripeAuthenticationError":
        return {
          type: "api_error",
          message: "Payment system configuration error. Please contact support.",
          statusCode: 500,
        };
      case "StripeAPIError":
        return {
          type: "api_error",
          message: "Payment service temporarily unavailable. Please try again.",
          statusCode: 503,
        };
      case "StripeConnectionError":
        return {
          type: "api_error",
          message: "Unable to connect to payment service. Please try again.",
          statusCode: 503,
        };
      case "StripeIdempotencyError":
        return {
          type: "idempotency_error",
          message: "This payment request was already processed.",
          statusCode: 409,
        };
      default:
        return {
          type: "unknown",
          message: "An unexpected payment error occurred.",
          statusCode: 500,
        };
    }
  }

  // Non-Stripe errors
  return {
    type: "unknown",
    message: "An unexpected error occurred during payment processing.",
    statusCode: 500,
  };
}

// ── Middleware ──────────────────────────────────────────────────────────

/**
 * Express middleware: validate checkout input before route handler.
 */
export function validateCheckout(req: Request, res: Response, next: NextFunction) {
  const error = validateCheckoutInput(req.body);
  if (error) {
    return res.status(400).json({ error, success: false });
  }
  next();
}

/**
 * Express middleware: validate confirm-payment input before route handler.
 */
export function validateConfirmPayment(req: Request, res: Response, next: NextFunction) {
  const error = validateConfirmPaymentInput(req.body);
  if (error) {
    return res.status(400).json({ error, success: false });
  }
  next();
}

// ── Safe Stripe Wrappers ───────────────────────────────────────────────

/**
 * Safely create a Stripe checkout session with error handling.
 * Returns { session } on success, { error } on failure.
 */
export async function safeCreateCheckoutSession(
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams
): Promise<{ session?: Stripe.Checkout.Session; error?: StripeError }> {
  try {
    const session = await stripe.checkout.sessions.create(params);

    if (!session.url) {
      return {
        error: {
          type: "api_error",
          message: "Checkout session created but no URL returned.",
          statusCode: 500,
        },
      };
    }

    return { session };
  } catch (err) {
    const stripeError = parseStripeError(err);
    console.error("[Stripe] Checkout session creation failed:", {
      type: stripeError.type,
      code: stripeError.code,
      message: stripeError.message,
    });
    return { error: stripeError };
  }
}

/**
 * Safely retrieve a Stripe checkout session with error handling.
 * Returns { session } on success, { error } on failure.
 */
export async function safeRetrieveSession(
  stripe: Stripe,
  sessionId: string
): Promise<{ session?: Stripe.Checkout.Session; error?: StripeError }> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return { session };
  } catch (err) {
    const stripeError = parseStripeError(err);
    console.error("[Stripe] Session retrieval failed:", {
      sessionId,
      type: stripeError.type,
      message: stripeError.message,
    });
    return { error: stripeError };
  }
}

/**
 * Check if an agreement has already been confirmed (idempotency guard).
 * Prevents double-confirmation of payments.
 */
export function isAlreadyConfirmed(agreement: any): boolean {
  return (
    agreement.status === "accepted" &&
    agreement.depositPaidAt != null &&
    agreement.stripePaymentIntentId != null
  );
}

/**
 * Safely extract payment_intent from a Stripe session.
 * Handles null/undefined/object cases.
 */
export function extractPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  if (typeof pi === "string") return pi;
  if (typeof pi === "object" && "id" in pi) return pi.id;
  return null;
}
