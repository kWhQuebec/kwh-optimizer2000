import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

interface ProcurationData {
  companyName: string;
  contactName: string;
  signerTitle: string;
  hqAccountNumber: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode?: string;
  signatureImage?: string;
  procurationDate: Date;
  procurationEndDate: Date;
  ipAddress?: string;
  userAgent?: string;
}

const MANDATAIRE = {
  companyName: "kWh Québec",
  contactName: "Marc-André La Barre",
  title: "Chef des opérations",
  phone: "514-427-8871",
  fax: "514-891-8199",
};

// Field names from the HQ PDF template mapped to their purpose
// Sorted by yFromTop (top of page first) for clarity
const HQ_FIELDS = {
  // TOP SECTION - Mandant (Client) info - yFromTop ~186-260
  mandantNom: "7029000000028423",           // yFromTop=186, x=99, w=497 - Nom du mandant (ligne 1)
  mandantAdresse: "7029000000028424",        // yFromTop=220, x=99, w=497 - Adresse (ligne 2, gauche)
  mandantVille: "7029000000028425",          // yFromTop=220, x=334, w=261 - Ville/Province (ligne 2, droite)
  
  // Date validity section - yFromTop ~255-260
  dateDebut: "7029000000028419",             // yFromTop=255, x=99, w=98 - Jour début
  moisDebut: "7029000000028418",             // yFromTop=256, x=290, w=73 - Mois début
  anneeDebut: "7029000000028417",            // yFromTop=260, x=369, w=98 - Année début
  dateFinOuIndeterminee: "7029000000028416", // yFromTop=259, x=466, w=98 - Date fin
  
  // BOTTOM SECTION - Mandataire (kWh Québec) info - yFromTop ~574-655
  mandataireTel: "7029000000028429",         // yFromTop=574, x=157, w=439 - Téléphone (gauche, plus large)
  mandataireFax: "7029000000028428",         // yFromTop=575, x=337, w=259 - Fax (droite)
  mandataireEntreprise: "7029000000028426",  // yFromTop=630, x=99, w=497 - Entreprise mandataire (gauche)
  mandataireNom: "7029000000028430",         // yFromTop=629, x=386, w=210 - Nom représentant (droite)
  mandataireFonction: "7029000000028427",    // yFromTop=655, x=387, w=209 - Fonction/titre (dernière ligne)
};

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
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDay(date: Date): string {
  return date.getDate().toString().padStart(2, '0');
}

function formatMonth(date: Date): string {
  const months = ["janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return months[date.getMonth()];
}

function formatYear(date: Date): string {
  return date.getFullYear().toString();
}

export async function generateProcurationPDF(data: ProcurationData): Promise<Buffer> {
  // Load the HQ template
  const templatePath = path.join(process.cwd(), "server/templates/procuration_hq_template.pdf");
  const existingPdfBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  
  const form = pdfDoc.getForm();
  
  // Fill in the mandant (client) information
  const fullAddress = [data.streetAddress, data.postalCode].filter(Boolean).join(", ");
  const cityProvince = [data.city, data.province].filter(Boolean).join(", ");
  
  // Mandant section
  try {
    form.getTextField(HQ_FIELDS.mandantNom).setText(
      `${data.contactName} - ${data.companyName} - No compte: ${data.hqAccountNumber}`
    );
  } catch (e) { console.log("Field mandantNom not found or error:", e); }
  
  try {
    form.getTextField(HQ_FIELDS.mandantAdresse).setText(fullAddress);
  } catch (e) { console.log("Field mandantAdresse not found or error:", e); }
  
  try {
    form.getTextField(HQ_FIELDS.mandantVille).setText(cityProvince);
  } catch (e) { console.log("Field mandantVille not found or error:", e); }
  
  // Date section
  try {
    form.getTextField(HQ_FIELDS.dateDebut).setText(formatDay(data.procurationDate));
  } catch (e) { console.log("Field dateDebut not found or error:", e); }
  
  try {
    form.getTextField(HQ_FIELDS.moisDebut).setText(formatMonth(data.procurationDate));
  } catch (e) { console.log("Field moisDebut not found or error:", e); }
  
  try {
    form.getTextField(HQ_FIELDS.anneeDebut).setText(formatYear(data.procurationDate));
  } catch (e) { console.log("Field anneeDebut not found or error:", e); }
  
  try {
    // End date as formatted date
    form.getTextField(HQ_FIELDS.dateFinOuIndeterminee).setText(
      `${formatDay(data.procurationEndDate)}/${(data.procurationEndDate.getMonth() + 1).toString().padStart(2, '0')}/${formatYear(data.procurationEndDate)}`
    );
  } catch (e) { console.log("Field dateFinOuIndeterminee not found or error:", e); }
  
  // Mandataire (kWh Québec) section
  try {
    form.getTextField(HQ_FIELDS.mandataireEntreprise).setText(MANDATAIRE.companyName);
  } catch (e) { console.log("Field mandataireEntreprise not found or error:", e); }
  
  try {
    form.getTextField(HQ_FIELDS.mandataireNom).setText(MANDATAIRE.contactName);
  } catch (e) { console.log("Field mandataireNom not found or error:", e); }
  
  try {
    form.getTextField(HQ_FIELDS.mandataireFonction).setText(MANDATAIRE.title);
  } catch (e) { console.log("Field mandataireFonction not found or error:", e); }
  
  try {
    form.getTextField(HQ_FIELDS.mandataireTel).setText(MANDATAIRE.phone);
  } catch (e) { console.log("Field mandataireTel not found or error:", e); }
  
  try {
    form.getTextField(HQ_FIELDS.mandataireFax).setText(MANDATAIRE.fax);
  } catch (e) { console.log("Field mandataireFax not found or error:", e); }
  
  // Add signature image if provided
  if (data.signatureImage) {
    try {
      const page = pdfDoc.getPage(0);
      const { height } = page.getSize();
      
      // Parse base64 signature
      const base64Data = data.signatureImage.replace(/^data:image\/\w+;base64,/, "");
      const signatureBuffer = Buffer.from(base64Data, "base64");
      
      // Embed the PNG image
      const signatureImage = await pdfDoc.embedPng(signatureBuffer);
      
      // Position signature in the signature area of the form
      // Typically near the bottom left of the form
      const signatureWidth = 150;
      const signatureHeight = 50;
      const signatureX = 100;
      const signatureY = 100; // Near bottom of page
      
      page.drawImage(signatureImage, {
        x: signatureX,
        y: signatureY,
        width: signatureWidth,
        height: signatureHeight,
      });
    } catch (e) {
      console.log("Error adding signature image:", e);
    }
  }
  
  // Add electronic signature metadata at the bottom of the page
  const page = pdfDoc.getPage(0);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
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
  
  // Flatten the form to prevent further editing
  form.flatten();
  
  // Save and return the PDF
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export function createProcurationData(
  formData: {
    companyName: string;
    contactName: string;
    signerTitle: string;
    hqAccountNumber: string;
    streetAddress: string;
    city: string;
    province?: string;
    postalCode?: string;
    signatureImage?: string;
    procurationDate?: string;
  },
  ipAddress?: string,
  userAgent?: string
): ProcurationData {
  const signatureDate = formData.procurationDate 
    ? new Date(formData.procurationDate) 
    : new Date();
  
  const endDate = addBusinessDays(signatureDate, 15);
  
  return {
    companyName: formData.companyName,
    contactName: formData.contactName,
    signerTitle: formData.signerTitle,
    hqAccountNumber: formData.hqAccountNumber,
    streetAddress: formData.streetAddress,
    city: formData.city,
    province: formData.province || "Québec",
    postalCode: formData.postalCode,
    signatureImage: formData.signatureImage,
    procurationDate: signatureDate,
    procurationEndDate: endDate,
    ipAddress,
    userAgent,
  };
}

// Legacy function for backward compatibility - no longer uses PDFKit doc
export function generateProcurationPDFLegacy(
  doc: any,
  data: ProcurationData
): void {
  console.warn("Legacy generateProcurationPDF called - use async version instead");
}
