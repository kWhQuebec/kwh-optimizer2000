import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { getRoofVisualizationUrl, getSatelliteImageUrl } from "./googleSolarService";
import {
  BRAND_COLORS,
  PAGE_SIZES,
  createDocument,
  collectBuffer,
} from "./pdfTemplates";

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
  
  console.log(`[ProjectInfoSheet] Polygon bounds: ${maxSpanMeters.toFixed(0)}m span`);
  
  if (maxSpanMeters > 350) return 16;
  if (maxSpanMeters > 200) return 17;
  if (maxSpanMeters > 100) return 18;
  return 19;
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
    projectAddress: "ADRESSE DU PROJET",
    projectDetails: "Détails du projet",
    projectSize: "TAILLE DU PROJET",
    roofArea: "SURFACE DE TOITURE",
    buildingType: "TYPE DE BÂTIMENT",
    constructionStart: "DÉBUT DE CONSTRUCTION PRÉVU",
    constructionValue: "Printemps/Été 2028",
    developer: "DÉVELOPPEUR / CONSTRUCTEUR",
    developerValue: "Scale Cleantech et kWh Québec",
    buildingSponsor: "PROPRIÉTAIRE / COMMANDITAIRE",
    buildingSponsorValue: "Dream Industrial Solar",
    electricityOfftake: "ACHETEUR D'ÉLECTRICITÉ",
    electricityOfftakeValue: "Hydro-Québec",
    solarTitle: "L'énergie solaire au Québec",
    solarParagraph1: `Le solaire devient rapidement l'une des sources d'électricité les moins chères pour la nouvelle génération à l'échelle mondiale. Dans son dernier appel d'offres, Hydro-Québec a lancé un processus pour acquérir jusqu'à 300 MW de nouvelle production solaire.`,
    solarParagraph2: `La construction de nouvelles installations solaires sur les toitures industrielles est l'une des meilleures façons d'utiliser cette technologie. Non seulement le solaire occupe un espace de toiture sous-utilisé, mais il génère également de l'énergie là où elle est nécessaire.`,
    solarParagraph3: `Ce projet fera partie de ce processus d'appel d'offres compétitif. Les soumissions seront présentées en mars 2026 et les projets retenus seront notifiés en janvier 2027.`,
    footerPhone: "Tél: 514.594.5392",
    footerWebsite: "www.kwh.quebec",
    dcLabel: "kW DC",
    acLabel: "kW AC",
    sqmLabel: "m²",
    notAvailable: "À déterminer",
  },
  en: {
    projectAddress: "PROJECT ADDRESS",
    projectDetails: "Project Details",
    projectSize: "PROJECT SIZE",
    roofArea: "ROOF AREA",
    buildingType: "BUILDING TYPE",
    constructionStart: "PLANNED CONSTRUCTION START",
    constructionValue: "Spring/Summer 2028",
    developer: "DEVELOPER / CONSTRUCTOR",
    developerValue: "Scale Cleantech and kWh Québec",
    buildingSponsor: "BUILDING SPONSOR / OWNER",
    buildingSponsorValue: "Dream Industrial Solar",
    electricityOfftake: "ELECTRICITY OFFTAKE",
    electricityOfftakeValue: "Hydro-Québec",
    solarTitle: "Solar Energy in Quebec",
    solarParagraph1: `Solar is quickly becoming one of the cheapest new electricity sources for new generation globally. In its latest call for new generation, Hydro-Québec has released an Appel d'offres to acquire up to 300 MW of new solar generation.`,
    solarParagraph2: `Building new solar generation on industrial rooftops is one of the best ways to utilize the technology. Not only does the solar take up underutilized roof space, but it also generates energy right where the energy is needed.`,
    solarParagraph3: `This project will be part of that competitive bidding process. Bids will be submitted in March 2026 and projects awarded will be notified in January 2027.`,
    footerPhone: "Tel: 514.594.5392",
    footerWebsite: "www.kwh.quebec",
    dcLabel: "kW DC",
    acLabel: "kW AC",
    sqmLabel: "m²",
    notAvailable: "TBD",
  },
};

export async function generateProjectInfoSheetPDF(
  data: ProjectInfoData,
  lang: "fr" | "en" = "fr"
): Promise<Buffer> {
  const t = TEXTS[lang];
  const { width: pageWidth, height: pageHeight } = PAGE_SIZES.letter;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  
  const doc = createDocument("letter");
  const bufferPromise = collectBuffer(doc);

  const logoPath = path.join(
    process.cwd(),
    "attached_assets",
    lang === "fr"
      ? "kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png"
      : "kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png"
  );

  let logoBuffer: Buffer | null = null;
  if (fs.existsSync(logoPath)) {
    try {
      logoBuffer = fs.readFileSync(logoPath);
      console.log(`[ProjectInfoSheet] Loaded rectangular logo from: ${logoPath}`);
    } catch (e) {
      console.error("Failed to read logo:", e);
    }
  } else {
    console.log(`[ProjectInfoSheet] Logo not found: ${logoPath}`);
  }

  const fullAddress = [
    data.site.address,
    [data.site.city, data.site.province || "Québec"].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(", ");

  doc.rect(0, 0, pageWidth, 6).fillColor(BRAND_COLORS.accent).fill();

  let yPos = 25;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, margin, yPos, { width: 160 });
    } catch (e) {
      doc.fontSize(20).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
      doc.text("kWh Québec", margin, yPos + 10);
    }
  } else {
    doc.fontSize(20).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
    doc.text("kWh Québec", margin, yPos + 10);
  }

  yPos = 113;

  doc.fontSize(10).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
  doc.text(t.projectAddress, margin, yPos);
  yPos += 16;

  doc.fontSize(18).fillColor(BRAND_COLORS.darkText).font("Helvetica-Bold");
  const addressLines = doc.heightOfString(fullAddress || data.site.name, { width: contentWidth - 20 });
  doc.text(fullAddress || data.site.name, margin, yPos, { width: contentWidth - 20 });
  yPos += addressLines + 8;

  doc.moveTo(margin, yPos).lineTo(margin + 50, yPos)
    .strokeColor(BRAND_COLORS.accent).lineWidth(3).stroke();
  yPos += 20;

  const imageWidth = 240;
  const imageHeight = 160;
  const detailsX = margin + imageWidth + 25;
  const detailsWidth = contentWidth - imageWidth - 25;
  const topRowY = yPos;

  if (data.roofImageBuffer) {
    try {
      doc.save();
      doc.roundedRect(margin, topRowY, imageWidth, imageHeight, 6).clip();
      doc.image(data.roofImageBuffer, margin, topRowY, { 
        width: imageWidth, 
        height: imageHeight,
        fit: [imageWidth, imageHeight],
        align: 'center',
        valign: 'center'
      });
      doc.restore();
      doc.roundedRect(margin, topRowY, imageWidth, imageHeight, 6)
        .strokeColor(BRAND_COLORS.border).lineWidth(1).stroke();
    } catch (e) {
      doc.roundedRect(margin, topRowY, imageWidth, imageHeight, 6)
        .fillColor(BRAND_COLORS.lightBg).fill();
      doc.fontSize(10).fillColor(BRAND_COLORS.lightText);
      doc.text("Image non disponible", margin + 60, topRowY + 70);
    }
  } else {
    doc.roundedRect(margin, topRowY, imageWidth, imageHeight, 6)
      .fillColor(BRAND_COLORS.lightBg).fill();
  }

  let detailY = topRowY;
  
  doc.fontSize(12).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
  doc.text(t.projectDetails, detailsX, detailY);
  detailY += 22;

  doc.moveTo(detailsX, detailY - 4).lineTo(detailsX + 40, detailY - 4)
    .strokeColor(BRAND_COLORS.accent).lineWidth(2).stroke();

  const bulletItems: Array<{ label: string; value: string }> = [];
  
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
  
  bulletItems.push({ label: t.constructionStart, value: t.constructionValue });
  bulletItems.push({ label: t.developer, value: t.developerValue });
  bulletItems.push({ label: t.buildingSponsor, value: t.buildingSponsorValue });
  bulletItems.push({ label: t.electricityOfftake, value: t.electricityOfftakeValue });

  for (const item of bulletItems) {
    doc.circle(detailsX + 4, detailY + 5, 2.5).fillColor(BRAND_COLORS.accent).fill();
    
    doc.fontSize(7).fillColor(BRAND_COLORS.mediumText).font("Helvetica-Bold");
    doc.text(item.label, detailsX + 14, detailY, { width: detailsWidth - 14 });
    detailY += 12;
    
    doc.fontSize(10).fillColor(BRAND_COLORS.darkText).font("Helvetica");
    doc.text(item.value, detailsX + 14, detailY, { width: detailsWidth - 14 });
    detailY += 22;
  }

  yPos = Math.max(topRowY + imageHeight, detailY) + 30;

  doc.rect(margin, yPos, contentWidth, 1).fillColor(BRAND_COLORS.border).fill();
  yPos += 20;

  doc.fontSize(14).fillColor(BRAND_COLORS.primary).font("Helvetica-Bold");
  doc.text(t.solarTitle, margin, yPos);
  yPos += 22;

  doc.moveTo(margin, yPos - 6).lineTo(margin + 50, yPos - 6)
    .strokeColor(BRAND_COLORS.accent).lineWidth(2).stroke();

  const textWidth = contentWidth;
  const lineHeight = 14;

  doc.fontSize(10).fillColor(BRAND_COLORS.darkText).font("Helvetica");
  doc.text(t.solarParagraph1, margin, yPos, { 
    width: textWidth, 
    lineGap: 4,
    align: 'justify'
  });
  yPos += doc.heightOfString(t.solarParagraph1, { width: textWidth, lineGap: 4 }) + 12;

  doc.text(t.solarParagraph2, margin, yPos, { 
    width: textWidth, 
    lineGap: 4,
    align: 'justify'
  });
  yPos += doc.heightOfString(t.solarParagraph2, { width: textWidth, lineGap: 4 }) + 12;

  doc.text(t.solarParagraph3, margin, yPos, { 
    width: textWidth, 
    lineGap: 4,
    align: 'justify'
  });

  const footerHeight = 45;
  const footerY = pageHeight - footerHeight;
  
  doc.rect(0, footerY, pageWidth, footerHeight).fillColor(BRAND_COLORS.primary).fill();
  
  const footerTextY = footerY + (footerHeight - 12) / 2;
  
  doc.fontSize(10).fillColor(BRAND_COLORS.white).font("Helvetica");
  doc.text(data.site.city || "Montreal", margin, footerTextY);
  
  doc.text(t.footerPhone, pageWidth / 2 - 50, footerTextY, { width: 100, align: "center" });
  
  doc.font("Helvetica-Bold");
  doc.text(t.footerWebsite, margin, footerTextY, { width: contentWidth, align: "right" });

  doc.end();

  return bufferPromise;
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
        { width: 1000, height: 600, zoom }
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
