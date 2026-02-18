import fs from "fs";
import path from "path";
import { createLogger } from "./lib/logger";

const log = createLogger("EmailLogo");

const logoBase64Cache: Record<string, string | null> = {};

function loadLogoBase64(lang: 'fr' | 'en'): string {
  if (logoBase64Cache[lang]) return logoBase64Cache[lang]!;
  const logoPath = path.resolve(process.cwd(), `server/assets/email/logo-${lang}.png`);
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    const dataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    logoBase64Cache[lang] = dataUri;
    log.info(`Loaded email logo (${lang}): ${Math.round(logoBuffer.length / 1024)}KB`);
    return dataUri;
  } catch (err: any) {
    log.error(`Failed to read email logo at ${logoPath}: ${err.message}`);
    return '';
  }
}

export function getLogoDataUri(lang: 'fr' | 'en'): string {
  return loadLogoBase64(lang);
}
