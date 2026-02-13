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

const MEETING_BOX_BG = "#e8f0fe";
const CONTACT_EMAIL = "info@kwh.quebec";
const CONTACT_PHONE = "514.427.8871";
const WEBSITE = "www.kwh.quebec";

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
  const padding = 14;
  const boxHeight = padding * 2 + items.length * 30;

  doc
    .roundedRect(x, y, width, boxHeight, 4)
    .fillColor(MEETING_BOX_BG)
    .fill();
  doc
    .roundedRect(x, y, width, boxHeight, 4)
    .strokeColor(BRAND_COLORS.primary)
    .lineWidth(0.75)
    .stroke();

  let cy = y + padding;
  for (const item of items) {
    doc.fontSize(8.5).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
    doc.text(item.label, x + padding, cy, { width: width - padding * 2 });
    cy += 13;
    doc.fontSize(10).fillColor(BRAND_COLORS.darkText).font("Helvetica");
    doc.text(item.value, x + padding, cy, { width: width - padding * 2 });
    cy += 17;
  }

  return y + boxHeight;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  logo: Buffer | null,
  scaleLogo: Buffer | null,
  margin: number,
  contentWidth: number
): number {
  const { width: pageWidth } = PAGE_SIZES.letter;

  doc.rect(0, 0, pageWidth, 5).fillColor(BRAND_COLORS.accent).fill();

  let y = 20;

  if (logo) {
    try {
      doc.image(logo, margin, y, { width: 140 });
    } catch {
      doc.fontSize(14).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
      doc.text("kWh Québec", margin, y + 5);
    }
  }
  if (scaleLogo) {
    try {
      doc.image(scaleLogo, pageWidth - margin - 130, y + 8, { width: 120 });
    } catch {}
  }

  y = 72;
  doc
    .moveTo(margin, y)
    .lineTo(margin + contentWidth, y)
    .strokeColor(BRAND_COLORS.border)
    .lineWidth(0.5)
    .stroke();

  return y + 20;
}

function drawFooter(doc: PDFKit.PDFDocument, margin: number, contentWidth: number) {
  const { width: pageWidth, height: pageHeight } = PAGE_SIZES.letter;
  const footerH = 26;
  const footerY = pageHeight - footerH;
  doc.rect(0, footerY, pageWidth, footerH).fillColor(BRAND_COLORS.primary).fill();

  const ftY = footerY + (footerH - 7) / 2;
  doc.fontSize(7.5).fillColor(BRAND_COLORS.white).font("Helvetica");
  doc.text(CONTACT_PHONE, margin, ftY);
  doc.text(CONTACT_EMAIL, pageWidth / 2 - 50, ftY, {
    width: 100,
    align: "center",
  });
  doc.font("Helvetica-Bold");
  doc.text(WEBSITE, margin, ftY, {
    width: contentWidth,
    align: "right",
  });
}

function renderPage(
  doc: PDFKit.PDFDocument,
  session: typeof COMMUNITY_SESSIONS[number],
  lang: "fr" | "en",
  logo: Buffer | null,
  scaleLogo: Buffer | null,
  margin: number,
  contentWidth: number,
) {
  const LINE_GAP = 3;
  const PARA_GAP = 16;
  const SECTION_GAP = 20;
  const BULLET_GAP = 6;

  let y = drawHeader(doc, logo, scaleLogo, margin, contentWidth);

  doc.fontSize(10).fillColor(BRAND_COLORS.mediumText).font("Helvetica");
  doc.text(lang === "fr" ? session.dateFr : session.dateEn, margin, y, { width: contentWidth });
  y += SECTION_GAP;

  const subject = lang === "fr"
    ? "Objet : Invitation à une rencontre d'information – Projet solaire dans votre voisinage"
    : "Subject: Community Information Meeting – Rooftop Solar Project in Your Neighbourhood";
  doc.fontSize(12).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
  doc.text(subject, margin, y, { width: contentWidth, lineGap: LINE_GAP });
  y += doc.heightOfString(subject, { width: contentWidth, lineGap: LINE_GAP }) + SECTION_GAP;

  const greeting = lang === "fr" ? "Bonjour," : "Hello,";
  doc.fontSize(10.5).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(greeting, margin, y);
  y += PARA_GAP;

  const intro = lang === "fr"
    ? "Nous souhaitons vous informer qu'un propriétaire de bâtiment dans votre voisinage prévoit installer un système solaire sur son toit. Le ou les bâtiments concernés sont situés au :"
    : "We would like to inform you that a building owner in your neighbourhood is planning to install a rooftop solar system. The building(s) concerned are located at:";
  doc.fontSize(10.5).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(intro, margin, y, { width: contentWidth, lineGap: LINE_GAP });
  y += doc.heightOfString(intro, { width: contentWidth, lineGap: LINE_GAP }) + PARA_GAP;

  doc.fontSize(10).fillColor(BRAND_COLORS.darkText).font("Helvetica-Bold");
  for (const addr of session.buildings) {
    const bullet = `\u2022  ${addr}`;
    doc.text(bullet, margin + 14, y, { width: contentWidth - 28 });
    y += doc.heightOfString(bullet, { width: contentWidth - 28 }) + BULLET_GAP;
  }

  y += PARA_GAP;

  const invite = lang === "fr"
    ? "Nous vous invitons à une rencontre d'information pour en apprendre davantage :"
    : "We invite you to an information meeting to learn more:";
  doc.fontSize(10.5).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(invite, margin, y, { width: contentWidth });
  y += doc.heightOfString(invite, { width: contentWidth }) + PARA_GAP;

  const meetingItems = lang === "fr"
    ? [
        { label: "Date :", value: session.dateFr },
        { label: "Heure :", value: session.timeFr },
        { label: "Lieu :", value: session.meetingAddressFr },
      ]
    : [
        { label: "Date:", value: session.dateEn },
        { label: "Time:", value: session.timeEn },
        { label: "Location:", value: session.meetingAddressEn },
      ];
  y = drawMeetingBox(doc, margin, y, contentWidth, meetingItems);
  y += SECTION_GAP;

  const presentIntro = lang === "fr"
    ? "Lors de cette rencontre, notre équipe présentera :"
    : "During this meeting, our team will present:";
  doc.fontSize(10.5).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(presentIntro, margin, y, { width: contentWidth });
  y += doc.heightOfString(presentIntro, { width: contentWidth }) + PARA_GAP;

  const points = lang === "fr"
    ? [
        "Les détails du projet solaire et ses bénéfices environnementaux",
        "Le processus d'installation et le calendrier prévu",
        "Les mesures de sécurité et la gestion du chantier",
        "L'impact visuel et sonore minimal sur le voisinage",
      ]
    : [
        "Details of the solar project and its environmental benefits",
        "The installation process and expected timeline",
        "Safety measures and site management",
        "Minimal visual and noise impact on the neighbourhood",
      ];
  doc.fontSize(10).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  for (const pt of points) {
    const bullet = `\u2022  ${pt}`;
    doc.text(bullet, margin + 14, y, { width: contentWidth - 28 });
    y += doc.heightOfString(bullet, { width: contentWidth - 28 }) + BULLET_GAP;
  }

  y += PARA_GAP;

  const reassurance = lang === "fr"
    ? "Les installations solaires sont silencieuses, n'impliquent aucune modification structurelle visible depuis le sol et ne présentent aucun risque pour le voisinage."
    : "Solar installations are quiet, involve no structural changes visible from the ground, and pose no risk to the neighbourhood.";
  doc.fontSize(10.5).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(reassurance, margin, y, { width: contentWidth, lineGap: LINE_GAP });
  y += doc.heightOfString(reassurance, { width: contentWidth, lineGap: LINE_GAP }) + SECTION_GAP;

  const contactLine = lang === "fr"
    ? `Pour toute question : ${CONTACT_EMAIL}`
    : `For any questions: ${CONTACT_EMAIL}`;
  doc.fontSize(10).fillColor(BRAND_COLORS.mediumText).font("Helvetica");
  doc.text(contactLine, margin, y, { width: contentWidth });
  y += SECTION_GAP;

  const closing = lang === "fr" ? "Cordialement," : "Kind regards,";
  doc.fontSize(10.5).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(closing, margin, y);
  y += SECTION_GAP;

  const signoff = lang === "fr"
    ? "L'équipe de kWh Québec et Scale Cleantech Inc."
    : "The kWh Québec and Scale Cleantech Team";
  doc.fontSize(10.5).fillColor(BRAND_COLORS.darkText).font("Helvetica-Bold");
  doc.text(signoff, margin, y, { width: contentWidth });

  drawFooter(doc, margin, contentWidth);
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
  const margin = 72;
  const contentWidth = PAGE_SIZES.letter.width - margin * 2;

  const doc = createDocument("letter");
  const bufferPromise = collectBuffer(doc);

  const frLogo = loadLogo("kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png");
  const enLogo = loadLogo("kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png");
  const scaleLogo = loadLogo("scale_cleantech_colorHR_1769011389486.png");

  renderPage(doc, session, "fr", frLogo, scaleLogo, margin, contentWidth);

  doc.addPage({ size: "LETTER", margin: 0 });

  renderPage(doc, session, "en", enLogo, scaleLogo, margin, contentWidth);

  doc.end();
  return bufferPromise;
}
