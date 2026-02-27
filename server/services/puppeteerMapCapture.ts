import puppeteer from "puppeteer";
import { createLogger } from "../lib/logger";
import { storage } from "../storage";
import jwt from "jsonwebtoken";

const log = createLogger("PuppeteerMapCapture");

interface CaptureParams {
  siteId: string;
  pvSizeKW?: number;
  width?: number;
  height?: number;
}

async function getInternalToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");

  const users = await storage.getUsers();
  const admin = users.find(u => u.role === "admin");
  if (!admin) throw new Error("No admin user found for internal token");

  return jwt.sign({ userId: admin.id }, secret, { expiresIn: "2m" });
}

export async function captureRoofVisualization(params: CaptureParams): Promise<Buffer | null> {
  const {
    siteId,
    pvSizeKW = 0,
    width = 1728,
    height = 1080,
  } = params;

  const token = await getInternalToken();

  const port = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${port}`;
  const captureUrl = `${baseUrl}/roof-capture?siteId=${encodeURIComponent(siteId)}&pvSizeKW=${pvSizeKW}`;

  log.info(`Navigating to roof-capture page: siteId=${siteId}, pvSizeKW=${pvSizeKW}, viewport=${width}x${height}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });

    await page.evaluateOnNewDocument((t: string) => {
      (window as any).__captureToken = t;
      localStorage.setItem("kwh-cookie-consent", "accepted");
    }, token);

    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === "error") {
        log.warn(`[Browser:error] ${text}`);
      } else if (text.includes("[RoofVisualization]") || text.includes("panelsToShow")) {
        log.info(`[Browser] ${text}`);
      }
    });

    page.on("pageerror", (err) => {
      log.error(`[Browser PAGE ERROR] ${err.message}`);
    });

    await page.goto(captureUrl, { waitUntil: "networkidle0", timeout: 45000 });

    await page.waitForFunction("window.__captureReady === true", { timeout: 30000 }).catch(() => {
      log.warn("Capture ready signal not received within 30s, proceeding anyway");
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height },
    });

    log.info(`Puppeteer roof capture successful: ${screenshot.length} bytes`);
    return Buffer.from(screenshot);
  } catch (err) {
    log.error("Puppeteer roof capture failed:", err);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}
