import { env } from "./config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { errorHandler } from "./middleware/errorHandler";
import { createLogger } from "./lib/logger";
import { startUploadCleanupScheduler } from "./lib/uploadConfig";
import { startEmailScheduler } from "./emailScheduler";
import { renderEmailTemplate } from "./emailTemplates";
import { storage } from "./storage";
import { seedDefaultContent } from "./seedContent";
import helmet from "helmet";
import cors from "cors";

const serverLog = createLogger("Server");

const app = express();

const isProduction = env.NODE_ENV === "production";
const scriptSrcDirective: string[] = isProduction
  ? ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://maps.googleapis.com", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://js.stripe.com"]
  : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://maps.googleapis.com", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://js.stripe.com"];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: scriptSrcDirective,
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https:", "wss:"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: env.NODE_ENV === "production"
    ? [/\.kwh\.quebec$/, /\.replit\.dev$/, /\.repl\.co$/]
    : true,
  credentials: true,
}));

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function initStripe() {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    serverLog.info('DATABASE_URL not set, skipping Stripe initialization');
    return;
  }

  try {
    serverLog.info('Initializing Stripe schema...');
    await runMigrations({
      databaseUrl,
      schema: 'stripe'
    } as Parameters<typeof runMigrations>[0]);
    serverLog.info('Stripe schema ready');

    const stripeSync = await getStripeSync();

    serverLog.info('Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      {
        enabled_events: ['checkout.session.completed', 'payment_intent.succeeded', 'payment_intent.payment_failed'],
        description: 'kWh Québec design agreement payments',
      }
    );
    serverLog.info(`Webhook configured: ${webhook.url} (UUID: ${uuid})`);

    serverLog.info('Syncing Stripe data...');
    stripeSync.syncBackfill()
      .then(() => {
        serverLog.info('Stripe data synced');
      })
      .catch((err: any) => {
        serverLog.error('Error syncing Stripe data:', err);
      });
  } catch (error) {
    serverLog.error('Failed to initialize Stripe:', error);
  }
}

// initStripe is called inside the async IIFE at the bottom of this file

app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        serverLog.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

      res.status(200).json({ received: true });
    } catch (error: any) {
      serverLog.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  express.json({
    limit: '15mb',  // Increased for base64 image uploads (visualization captures)
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const sourceLog = createLogger(source);
  sourceLog.info(message);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await initStripe();
  await registerRoutes(httpServer, app);
  startUploadCleanupScheduler();

  // Start email scheduler for nurture sequences
  const stopEmailScheduler = startEmailScheduler({
    storage,
    sendTemplateEmail: async (templateKey, to, data, lang) => {
      const { sendTemplateEmail: send } = await import("./emailService");
      return send(templateKey, to, data, lang);
    },
    getLeadById: async (id) => {
      return storage.getLead(id);
    },
  });
  serverLog.info("Email scheduler initialized");

  // Start daily news fetch scheduler at 16:00 Montreal time
  const { runNewsFetchJob } = await import("./services/newsJobRunner");
  const { sendNewsCollectionNotification } = await import("./services/newsNotificationService");

  const { fromZonedTime } = await import("date-fns-tz");

  function scheduleNextNewsFetch() {
    const tz = "America/Montreal";
    const now = new Date();

    const montrealFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const p = montrealFmt.formatToParts(now);
    const g = (t: string) => p.find(x => x.type === t)?.value || "0";
    const y = parseInt(g("year")), m = parseInt(g("month")), d = parseInt(g("day"));
    const h = parseInt(g("hour")), min = parseInt(g("minute"));

    let targetDay = d;
    if (h > 16 || (h === 16 && min >= 0)) targetDay++;

    const montrealTarget = new Date(y, m - 1, targetDay, 16, 0, 0, 0);
    const targetUtc = fromZonedTime(montrealTarget, tz);

    let msUntilTarget = targetUtc.getTime() - now.getTime();
    if (msUntilTarget <= 0) {
      const nextDay = new Date(y, m - 1, targetDay + 1, 16, 0, 0, 0);
      const nextUtc = fromZonedTime(nextDay, tz);
      msUntilTarget = nextUtc.getTime() - now.getTime();
      serverLog.info(`Next news fetch scheduled in ${Math.round(msUntilTarget / 60000)} minutes (16:00 Montreal time, target UTC: ${nextUtc.toISOString()})`);
    } else {
      serverLog.info(`Next news fetch scheduled in ${Math.round(msUntilTarget / 60000)} minutes (16:00 Montreal time, target UTC: ${targetUtc.toISOString()})`);
    }

    setTimeout(async () => {
      try {
        serverLog.info("Running scheduled news fetch (16:00 Montreal)...");
        const result = await runNewsFetchJob(storage);
        serverLog.info(`Scheduled news fetch complete: ${result.newArticles} new, ${result.analyzed} analyzed`);
        await sendNewsCollectionNotification(result);
      } catch (error) {
        serverLog.error("Scheduled news fetch failed:", error);
      }
      scheduleNextNewsFetch();
    }, msUntilTarget);
  }
  scheduleNextNewsFetch();
  serverLog.info("News fetch scheduler initialized (daily at 16:00 Montreal time)");

  // Seed default CMS content if empty
  await seedDefaultContent();

  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(env.PORT, 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
