import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import { createLogger } from "./lib/logger";

const log = createLogger("ProcurationPDF");

interface ProcurationData {
  hqAccountNumber: string;
  contactName: string;
  signerTitle: string;
  signatureCity: string;
  signatureImage?: string;
  procurationDate: Date;
  procurationEndDate: Date;
  ipAddress?: string;
  userAgent?: string;
  companyName?: string;
  streetAddress?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

const MANDATAIRE = {
  contactName: "La Barre, Marc-André",
  title: "Chef des opérations",
  phone: "514-427-8871",
  cellulaire: "514-891-8199",
  address: "1010 William, Suite 715, Montréal, QC H3C 0K8",
};

const TEXT_POSITIONS = {
  clientNoCompte: { x: 99, y: 638 },      // Moved higher (+5)
  clientNomPrenom: { x: 99, y: 604 },
  clientFonction: { x: 400, y: 604 },     // Adjusted right for longer titles
  mandataireNom: { x: 99, y: 566 },
  mandataireFonction: { x: 290, y: 566 },
  mandataireTel: { x: 400, y: 566 },      // Moved right (+31)
  mandataireCellulaire: { x: 510, y: 566 }, // Moved further right (+25 more)
  mandataireAddress: { x: 99, y: 540 },
  dureeDebut: { x: 157, y: 215 },         // Lowered ~1cm to be on line
  dureeFin: { x: 382, y: 215 },           // Lowered ~1cm to be on line
  signeeA: { x: 75, y: 150 },             // Moved right (+20) and lowered more
  signatureLe: { x: 425, y: 150 },        // Lowered more to match
  signataireNom: { x: 425, y: 124 },      // Lowered more to be on line
  signature: { x: 70, y: 97 },            // Lowered ~5mm more
};

// Format name as "LASTNAME, Firstname"
function formatNameLastFirst(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase();
  // Assume last word is the last name
  const lastName = parts[parts.length - 1].toUpperCase();
  const firstName = parts.slice(0, -1).join(' ');
  return `${lastName}, ${firstName}`;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }
  return result;
}

function formatDateFr(date: Date): string {
  // Use Eastern Time (Quebec timezone)
  return date.toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    timeZone: 'America/Montreal'
  });
}

function formatDateShort(date: Date): string {
  // Use Eastern Time (Quebec timezone) for consistent date formatting
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Montreal'
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
}

export async function generateProcurationPDF(data: ProcurationData): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), "server/templates/procuration_hq_template.pdf");
  const existingPdfBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const page = pdfDoc.getPage(0);
  const fontSize = 10;
  const smallFontSize = 8;
  const textColor = rgb(0, 0, 0);
  
  page.drawText(data.hqAccountNumber, {
    x: TEXT_POSITIONS.clientNoCompte.x,
    y: TEXT_POSITIONS.clientNoCompte.y,
    size: fontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  // Format name as "LASTNAME, Firstname"
  page.drawText(formatNameLastFirst(data.contactName), {
    x: TEXT_POSITIONS.clientNomPrenom.x,
    y: TEXT_POSITIONS.clientNomPrenom.y,
    size: fontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  // Use signer's title/function from form data
  page.drawText(data.signerTitle || '', {
    x: TEXT_POSITIONS.clientFonction.x,
    y: TEXT_POSITIONS.clientFonction.y,
    size: fontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  page.drawText(MANDATAIRE.contactName, {
    x: TEXT_POSITIONS.mandataireNom.x,
    y: TEXT_POSITIONS.mandataireNom.y,
    size: smallFontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  page.drawText(MANDATAIRE.title, {
    x: TEXT_POSITIONS.mandataireFonction.x,
    y: TEXT_POSITIONS.mandataireFonction.y,
    size: smallFontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  page.drawText(MANDATAIRE.phone, {
    x: TEXT_POSITIONS.mandataireTel.x,
    y: TEXT_POSITIONS.mandataireTel.y,
    size: smallFontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  page.drawText(MANDATAIRE.cellulaire, {
    x: TEXT_POSITIONS.mandataireCellulaire.x,
    y: TEXT_POSITIONS.mandataireCellulaire.y,
    size: smallFontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  // Always use kWh Québec address for mandataire
  page.drawText(MANDATAIRE.address, {
    x: TEXT_POSITIONS.mandataireAddress.x,
    y: TEXT_POSITIONS.mandataireAddress.y,
    size: smallFontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  page.drawText(formatDateShort(data.procurationDate), {
    x: TEXT_POSITIONS.dureeDebut.x,
    y: TEXT_POSITIONS.dureeDebut.y,
    size: fontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  page.drawText(formatDateShort(data.procurationEndDate), {
    x: TEXT_POSITIONS.dureeFin.x,
    y: TEXT_POSITIONS.dureeFin.y,
    size: fontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  page.drawText(data.signatureCity, {
    x: TEXT_POSITIONS.signeeA.x,
    y: TEXT_POSITIONS.signeeA.y,
    size: fontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  page.drawText(formatDateShort(data.procurationDate), {
    x: TEXT_POSITIONS.signatureLe.x,
    y: TEXT_POSITIONS.signatureLe.y,
    size: fontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  // Format signataire name as "LASTNAME, Firstname"
  page.drawText(formatNameLastFirst(data.contactName), {
    x: TEXT_POSITIONS.signataireNom.x,
    y: TEXT_POSITIONS.signataireNom.y,
    size: fontSize,
    font: helveticaFont,
    color: textColor,
  });
  
  if (data.signatureImage) {
    try {
      const base64Data = data.signatureImage.replace(/^data:image\/\w+;base64,/, "");
      const signatureBuffer = Buffer.from(base64Data, "base64");
      const signatureImage = await pdfDoc.embedPng(signatureBuffer);
      
      const dims = signatureImage.scale(0.35);
      const signatureWidth = Math.min(dims.width, 180);
      const signatureHeight = Math.min(dims.height, 40);
      
      page.drawImage(signatureImage, {
        x: TEXT_POSITIONS.signature.x,
        y: TEXT_POSITIONS.signature.y,
        width: signatureWidth,
        height: signatureHeight,
      });
    } catch (e) {
      log.info("Error adding signature image:", e);
    }
  }
  
  const metadataY = 30;
  const metadataFontSize = 7;
  
  page.drawText(
    `Signé électroniquement le ${formatDateFr(data.procurationDate)} via la plateforme kWh Québec`,
    {
      x: 50,
      y: metadataY + 20,
      size: metadataFontSize,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    }
  );
  
  if (data.ipAddress) {
    page.drawText(
      `IP: ${data.ipAddress}`,
      {
        x: 50,
        y: metadataY + 10,
        size: metadataFontSize,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      }
    );
  }
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export function createProcurationData(
  formData: {
    companyName?: string;
    contactName: string;
    signerTitle: string;
    hqAccountNumber: string;
    streetAddress?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    signatureCity: string;
    signatureImage?: string;
    procurationDate?: string;
  },
  ipAddress?: string,
  userAgent?: string
): ProcurationData {
  const signatureDate = formData.procurationDate 
    ? new Date(formData.procurationDate) 
    : new Date();
  
  // Procuration valid for 30 calendar days from signature
  const endDate = new Date(signatureDate);
  endDate.setDate(endDate.getDate() + 30);
  
  return {
    hqAccountNumber: formData.hqAccountNumber,
    contactName: formData.contactName,
    signerTitle: formData.signerTitle,
    signatureCity: formData.signatureCity,
    signatureImage: formData.signatureImage,
    procurationDate: signatureDate,
    procurationEndDate: endDate,
    ipAddress,
    userAgent,
    companyName: formData.companyName,
    streetAddress: formData.streetAddress,
    city: formData.city,
    province: formData.province,
    postalCode: formData.postalCode,
  };
}

export function generateProcurationPDFLegacy(
  doc: any,
  data: ProcurationData
): void {
  log.warn("Legacy generateProcurationPDF called - use async version instead");
}
