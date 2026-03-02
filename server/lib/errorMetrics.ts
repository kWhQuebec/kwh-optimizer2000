import { createLogger } from "./logger";

const log = createLogger("ErrorMetrics");

interface ErrorMetric {
  count: number;
  lastSeen: string;
  lastMessage: string;
}

interface RequestMetrics {
  totalRequests: number;
  totalErrors: number;
  errorsByStatus: Record<number, number>;
  errorsByPath: Record<string, ErrorMetric>;
  startedAt: string;
  lastErrorAt: string | null;
  unhandledRejections: number;
  uncaughtExceptions: number;
}

const metrics: RequestMetrics = {
  totalRequests: 0,
  totalErrors: 0,
  errorsByStatus: {},
  errorsByPath: {},
  startedAt: new Date().toISOString(),
  lastErrorAt: null,
  unhandledRejections: 0,
  uncaughtExceptions: 0,
};

export function trackRequest(): void {
  metrics.totalRequests++;
}

export function trackError(statusCode: number, path: string, message: string): void {
  metrics.totalErrors++;
  metrics.lastErrorAt = new Date().toISOString();
  metrics.errorsByStatus[statusCode] = (metrics.errorsByStatus[statusCode] || 0) + 1;
  
  if (!metrics.errorsByPath[path]) {
    metrics.errorsByPath[path] = { count: 0, lastSeen: "", lastMessage: "" };
  }
  metrics.errorsByPath[path].count++;
  metrics.errorsByPath[path].lastSeen = new Date().toISOString();
  metrics.errorsByPath[path].lastMessage = message.substring(0, 200);
}

export function trackUnhandledRejection(): void {
  metrics.unhandledRejections++;
  metrics.lastErrorAt = new Date().toISOString();
}

export function trackUncaughtException(): void {
  metrics.uncaughtExceptions++;
  metrics.lastErrorAt = new Date().toISOString();
}

export function getMetrics(): RequestMetrics & { uptimeSeconds: number; errorRate: string } {
  const uptimeSeconds = Math.floor((Date.now() - new Date(metrics.startedAt).getTime()) / 1000);
  const errorRate = metrics.totalRequests > 0 
    ? ((metrics.totalErrors / metrics.totalRequests) * 100).toFixed(2) + "%"
    : "0%";
  return { ...metrics, uptimeSeconds, errorRate };
}

export function resetMetrics(): void {
  metrics.totalRequests = 0;
  metrics.totalErrors = 0;
  metrics.errorsByStatus = {};
  metrics.errorsByPath = {};
  metrics.lastErrorAt = null;
  metrics.unhandledRejections = 0;
  metrics.uncaughtExceptions = 0;
}
