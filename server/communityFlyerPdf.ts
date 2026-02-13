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

const CONTACT_EMAIL = "info@kwh.quebec";
const CONTACT_PHONE = "514.427.8871";
const WEBSITE = "www.kwh.quebec";

const BODY_SIZE = 10.5;
const BODY_FONT = "Helvetica";
const BOLD_FONT = "Helvetica-Bold";
const LINE_GAP = 3;

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

function textHeight(doc: PDFKit.PDFDocument, text: string, opts: object): number {
  return doc.heightOfString(text, opts);
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  logo: Buffer | null,
  scaleLogo: Buffer | null,
  margin: number,
  contentWidth: number
): number {
  const { width: pageWidth } = PAGE_SIZES.letter;

  let y = 36;

  if (logo) {
    try {
      doc.image(logo, margin, y, { width: 150 });
    } catch {
      doc.fontSize(14).fillColor(BRAND_COLORS.primary).font(BOLD_FONT);
      doc.text("kWh Québec", margin, y + 5);
    }
  }
  if (scaleLogo) {
    try {
      doc.image(scaleLogo, pageWidth - margin - 140, y + 12, { width: 130 });
    } catch {}
  }

  y = 104;
  doc
    .moveTo(margin, y)
    .lineTo(margin + contentWidth, y)
    .strokeColor(BRAND_COLORS.border)
    .lineWidth(0.5)
    .stroke();

  return y + 28;
}

function drawFooter(doc: PDFKit.PDFDocument, margin: number, contentWidth: number) {
  const { width: pageWidth, height: pageHeight } = PAGE_SIZES.letter;
  const footerY = pageHeight - 36;

  doc
    .moveTo(margin, footerY - 8)
    .lineTo(margin + contentWidth, footerY - 8)
    .strokeColor(BRAND_COLORS.border)
    .lineWidth(0.5)
    .stroke();

  doc.fontSize(8).fillColor(BRAND_COLORS.mediumText).font(BODY_FONT);
  doc.text(CONTACT_PHONE, margin, footerY);
  doc.text(CONTACT_EMAIL, pageWidth / 2 - 50, footerY, {
    width: 100,
    align: "center",
  });
  doc.font(BOLD_FONT);
  doc.text(WEBSITE, margin, footerY, {
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
  let y = drawHeader(doc, logo, scaleLogo, margin, contentWidth);

  const dateText = lang === "fr" ? `Le ${session.dateFr.toLowerCase()}` : session.dateEn;
  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BODY_FONT);
  doc.text(dateText, margin, y, { width: contentWidth });

  y += 28;

  const subject = lang === "fr"
    ? "Objet : Invitation à une rencontre d'information – Projet solaire dans votre voisinage"
    : "Subject: Community Information Meeting – Rooftop Solar Project in Your Neighbourhood";
  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BODY_FONT);
  doc.text(subject, margin, y, { width: contentWidth, lineGap: LINE_GAP });
  y += textHeight(doc, subject, { width: contentWidth, lineGap: LINE_GAP });

  y += 22;

  const greeting = lang === "fr" ? "Bonjour," : "Hello,";
  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BODY_FONT);
  doc.text(greeting, margin, y);

  y += 22;

  const intro = lang === "fr"
    ? "Nous souhaitons vous informer qu'un propriétaire de bâtiment dans votre voisinage prévoit installer un système solaire sur son toit. Le ou les bâtiments concernés sont situés au :"
    : "We would like to inform you that a building owner in your neighbourhood is planning to install a rooftop solar system. The building(s) concerned are located at:";
  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BODY_FONT);
  doc.text(intro, margin, y, { width: contentWidth, lineGap: LINE_GAP });
  y += textHeight(doc, intro, { width: contentWidth, lineGap: LINE_GAP });

  y += 14;

  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BOLD_FONT);
  for (const addr of session.buildings) {
    const bullet = `\u2022  ${addr}`;
    doc.text(bullet, margin + 18, y, { width: contentWidth - 36 });
    y += textHeight(doc, bullet, { width: contentWidth - 36 }) + 5;
  }

  y += 18;

  const invite = lang === "fr"
    ? "Nous vous invitons à une rencontre d'information pour en apprendre davantage :"
    : "We invite you to an information meeting to learn more:";
  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BODY_FONT);
  doc.text(invite, margin, y, { width: contentWidth, lineGap: LINE_GAP });
  y += textHeight(doc, invite, { width: contentWidth, lineGap: LINE_GAP });

  y += 18;

  const dateLbl = lang === "fr" ? "Date : " : "Date: ";
  const timeLbl = lang === "fr" ? "Heure : " : "Time: ";
  const locLbl = lang === "fr" ? "Lieu : " : "Location: ";
  const dateVal = lang === "fr" ? session.dateFr : session.dateEn;
  const timeVal = lang === "fr" ? session.timeFr : session.timeEn;
  const locVal = lang === "fr" ? session.meetingAddressFr : session.meetingAddressEn;

  doc.fontSize(BODY_SIZE).font(BOLD_FONT).fillColor(BRAND_COLORS.darkText);
  doc.text(`${dateLbl}${dateVal}`, margin, y, { width: contentWidth });
  y += 16;
  doc.text(`${timeLbl}${timeVal}`, margin, y, { width: contentWidth });
  y += 16;
  doc.text(`${locLbl}${locVal}`, margin, y, { width: contentWidth, lineGap: LINE_GAP });
  y += textHeight(doc, `${locLbl}${locVal}`, { width: contentWidth, lineGap: LINE_GAP });

  y += 22;

  const sectionTitle = lang === "fr"
    ? "Une rencontre pour informer et échanger"
    : "A meeting to inform and discuss";
  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BOLD_FONT);
  doc.text(sectionTitle, margin, y, { width: contentWidth });
  y += 18;

  const presentText = lang === "fr"
    ? "Lors de cette rencontre, notre équipe présentera les détails du projet solaire et ses bénéfices environnementaux, le processus d'installation et le calendrier prévu, les mesures de sécurité et la gestion du chantier, ainsi que l'impact visuel et sonore minimal sur le voisinage."
    : "During this meeting, our team will present details of the solar project and its environmental benefits, the installation process and expected timeline, safety measures and site management, as well as the minimal visual and noise impact on the neighbourhood.";
  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BODY_FONT);
  doc.text(presentText, margin, y, { width: contentWidth, lineGap: LINE_GAP });
  y += textHeight(doc, presentText, { width: contentWidth, lineGap: LINE_GAP });

  y += 18;

  const reassurance = lang === "fr"
    ? "Les installations solaires sont silencieuses, n'impliquent aucune modification structurelle visible depuis le sol et ne présentent aucun risque pour le voisinage."
    : "Solar installations are quiet, involve no structural changes visible from the ground, and pose no risk to the neighbourhood.";
  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BODY_FONT);
  doc.text(reassurance, margin, y, { width: contentWidth, lineGap: LINE_GAP });
  y += textHeight(doc, reassurance, { width: contentWidth, lineGap: LINE_GAP });

  y += 18;

  const contactLine = lang === "fr"
    ? `Pour toute question : ${CONTACT_EMAIL}`
    : `For any questions: ${CONTACT_EMAIL}`;
  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BODY_FONT);
  doc.text(contactLine, margin, y, { width: contentWidth });

  y += 28;

  const closing = lang === "fr"
    ? "Au plaisir de vous accueillir,"
    : "We look forward to welcoming you,";
  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BODY_FONT);
  doc.text(closing, margin, y);

  y += 28;

  const signoff = lang === "fr"
    ? "L'équipe de kWh Québec et Scale Cleantech Inc."
    : "The kWh Québec and Scale Cleantech Team";
  doc.fontSize(BODY_SIZE).fillColor(BRAND_COLORS.darkText).font(BODY_FONT);
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
