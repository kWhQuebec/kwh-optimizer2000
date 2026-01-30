import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

interface ProcurationData {
  // Client (mandant) info
  hqAccountNumber: string;       // No de client HQ (juste le numéro)
  contactName: string;           // Nom, Prénom du client
  signerTitle: string;           // Fonction du client
  signatureCity: string;         // Ville où le document est signé
  signatureImage?: string;       // Signature dessinée
  procurationDate: Date;
  procurationEndDate: Date;
  ipAddress?: string;
  userAgent?: string;
  // Legacy fields kept for backward compatibility
  companyName?: string;
  streetAddress?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

// Mandataire (kWh Québec) - hardcoded info
const MANDATAIRE = {
  // Format: "Nom, Prénom" comme demandé
  contactName: "La Barre, Marc-André",
  title: "Chef des opérations",
  phone: "514-427-8871",
  cellulaire: "514-891-8199",
};

// Field names from the HQ PDF template mapped to their CORRECT purpose
// Based on actual field positions extracted from template
// Positions sorted by Y coordinate (top of page = higher Y value)
const HQ_FIELDS = {
  // === SECTION HAUTE - Client/Mandant Info (y > 500) ===
  // Champ 1: y=633, x=99, w=497 - No de client HQ
  clientNoCompte: "7029000000028423",
  
  // Champ 2: y=604, x=99, w=497 - Nom, Prénom du client (gauche)
  clientNomPrenom: "7029000000028424",
  
  // Champ 3: y=604, x=334, w=261 - Fonction du client (droite)
  clientFonction: "7029000000028425",
  
  // Champs 4-7: Personne autorisée (mandataire kWh Québec)
  // Champ 4: y=566, x=99, w=98 - Nom de la personne autorisée
  mandataireNom: "7029000000028419",
  
  // Champ 5: y=563, x=290, w=73 - Fonction de la personne autorisée
  mandataireFonction: "7029000000028418",
  
  // Champ 6: y=564, x=369, w=98 - Téléphone
  mandataireTel: "7029000000028417",
  
  // Champ 7: y=563, x=466, w=98 - Cellulaire
  mandataireCellulaire: "7029000000028416",
  
  // === SECTION BASSE - Durée et Signature (y < 300) ===
  // Champ 8: y=247, x=157, w=439 - Date de signature (début durée)
  dureeDebut: "7029000000028429",
  
  // Champ 9: y=247, x=337, w=259 - Date fin (durée)
  dureeFin: "7029000000028428",
  
  // Champ 10: y=189, x=99, w=497 - Signée à (ville)
  signeeA: "7029000000028426",
  
  // Champ 11: y=190, x=386, w=210 - "le" (date de signature)
  signatureLe: "7029000000028430",
  
  // Champ 12: y=163, x=387, w=209 - Nom en lettres moulées du signataire
  signataireNom: "7029000000028427",
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

function formatDateShort(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export async function generateProcurationPDF(data: ProcurationData): Promise<Buffer> {
  // Load the HQ template
  const templatePath = path.join(process.cwd(), "server/templates/procuration_hq_template.pdf");
  const existingPdfBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  
  const form = pdfDoc.getForm();
  
  // === SECTION HAUTE - Client/Mandant ===
  
  // Helper function to clear and set field value
  const setFieldValue = (fieldName: string, value: string) => {
    try {
      const field = form.getTextField(fieldName);
      // Clear existing value first, then set new value
      field.setText('');
      field.setText(value);
    } catch (e) { 
      console.log(`Field ${fieldName} error:`, e); 
    }
  };
  
  // 1. No de client HQ (juste le numéro)
  setFieldValue(HQ_FIELDS.clientNoCompte, data.hqAccountNumber);
  
  // 2. Nom, Prénom du client
  setFieldValue(HQ_FIELDS.clientNomPrenom, data.contactName);
  
  // 3. Fonction du client
  setFieldValue(HQ_FIELDS.clientFonction, data.signerTitle);
  
  // === PERSONNE AUTORISÉE (Mandataire - kWh Québec) ===
  
  // 4. Nom de la personne autorisée
  setFieldValue(HQ_FIELDS.mandataireNom, MANDATAIRE.contactName);
  
  // 5. Fonction de la personne autorisée
  setFieldValue(HQ_FIELDS.mandataireFonction, MANDATAIRE.title);
  
  // 6. Téléphone
  setFieldValue(HQ_FIELDS.mandataireTel, MANDATAIRE.phone);
  
  // 7. Cellulaire
  setFieldValue(HQ_FIELDS.mandataireCellulaire, MANDATAIRE.cellulaire);
  
  // === SECTION BASSE - Durée et Signature ===
  
  // 8. Date de signature (début durée)
  setFieldValue(HQ_FIELDS.dureeDebut, formatDateShort(data.procurationDate));
  
  // 9. Date fin (durée + 15 jours ouvrables)
  setFieldValue(HQ_FIELDS.dureeFin, formatDateShort(data.procurationEndDate));
  
  // 10. Signée à (ville)
  setFieldValue(HQ_FIELDS.signeeA, data.signatureCity);
  
  // 11. "le" (date de signature)
  setFieldValue(HQ_FIELDS.signatureLe, formatDateShort(data.procurationDate));
  
  // 12. Nom en lettres moulées du signataire (responsable de l'abonnement)
  setFieldValue(HQ_FIELDS.signataireNom, data.contactName);
  
  // === SIGNATURE IMAGE ===
  // Position signature à gauche de "signeeA" (y=189, x avant 99)
  const page = pdfDoc.getPage(0);
  
  // Cover the example signature "Eric Laberge" from the template with a white rectangle
  // Extended coverage area to fully hide the template signature
  // The signature zone spans from x:45 to x:385, y:150 to y:220
  page.drawRectangle({
    x: 40,
    y: 150,
    width: 350,
    height: 70,
    color: rgb(1, 1, 1), // White
  });
  
  if (data.signatureImage) {
    try {
      // Parse base64 signature
      const base64Data = data.signatureImage.replace(/^data:image\/\w+;base64,/, "");
      const signatureBuffer = Buffer.from(base64Data, "base64");
      
      // Embed the PNG image
      const signatureImage = await pdfDoc.embedPng(signatureBuffer);
      
      // Position signature in the correct area (y=165-210)
      // Using scaled dimensions to maintain aspect ratio
      const dims = signatureImage.scale(0.3);
      const signatureWidth = Math.min(dims.width, 200);
      const signatureHeight = Math.min(dims.height, 38);
      const signatureX = 90;
      const signatureY = 172; // In the signature box (between y=165-210)
      
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
  
  // Update field appearances to ensure new values are rendered
  form.updateFieldAppearances();
  
  // Flatten the form to prevent further editing
  form.flatten();
  
  // Save and return the PDF
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
  
  const endDate = addBusinessDays(signatureDate, 15);
  
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
    // Legacy fields
    companyName: formData.companyName,
    streetAddress: formData.streetAddress,
    city: formData.city,
    province: formData.province,
    postalCode: formData.postalCode,
  };
}

// Legacy function for backward compatibility - no longer uses PDFKit doc
export function generateProcurationPDFLegacy(
  doc: any,
  data: ProcurationData
): void {
  console.warn("Legacy generateProcurationPDF called - use async version instead");
}
