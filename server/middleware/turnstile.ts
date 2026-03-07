import { Request, Response, NextFunction } from "express";

export async function verifyTurnstile(req: Request, res: Response, next: NextFunction) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) { return next(); }

  const token = req.body?.["cf-turnstile-response"];
  if (!token) {
    return res.status(400).json({
      error: "CAPTCHA verification required. Please complete the security check.",
      code: "TURNSTILE_MISSING"
    });
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    formData.append("remoteip", req.ip || "");

    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const outcome = await result.json() as { success: boolean; "error-codes"?: string[] };

    if (!outcome.success) {
      console.warn("[Turnstile] Verification failed:", outcome["error-codes"]);
      return res.status(403).json({
        error: "Security verification failed. Please try again.",
        code: "TURNSTILE_FAILED"
      });
    }

    if (req.body) delete req.body["cf-turnstile-response"];
    next();
  } catch (err) {
    console.error("[Turnstile] API error:", err);
    next();
  }
}
