import path from "path";
import fs from "fs";
import {
  BRAND_COLORS,
  PAGE_SIZES,
  createDocument,
  collectBuffer,
} from "./pdfTemplates";
import { COMMUNITY_SESSIONS } from "@shared/communitySessionData";
export { COMMUNITY_SESSIONS };

// ~10% opacity variant of BRAND_COLORS.primary (#003DA6)
const MEETING_BOX_BG = "#e8f0fe";

function loadLogo(filename: string): Buffer | null {
  const logoPath = path.join(process.cwd(), "attached_assets", filename);
  if (fs.existsSync(logoPath)) {
    try {
      return fs.readFileSync(logoPath);
    } catch {
      return null;
    }
  }
  return null;
}

function drawMeetingBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  items: { label: string; value: string }[]
): number {
  const padding = 8;
  const lineH = 11;
  const boxHeight = padding * 2 + items.length * (lineH + 9) + 2;

  doc
    .roundedRect(x, y, width, boxHeight, 4)
    .fillColor(MEETING_BOX_BG)
    .fill();
  doc
    .roundedRect(x, y, width, boxHeight, 4)
    .strokeColor(BRAND_COLORS.primary)
    .lineWidth(1)
    .stroke();

  let cy = y + padding;
  for (const item of items) {
    doc.fontSize(7).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
    doc.text(item.label, x + padding, cy, { width: width - padding * 2 });
    cy += lineH;
    doc.fontSize(7.5).fillColor(BRAND_COLORS.darkText).font("Helvetica");
    doc.text(item.value, x + padding, cy, { width: width - padding * 2 });
    cy += 9;
  }

  return y + boxHeight;
}

export async function generateCommunityFlyerPDF(
  sessionIndex: number
): Promise<Buffer> {
  if (sessionIndex < 0 || sessionIndex >= COMMUNITY_SESSIONS.length) {
    throw new Error(
      `Invalid session index ${sessionIndex}. Must be 0-${COMMUNITY_SESSIONS.length - 1}.`
    );
  }

  const session = COMMUNITY_SESSIONS[sessionIndex];
  const { width: pageWidth, height: pageHeight } = PAGE_SIZES.letter;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  const doc = createDocument("letter");
  const bufferPromise = collectBuffer(doc);

  const frLogo = loadLogo(
    "kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png"
  );
  const scaleLogo = loadLogo("scale_cleantech_colorHR_1769011389486.png");

  doc.rect(0, 0, pageWidth, 6).fillColor(BRAND_COLORS.accent).fill();

  let y = 14;

  if (frLogo) {
    try {
      doc.image(frLogo, margin, y, { width: 130 });
    } catch {
      doc.fontSize(12).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
      doc.text("kWh Québec", margin, y + 5);
    }
  }
  if (scaleLogo) {
    try {
      doc.image(scaleLogo, margin + 145, y + 10, { width: 120 });
    } catch {}
  }

  y = 62;
  doc
    .moveTo(margin, y)
    .lineTo(margin + contentWidth, y)
    .strokeColor(BRAND_COLORS.border)
    .lineWidth(0.5)
    .stroke();
  y += 6;

  const isManyBuildings = session.buildings.length > 5;
  const bodySize = isManyBuildings ? 7 : 7.5;
  const bulletSize = isManyBuildings ? 6.5 : 7;
  const headingSize = isManyBuildings ? 9 : 10;
  const subjectSize = isManyBuildings ? 7.5 : 8;
  const sectionGap = isManyBuildings ? 3 : 5;
  const bulletGap = isManyBuildings ? 1 : 2;

  // ─── FRENCH SECTION ───
  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(session.dateFr, margin, y, { width: contentWidth });
  y += 10;

  doc.fontSize(subjectSize).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
  doc.text(
    "Objet : Invitation à une rencontre d'information – Projet solaire dans votre voisinage",
    margin,
    y,
    { width: contentWidth }
  );
  y += doc.heightOfString(
    "Objet : Invitation à une rencontre d'information – Projet solaire dans votre voisinage",
    { width: contentWidth }
  ) + sectionGap;

  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  const frIntro =
    "Bonjour, nous souhaitons vous informer qu'un propriétaire de bâtiment dans votre voisinage prévoit installer un système solaire sur son toit. Le ou les bâtiments concernés sont situés au :";
  doc.text(frIntro, margin, y, { width: contentWidth, lineGap: 1 });
  y += doc.heightOfString(frIntro, { width: contentWidth, lineGap: 1 }) + bulletGap;

  doc.fontSize(bulletSize).fillColor(BRAND_COLORS.darkText).font("Helvetica-Bold");
  for (const addr of session.buildings) {
    doc.text(`  •  ${addr}`, margin + 6, y, { width: contentWidth - 12 });
    y += doc.heightOfString(`  •  ${addr}`, { width: contentWidth - 12 }) + bulletGap;
  }

  y += sectionGap;
  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(
    "Nous vous invitons à une rencontre d'information pour en apprendre davantage :",
    margin,
    y,
    { width: contentWidth }
  );
  y += 10;

  y = drawMeetingBox(doc, margin, y, contentWidth, [
    { label: "Date :", value: session.dateFr },
    { label: "Heure :", value: session.timeFr },
    { label: "Lieu :", value: session.meetingAddressFr },
  ]);
  y += sectionGap;

  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  const frPresentation =
    "Lors de cette rencontre, notre équipe présentera :";
  doc.text(frPresentation, margin, y, { width: contentWidth });
  y += doc.heightOfString(frPresentation, { width: contentWidth }) + bulletGap;

  const frPoints = [
    "Les détails du projet solaire et ses bénéfices environnementaux",
    "Le processus d'installation et le calendrier prévu",
    "Les mesures de sécurité et la gestion du chantier",
    "L'impact visuel et sonore minimal sur le voisinage",
  ];
  doc.fontSize(bulletSize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  for (const pt of frPoints) {
    doc.text(`  •  ${pt}`, margin + 6, y, { width: contentWidth - 12, lineGap: 0 });
    y += doc.heightOfString(`  •  ${pt}`, { width: contentWidth - 12, lineGap: 0 }) + bulletGap;
  }

  y += 1;
  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  const frReassurance =
    "Les installations solaires sont silencieuses, n'impliquent aucune modification structurelle visible depuis le sol et ne présentent aucun risque pour le voisinage.";
  doc.text(frReassurance, margin, y, { width: contentWidth, lineGap: 1 });
  y += doc.heightOfString(frReassurance, { width: contentWidth, lineGap: 1 }) + sectionGap;

  doc.fontSize(bodySize).fillColor(BRAND_COLORS.mediumText).font("Helvetica");
  doc.text("Pour toute question : etienne@kwh.quebec", margin, y, {
    width: contentWidth,
  });
  y += 10;

  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text("Cordialement,", margin, y);
  y += 9;
  doc.font("Helvetica-Bold");
  doc.text("L'équipe de kWh Québec et Scale Cleantech Inc.", margin, y, {
    width: contentWidth,
  });
  y += 12;

  // ─── DIVIDER ───
  doc
    .moveTo(margin, y)
    .lineTo(margin + contentWidth, y)
    .strokeColor(BRAND_COLORS.accent)
    .lineWidth(1.5)
    .stroke();
  y += 8;

  // ─── ENGLISH SECTION ───
  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(session.dateEn, margin, y, { width: contentWidth });
  y += 10;

  doc.fontSize(subjectSize).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
  doc.text(
    "Subject: Community Information Meeting – Rooftop Solar Project in Your Neighbourhood",
    margin,
    y,
    { width: contentWidth }
  );
  y += doc.heightOfString(
    "Subject: Community Information Meeting – Rooftop Solar Project in Your Neighbourhood",
    { width: contentWidth }
  ) + sectionGap;

  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  const enIntro =
    "Hello, we would like to inform you that a building owner in your neighbourhood is planning to install a rooftop solar system. The building(s) concerned are located at:";
  doc.text(enIntro, margin, y, { width: contentWidth, lineGap: 1 });
  y += doc.heightOfString(enIntro, { width: contentWidth, lineGap: 1 }) + bulletGap;

  doc.fontSize(bulletSize).fillColor(BRAND_COLORS.darkText).font("Helvetica-Bold");
  for (const addr of session.buildings) {
    doc.text(`  •  ${addr}`, margin + 6, y, { width: contentWidth - 12 });
    y += doc.heightOfString(`  •  ${addr}`, { width: contentWidth - 12 }) + bulletGap;
  }

  y += sectionGap;
  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(
    "We invite you to an information meeting to learn more:",
    margin,
    y,
    { width: contentWidth }
  );
  y += 10;

  y = drawMeetingBox(doc, margin, y, contentWidth, [
    { label: "Date:", value: session.dateEn },
    { label: "Time:", value: session.timeEn },
    { label: "Location:", value: session.meetingAddressEn },
  ]);
  y += sectionGap;

  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text("During this meeting, our team will present:", margin, y, {
    width: contentWidth,
  });
  y += doc.heightOfString("During this meeting, our team will present:", {
    width: contentWidth,
  }) + bulletGap;

  const enPoints = [
    "Details of the solar project and its environmental benefits",
    "The installation process and expected timeline",
    "Safety measures and site management",
    "Minimal visual and noise impact on the neighbourhood",
  ];
  doc.fontSize(bulletSize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  for (const pt of enPoints) {
    doc.text(`  •  ${pt}`, margin + 6, y, { width: contentWidth - 12, lineGap: 0 });
    y += doc.heightOfString(`  •  ${pt}`, { width: contentWidth - 12, lineGap: 0 }) + bulletGap;
  }

  y += 1;
  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  const enReassurance =
    "Solar installations are quiet, involve no structural changes visible from the ground, and pose no risk to the neighbourhood.";
  doc.text(enReassurance, margin, y, { width: contentWidth, lineGap: 1 });
  y += doc.heightOfString(enReassurance, { width: contentWidth, lineGap: 1 }) + sectionGap;

  doc.fontSize(bodySize).fillColor(BRAND_COLORS.mediumText).font("Helvetica");
  doc.text("For any questions: etienne@kwh.quebec", margin, y, {
    width: contentWidth,
  });
  y += 10;

  doc.fontSize(bodySize).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text("Kind regards,", margin, y);
  y += 9;
  doc.font("Helvetica-Bold");
  doc.text("The kWh Québec and Scale Cleantech Team", margin, y, {
    width: contentWidth,
  });

  // ─── FOOTER ───
  const footerH = 30;
  const footerY = pageHeight - footerH;
  doc.rect(0, footerY, pageWidth, footerH).fillColor(BRAND_COLORS.primary).fill();

  const ftY = footerY + (footerH - 8) / 2;
  doc.fontSize(7.5).fillColor(BRAND_COLORS.white).font("Helvetica");
  doc.text("514.427.8871", margin, ftY);
  doc.text("etienne@kwh.quebec", pageWidth / 2 - 40, ftY, {
    width: 80,
    align: "center",
  });
  doc.font("Helvetica-Bold");
  doc.text("www.kwh.quebec", margin, ftY, {
    width: contentWidth,
    align: "right",
  });

  doc.end();
  return bufferPromise;
}
