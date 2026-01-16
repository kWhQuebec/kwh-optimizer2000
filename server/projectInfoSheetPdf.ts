import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { getRoofVisualizationUrl, getSatelliteImageUrl } from "./googleSolarService";

const COLORS = {
  primary: "#0054A8",
  primaryLight: "#0066CC",
  accent: "#FFBE0D",
  darkText: "#333333",
  mediumText: "#555555",
  lightText: "#888888",
  lightBg: "#f8f9fa",
  white: "#FFFFFF",
  border: "#e0e0e0",
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
    buildingType?: string | null;
    roofType?: string | null;
    roofAreaSqM?: number | null;
    notes?: string | null;
  };
  roofPolygons?: RoofPolygonData[];
  roofImageBuffer?: Buffer;
  calculatedRoofAreaSqM?: number;
}

function parseProjectSizeFromNotes(notes: string | null | undefined): { dcKw: number; acKw: number } | null {
  if (!notes) return null;
  
  const dcMatch = notes.match(/Estimated PV Size \(DC\):\s*([\d,]+(?:\.\d+)?)\s*kW/i);
  const acMatch = notes.match(/Estimated PV Size \(AC\):\s*([\d,]+(?:\.\d+)?)\s*kW/i);
  
  if (dcMatch) {
    const dcKw = parseFloat(dcMatch[1].replace(/,/g, ''));
    if (!isNaN(dcKw) && dcKw > 0) {
      let acKw: number;
      if (acMatch) {
        acKw = parseFloat(acMatch[1].replace(/,/g, ''));
        if (isNaN(acKw) || acKw <= 0) {
          acKw = Math.round(dcKw * 0.625);
        }
      } else {
        acKw = Math.round(dcKw * 0.625);
      }
      return { dcKw, acKw };
    }
  }
  return null;
}

function calculateZoomForPolygons(
  centerLat: number,
  centerLng: number,
  roofPolygons: RoofPolygonData[],
  imageWidth: number = 800
): number {
  if (!roofPolygons || roofPolygons.length === 0) return 18;
  
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  for (const polygon of roofPolygons) {
    for (const [lng, lat] of polygon.coordinates) {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
  }
  
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
  
  const heightMeters = latSpan * metersPerDegreeLat;
  const widthMeters = lngSpan * metersPerDegreeLng;
  const maxSpanMeters = Math.max(heightMeters, widthMeters);
  
  if (maxSpanMeters > 400) return 16;
  if (maxSpanMeters > 200) return 17;
  return 18;
}

function calculatePolygonCenter(roofPolygons: RoofPolygonData[]): { lat: number; lng: number } | null {
  if (!roofPolygons || roofPolygons.length === 0) return null;
  
  let totalLat = 0, totalLng = 0, count = 0;
  
  for (const polygon of roofPolygons) {
    for (const [lng, lat] of polygon.coordinates) {
      totalLat += lat;
      totalLng += lng;
      count++;
    }
  }
  
  if (count === 0) return null;
  
  return { lat: totalLat / count, lng: totalLng / count };
}

const TEXTS = {
  fr: {
    projectAddress: "Adresse du projet",
    projectDetails: "Détails du projet",
    projectSize: "Taille du projet",
    roofArea: "Surface de toiture",
    buildingType: "Type de bâtiment",
    constructionStart: "Début de construction prévu",
    constructionValue: "Printemps/Été 2028",
    developer: "Développeur / Constructeur",
    developerValue: "Scale Cleantech et kWh Québec",
    buildingSponsor: "Propriétaire / Commanditaire",
    buildingSponsorValue: "Dream Industrial Solar",
    electricityOfftake: "Acheteur d'électricité",
    electricityOfftakeValue: "Hydro-Québec",
    solarTitle: "L'énergie solaire au Québec",
    solarParagraph1: `Le solaire devient rapidement l'une des sources d'électricité les moins chères pour la nouvelle génération à l'échelle mondiale. Dans son dernier appel d'offres, Hydro-Québec a lancé un processus pour acquérir jusqu'à 300 MW de nouvelle production solaire.`,
    solarParagraph2: `La construction de nouvelles installations solaires sur les toitures industrielles est l'une des meilleures façons d'utiliser cette technologie. Non seulement le solaire occupe un espace de toiture sous-utilisé, mais il génère également de l'énergie là où elle est nécessaire. En produisant l'énergie sur place, les services publics minimisent le besoin de lignes à haute tension coûteuses qui s'étendent sur des centaines de kilomètres.`,
    solarParagraph3: `Ce projet fera partie de ce processus d'appel d'offres compétitif. Les soumissions seront présentées en mars 2026 et les projets retenus seront notifiés en janvier 2027.`,
    footerPhone: "Tél: 514.594.5392",
    footerWebsite: "www.kwh.quebec",
    dcLabel: "kW DC",
    acLabel: "kW AC",
    sqmLabel: "m²",
    notAvailable: "À déterminer",
    buildingTypes: {
      industrial: "Industriel",
      commercial: "Commercial",
      institutional: "Institutionnel",
      other: "Autre",
    },
  },
  en: {
    projectAddress: "Project Address",
    projectDetails: "Project Details",
    projectSize: "Project Size",
    roofArea: "Roof Area",
    buildingType: "Building Type",
    constructionStart: "Planned Construction Start",
    constructionValue: "Spring/Summer 2028",
    developer: "Developer / Constructor",
    developerValue: "Scale Cleantech and kWh Québec",
    buildingSponsor: "Building Sponsor / Owner",
    buildingSponsorValue: "Dream Industrial Solar",
    electricityOfftake: "Electricity Offtake",
    electricityOfftakeValue: "Hydro-Québec",
    solarTitle: "Solar in Quebec",
    solarParagraph1: `Solar is quickly becoming one of the cheapest new electricity sources for new generation globally. In its latest call for new generation, Hydro-Québec has recently released an Appel d'offres to acquire up to 300 MW of new solar generation.`,
    solarParagraph2: `Building new solar generation on industrial rooftops is one of the best ways to utilize the technology. Not only does the solar take up underutilized roof space, but it also generates energy right where the energy is needed. By generating energy where it is used, utilities minimize the need for costly high-voltage lines that span for hundreds of kilometers to provide electricity to the major urban industrial areas.`,
    solarParagraph3: `This project will be part of that competitive bidding process. Bids will be submitted in March 2026 and projects awarded will be notified in January 2027.`,
    footerPhone: "Tel: 514.594.5392",
    footerWebsite: "www.kwh.quebec",
    dcLabel: "kW DC",
    acLabel: "kW AC",
    sqmLabel: "m²",
    notAvailable: "TBD",
    buildingTypes: {
      industrial: "Industrial",
      commercial: "Commercial",
      institutional: "Institutional",
      other: "Other",
    },
  },
};

export async function generateProjectInfoSheetPDF(
  data: ProjectInfoData,
  lang: "fr" | "en" = "fr"
): Promise<Buffer> {
  const t = TEXTS[lang];
  
  const doc = new PDFDocument({
    size: "letter",
    margin: 0,
    bufferPages: true,
  });

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 45;
  const contentWidth = pageWidth - 2 * margin;
  const leftColWidth = contentWidth * 0.40;
  const rightColWidth = contentWidth * 0.54;
  const colGap = contentWidth * 0.06;

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const logoPath = path.join(
    process.cwd(),
    "attached_assets",
    lang === "fr"
      ? "kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png"
      : "kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png"
  );

  let yPos = margin;

  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, pageWidth - margin - 140, yPos, { width: 140 });
    } catch (e) {
      doc.fontSize(18).fillColor(COLORS.primary).font("Helvetica-Bold");
      doc.text("kWh Québec", pageWidth - margin - 140, yPos + 10);
      doc.font("Helvetica");
    }
  }

  yPos += 70;

  const fullAddress = [
    data.site.address,
    data.site.city,
    data.site.province || "QC",
    data.site.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  doc.fontSize(11).fillColor(COLORS.lightText).font("Helvetica");
  doc.text(t.projectAddress, margin, yPos);
  yPos += 16;

  doc.fontSize(16).fillColor(COLORS.darkText).font("Helvetica-Bold");
  doc.text(fullAddress || data.site.name, margin, yPos, { width: contentWidth });
  doc.font("Helvetica");
  yPos += 30;

  if (data.roofImageBuffer) {
    const imageHeight = 180;
    try {
      doc.image(data.roofImageBuffer, margin, yPos, {
        width: contentWidth,
        height: imageHeight,
        fit: [contentWidth, imageHeight],
      });
      doc.rect(margin, yPos, contentWidth, imageHeight).strokeColor(COLORS.border).lineWidth(0.5).stroke();
      yPos += imageHeight + 25;
    } catch (e) {
      yPos += 10;
    }
  } else {
    yPos += 10;
  }

  doc.moveTo(margin, yPos).lineTo(margin + contentWidth, yPos).strokeColor(COLORS.border).lineWidth(1).stroke();
  yPos += 20;

  const leftColX = margin;
  const rightColX = margin + leftColWidth + colGap;
  const twoColStartY = yPos;

  const boxPadding = 15;
  const boxInnerWidth = leftColWidth - boxPadding * 2;
  
  const bulletItems: { label: string; value: string }[] = [];
  
  let sizeValue = t.notAvailable;
  const kbKwDc = data.site.kbKwDc;
  
  if (kbKwDc && kbKwDc > 0) {
    const kwAc = Math.round(kbKwDc * 0.85);
    sizeValue = `${Math.round(kbKwDc).toLocaleString()} ${t.dcLabel} / ${kwAc.toLocaleString()} ${t.acLabel}`;
  } else {
    const parsedSize = parseProjectSizeFromNotes(data.site.notes);
    if (parsedSize) {
      sizeValue = `${Math.round(parsedSize.dcKw).toLocaleString()} ${t.dcLabel} / ${Math.round(parsedSize.acKw).toLocaleString()} ${t.acLabel}`;
    }
  }
  bulletItems.push({ label: t.projectSize, value: sizeValue });
  
  const roofArea = data.site.roofAreaSqM || data.calculatedRoofAreaSqM;
  if (roofArea && roofArea > 0) {
    bulletItems.push({ label: t.roofArea, value: `${Math.round(roofArea).toLocaleString()} ${t.sqmLabel}` });
  }
  
  if (data.site.buildingType) {
    const buildingTypeLabel = (t.buildingTypes as Record<string, string>)[data.site.buildingType] || data.site.buildingType;
    bulletItems.push({ label: t.buildingType, value: buildingTypeLabel });
  }
  
  bulletItems.push({ label: t.constructionStart, value: t.constructionValue });
  bulletItems.push({ label: t.developer, value: t.developerValue });
  bulletItems.push({ label: t.buildingSponsor, value: t.buildingSponsorValue });
  bulletItems.push({ label: t.electricityOfftake, value: t.electricityOfftakeValue });

  let totalBulletHeight = 30;
  for (const item of bulletItems) {
    const labelHeight = 12;
    const valueHeight = 14;
    totalBulletHeight += labelHeight + valueHeight + 12;
  }
  totalBulletHeight += boxPadding;

  const boxHeight = Math.max(totalBulletHeight, 240);

  doc.roundedRect(leftColX, twoColStartY, leftColWidth, boxHeight, 6)
    .fillColor(COLORS.primary)
    .fill();

  let bulletY = twoColStartY + boxPadding;

  doc.fontSize(13).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t.projectDetails, leftColX + boxPadding, bulletY, { width: boxInnerWidth });
  doc.font("Helvetica");
  bulletY += 25;

  const drawBulletItemOnBlue = (label: string, value: string, y: number): number => {
    doc.circle(leftColX + boxPadding + 4, y + 5, 2.5).fillColor(COLORS.accent).fill();
    
    doc.fontSize(9).fillColor(COLORS.accent).font("Helvetica-Bold");
    doc.text(label, leftColX + boxPadding + 14, y, { width: boxInnerWidth - 14 });
    doc.font("Helvetica");
    
    const labelHeight = 12;
    
    doc.fontSize(10).fillColor(COLORS.white);
    doc.text(value, leftColX + boxPadding + 14, y + labelHeight + 2, { width: boxInnerWidth - 14 });
    
    const valueHeight = 14;
    
    return y + labelHeight + valueHeight + 12;
  };

  for (const item of bulletItems) {
    bulletY = drawBulletItemOnBlue(item.label, item.value, bulletY);
  }

  let rightYPos = twoColStartY;

  doc.fontSize(13).fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(t.solarTitle, rightColX, rightYPos, { width: rightColWidth });
  doc.font("Helvetica");
  rightYPos += 25;

  doc.fontSize(9.5).fillColor(COLORS.mediumText).font("Helvetica");
  doc.text(t.solarParagraph1, rightColX, rightYPos, { 
    width: rightColWidth, 
    align: "justify",
    lineGap: 2,
  });
  rightYPos = doc.y + 12;

  doc.text(t.solarParagraph2, rightColX, rightYPos, { 
    width: rightColWidth, 
    align: "justify",
    lineGap: 2,
  });
  rightYPos = doc.y + 12;

  doc.text(t.solarParagraph3, rightColX, rightYPos, { 
    width: rightColWidth, 
    align: "justify",
    lineGap: 2,
  });

  const footerY = pageHeight - 50;
  
  doc.moveTo(margin, footerY - 15).lineTo(margin + contentWidth, footerY - 15).strokeColor(COLORS.border).lineWidth(0.5).stroke();

  doc.fontSize(9).fillColor(COLORS.lightText).font("Helvetica");
  
  const cityForFooter = data.site.city || data.site.address || data.site.name;
  doc.text(cityForFooter, margin, footerY, { continued: false });
  
  doc.text(t.footerPhone, margin + contentWidth / 2 - 40, footerY, { align: "center", width: 80 });
  
  doc.fillColor(COLORS.primary).font("Helvetica-Bold");
  doc.text(t.footerWebsite, margin, footerY, { align: "right", width: contentWidth });
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
      const zoom = calculateZoomForPolygons(latitude, longitude, roofPolygons);
      
      const polygonCenter = calculatePolygonCenter(roofPolygons);
      const centerLat = polygonCenter?.lat ?? latitude;
      const centerLng = polygonCenter?.lng ?? longitude;
      
      console.log(`[ProjectInfoSheet] Generating roof image: center=${centerLat},${centerLng}, zoom=${zoom}, polygons=${roofPolygons.length}`);
      
      imageUrl = getRoofVisualizationUrl(
        { latitude: centerLat, longitude: centerLng },
        roofPolygons,
        { width: 800, height: 400, zoom }
      );
    } else {
      console.log(`[ProjectInfoSheet] No polygons, using satellite image: ${latitude},${longitude}`);
      imageUrl = getSatelliteImageUrl(
        { latitude, longitude },
        { width: 800, height: 400, zoom: 18 }
      );
    }

    if (!imageUrl) {
      console.log("[ProjectInfoSheet] No image URL generated (API key missing?)");
      return null;
    }

    console.log(`[ProjectInfoSheet] Fetching image from Google Maps API...`);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.log(`[ProjectInfoSheet] Image fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[ProjectInfoSheet] Image fetched successfully: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error("[ProjectInfoSheet] Failed to fetch roof image:", error);
    return null;
  }
}
