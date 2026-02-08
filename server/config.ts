import { createLogger } from "./lib/logger";

const log = createLogger("Config");

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, defaultValue?: string): string | undefined {
  return process.env[name] || defaultValue;
}

/**
 * Centralized environment configuration.
 * All env vars should be accessed through this module.
 * Required vars throw at import time (fail fast).
 */
export const config = {
  // --- Required ---
  DATABASE_URL: required("DATABASE_URL"),
  SESSION_SECRET: required("SESSION_SECRET"),

  // --- Server ---
  NODE_ENV: optional("NODE_ENV", "development") as string,
  PORT: parseInt(optional("PORT", "5000") as string, 10),
  LOG_LEVEL: optional("LOG_LEVEL", "info") as string,

  // --- Google APIs ---
  GOOGLE_SOLAR_API_KEY: optional("GOOGLE_SOLAR_API_KEY"),
  VITE_GOOGLE_MAPS_API_KEY: optional("VITE_GOOGLE_MAPS_API_KEY"),

  // --- Gemini AI ---
  AI_INTEGRATIONS_GEMINI_API_KEY: optional("AI_INTEGRATIONS_GEMINI_API_KEY"),
  AI_INTEGRATIONS_GEMINI_BASE_URL: optional("AI_INTEGRATIONS_GEMINI_BASE_URL"),

  // --- Replit ---
  REPLIT_DOMAINS: optional("REPLIT_DOMAINS"),
  REPLIT_DEPLOYMENT_URL: optional("REPLIT_DEPLOYMENT_URL"),
  REPLIT_DEV_DOMAIN: optional("REPLIT_DEV_DOMAIN"),
  REPLIT_DEPLOYMENT: optional("REPLIT_DEPLOYMENT"),
  REPLIT_CONNECTORS_HOSTNAME: optional("REPLIT_CONNECTORS_HOSTNAME"),
  REPL_IDENTITY: optional("REPL_IDENTITY"),
  WEB_REPL_RENEWAL: optional("WEB_REPL_RENEWAL"),

  // --- Object Storage ---
  PRIVATE_OBJECT_DIR: optional("PRIVATE_OBJECT_DIR"),
  PUBLIC_OBJECT_SEARCH_PATHS: optional("PUBLIC_OBJECT_SEARCH_PATHS"),

  // --- Helpers ---
  get isProduction() {
    return this.NODE_ENV === "production" || this.REPLIT_DEPLOYMENT === "1";
  },
  get baseUrl(): string {
    const domain = this.REPLIT_DOMAINS?.split(",")[0];
    return domain ? `https://${domain}` : `http://localhost:${this.PORT}`;
  },
} as const;

// Log startup config summary (no secrets)
log.info(`Config loaded: env=${config.NODE_ENV}, port=${config.PORT}, production=${config.isProduction}`);
if (!config.GOOGLE_SOLAR_API_KEY) log.warn("GOOGLE_SOLAR_API_KEY not set — Solar API features disabled");
if (!config.AI_INTEGRATIONS_GEMINI_API_KEY) log.warn("AI_INTEGRATIONS_GEMINI_API_KEY not set — Gemini features disabled");
