import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { getRoofVisualizationUrl, getSatelliteImageUrl } from "./googleSolarService";

const COLORS = {
  blue: "#1e3a5f",
  gold: "#d4a853",
  darkGray: "#333333",
  mediumGray: "#666666",
  lightGray: "#f5f5f5",
  white: "#FFFFFF",
};

interface RoofPolygonData {
  coordinates: [number, number][];
  color: string;
  label?: string;
}

interface ProjectInfoData {
  site: {
    name: string;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    kbKwDc?: number | null;
  };
  roofPolygons?: RoofPolygonData[];
  roofImageBuffer?: Buffer;
}

const TEXTS = {
  fr: {
    title: "Fiche d'information du projet solaire",
    subtitle: "Solar Project Information Sheet",
    introTitle: "Énergie solaire au Québec",
    introText: `Le Québec s'engage dans une transition énergétique ambitieuse. Dans le cadre de l'appel de propositions 2025-01 d'Hydro-Québec pour l'achat d'électricité provenant de sources renouvelables, kWh Québec développe des projets solaires sur toiture pour contribuer à l'atteinte des objectifs de décarbonation de la province.

Ce projet fait partie d'un portefeuille de toitures industrielles identifiées pour leur potentiel solaire exceptionnel. L'électricité produite sera vendue à Hydro-Québec dans le cadre d'un contrat d'achat d'énergie à long terme.`,
    introTextEn: `Quebec is committed to an ambitious energy transition. As part of Hydro-Québec's 2025-01 call for proposals for the purchase of electricity from renewable sources, kWh Québec is developing rooftop solar projects to contribute to the province's decarbonization objectives.

This project is part of a portfolio of industrial rooftops identified for their exceptional solar potential. The electricity produced will be sold to Hydro-Québec under a long-term power purchase agreement.`,
    projectDetailsTitle: "Détails du projet / Project Details",
    projectAddress: "Adresse du projet / Project Address",
    projectSize: "Taille du projet / Project Size",
    constructionStart: "Début de construction prévu / Planned Construction Start",
    constructionValue: "Printemps/Été 2028 / Spring/Summer 2028",
    developer: "Développeur/Constructeur / Developer/Constructor",
    developerValue: "Scale Cleantech et kWh Québec",
    buildingSponsor: "Propriétaire du bâtiment / Building Sponsor/Owner",
    buildingSponsorValue: "Dream Industrial Solar",
    electricityOfftake: "Acheteur d'électricité / Electricity Offtake",
    electricityOfftakeValue: "Hydro-Québec",
    roofVisualizationTitle: "Visualisation du toit / Roof Visualization",
    contactTitle: "Pour plus d'information / For More Information",
    contactWebsite: "www.kwh.quebec",
    dcLabel: "kW DC",
    acLabel: "kW AC",
    notAvailable: "À déterminer / TBD",
  },
  en: {
    title: "Solar Project Information Sheet",
    subtitle: "Fiche d'information du projet solaire",
    introTitle: "Solar Energy in Quebec",
    introText: `Quebec is committed to an ambitious energy transition. As part of Hydro-Québec's 2025-01 call for proposals for the purchase of electricity from renewable sources, kWh Québec is developing rooftop solar projects to contribute to the province's decarbonization objectives.

This project is part of a portfolio of industrial rooftops identified for their exceptional solar potential. The electricity produced will be sold to Hydro-Québec under a long-term power purchase agreement.`,
    introTextEn: `Le Québec s'engage dans une transition énergétique ambitieuse. Dans le cadre de l'appel de propositions 2025-01 d'Hydro-Québec pour l'achat d'électricité provenant de sources renouvelables, kWh Québec développe des projets solaires sur toiture pour contribuer à l'atteinte des objectifs de décarbonation de la province.

Ce projet fait partie d'un portefeuille de toitures industrielles identifiées pour leur potentiel solaire exceptionnel. L'électricité produite sera vendue à Hydro-Québec dans le cadre d'un contrat d'achat d'énergie à long terme.`,
    projectDetailsTitle: "Project Details / Détails du projet",
    projectAddress: "Project Address / Adresse du projet",
    projectSize: "Project Size / Taille du projet",
    constructionStart: "Planned Construction Start / Début de construction prévu",
    constructionValue: "Spring/Summer 2028 / Printemps/Été 2028",
    developer: "Developer/Constructor / Développeur/Constructeur",
    developerValue: "Scale Cleantech and kWh Québec",
    buildingSponsor: "Building Sponsor/Owner / Propriétaire du bâtiment",
    buildingSponsorValue: "Dream Industrial Solar",
    electricityOfftake: "Electricity Offtake / Acheteur d'électricité",
    electricityOfftakeValue: "Hydro-Québec",
    roofVisualizationTitle: "Roof Visualization / Visualisation du toit",
    contactTitle: "For More Information / Pour plus d'information",
    contactWebsite: "www.kwh.quebec",
    dcLabel: "kW DC",
    acLabel: "kW AC",
    notAvailable: "TBD / À déterminer",
  },
};

export async function generateProjectInfoSheetPDF(
  data: ProjectInfoData,
  lang: "fr" | "en" = "fr"
): Promise<Buffer> {
  const t = TEXTS[lang];
  
  const doc = new PDFDocument({
    size: "letter",
    margin: 50,
    bufferPages: true,
  });

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const logoPath = path.join(
    process.cwd(),
    "attached_assets",
    lang === "fr"
      ? "solaire_fr-removebg-preview_1767985380511.png"
      : "solaire_en-removebg-preview_1767985380510.png"
  );

  const headerHeight = 90;
  doc.rect(0, 0, pageWidth, headerHeight).fillColor(COLORS.blue).fill();
  doc.rect(0, headerHeight - 4, pageWidth, 4).fillColor(COLORS.gold).fill();

  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, margin, 15, { width: 160 });
    } catch (e) {
      doc.fontSize(24).fillColor(COLORS.white).font("Helvetica-Bold");
      doc.text("kWh Québec", margin, 25);
      doc.font("Helvetica");
    }
  } else {
    doc.fontSize(24).fillColor(COLORS.white).font("Helvetica-Bold");
    doc.text("kWh Québec", margin, 25);
    doc.font("Helvetica");
  }

  doc.fontSize(14).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t.title, margin, 55, { width: contentWidth });
  doc.font("Helvetica");

  let yPos = headerHeight + 25;

  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t.introTitle, margin, yPos);
  doc.font("Helvetica");
  yPos += 20;

  doc.fontSize(10).fillColor(COLORS.darkGray);
  doc.text(t.introText, margin, yPos, { width: contentWidth, align: "justify" });
  yPos = doc.y + 25;

  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t.projectDetailsTitle, margin, yPos);
  doc.font("Helvetica");
  yPos += 20;

  const drawDetailRow = (label: string, value: string, yStart: number): number => {
    doc.rect(margin, yStart, contentWidth, 28).fillColor(COLORS.lightGray).fill();
    doc.rect(margin, yStart, contentWidth, 28).strokeColor("#e0e0e0").lineWidth(0.5).stroke();

    doc.fontSize(9).fillColor(COLORS.mediumGray).font("Helvetica-Bold");
    doc.text(label, margin + 10, yStart + 5, { width: contentWidth - 20 });
    doc.font("Helvetica");

    doc.fontSize(10).fillColor(COLORS.darkGray);
    doc.text(value, margin + 10, yStart + 16, { width: contentWidth - 20 });

    return yStart + 30;
  };

  const fullAddress = [
    data.site.address,
    data.site.city,
    data.site.province || "QC",
    data.site.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  yPos = drawDetailRow(t.projectAddress, fullAddress || data.site.name, yPos);

  const kbKwDc = data.site.kbKwDc;
  let sizeValue = t.notAvailable;
  if (kbKwDc && kbKwDc > 0) {
    const kwAc = Math.round(kbKwDc * 0.85);
    sizeValue = `${Math.round(kbKwDc).toLocaleString()} ${t.dcLabel} / ${kwAc.toLocaleString()} ${t.acLabel}`;
  }
  yPos = drawDetailRow(t.projectSize, sizeValue, yPos);

  yPos = drawDetailRow(t.constructionStart, t.constructionValue, yPos);
  yPos = drawDetailRow(t.developer, t.developerValue, yPos);
  yPos = drawDetailRow(t.buildingSponsor, t.buildingSponsorValue, yPos);
  yPos = drawDetailRow(t.electricityOfftake, t.electricityOfftakeValue, yPos);

  yPos += 20;

  if (data.roofImageBuffer || (data.site.latitude && data.site.longitude)) {
    doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(t.roofVisualizationTitle, margin, yPos);
    doc.font("Helvetica");
    yPos += 20;

    const imageHeight = 200;
    const imageWidth = contentWidth;

    if (data.roofImageBuffer) {
      try {
        doc.image(data.roofImageBuffer, margin, yPos, {
          width: imageWidth,
          height: imageHeight,
          fit: [imageWidth, imageHeight],
        });
        yPos += imageHeight + 10;
      } catch (e) {
        doc.rect(margin, yPos, imageWidth, imageHeight / 2)
          .fillColor("#e0e0e0")
          .fill();
        doc.fontSize(10).fillColor(COLORS.mediumGray);
        doc.text("Image unavailable", margin, yPos + imageHeight / 4, {
          width: imageWidth,
          align: "center",
        });
        yPos += imageHeight / 2 + 10;
      }
    } else {
      doc.rect(margin, yPos, imageWidth, imageHeight / 2)
        .fillColor("#e0e0e0")
        .fill();
      doc.fontSize(10).fillColor(COLORS.mediumGray);
      doc.text("Satellite imagery available upon request", margin, yPos + imageHeight / 4, {
        width: imageWidth,
        align: "center",
      });
      yPos += imageHeight / 2 + 10;
    }
  }

  const footerY = pageHeight - 60;
  doc.rect(0, footerY, pageWidth, 60).fillColor(COLORS.blue).fill();

  doc.fontSize(10).fillColor(COLORS.gold).font("Helvetica-Bold");
  doc.text(t.contactTitle, margin, footerY + 15, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  doc.fontSize(14).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t.contactWebsite, margin, footerY + 32, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);
  });
}

export async function fetchRoofImageBuffer(
  latitude: number,
  longitude: number,
  roofPolygons?: RoofPolygonData[]
): Promise<Buffer | null> {
  try {
    let imageUrl: string | null = null;

    if (roofPolygons && roofPolygons.length > 0) {
      imageUrl = getRoofVisualizationUrl(
        { latitude, longitude },
        roofPolygons,
        { width: 800, height: 400, zoom: 18 }
      );
    } else {
      imageUrl = getSatelliteImageUrl(
        { latitude, longitude },
        { width: 800, height: 400, zoom: 18 }
      );
    }

    if (!imageUrl) return null;

    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("[ProjectInfoSheet] Failed to fetch roof image:", error);
    return null;
  }
}
