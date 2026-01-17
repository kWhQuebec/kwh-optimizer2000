import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { getRoofVisualizationUrl, getSatelliteImageUrl } from "./googleSolarService";
import {
  BRAND_COLORS,
  PAGE_SIZES,
  DEFAULT_THEME,
  drawModernHeader,
  drawModernFooter,
  drawInfoCard,
  drawSectionTitle,
  drawParagraph,
  drawImageWithBorder,
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
    solarParagraph2: `La construction de nouvelles installations solaires sur les toitures industrielles est l'une des meilleures façons d'utiliser cette technologie. Non seulement le solaire occupe un espace de toiture sous-utilisé, mais il génère également de l'énergie là où elle est nécessaire.`,
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
  const { width: pageWidth, height: pageHeight } = PAGE_SIZES.letter;
  const margin = 50;
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
    } catch (e) {
      console.error("Failed to read logo:", e);
    }
  }

  const fullAddress = [
    data.site.address,
    data.site.city,
    data.site.province || "QC",
    data.site.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  let yPos = drawModernHeader(doc, {
    title: fullAddress || data.site.name,
    subtitle: t.projectAddress,
    logoBuffer,
    pageWidth,
  });

  if (data.roofImageBuffer) {
    const imageWidth = contentWidth;
    const imageHeight = 160;
    
    yPos = drawImageWithBorder(doc, {
      imageBuffer: data.roofImageBuffer,
      x: margin,
      y: yPos,
      width: imageWidth,
      height: imageHeight,
      borderRadius: 6,
      borderColor: BRAND_COLORS.border,
      borderWidth: 1,
    });
    yPos += 20;
  } else {
    yPos += 10;
  }

  const leftColWidth = contentWidth * 0.42;
  const rightColWidth = contentWidth * 0.52;
  const colGap = contentWidth * 0.06;
  const leftColX = margin;
  const rightColX = margin + leftColWidth + colGap;
  
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

  const cardHeight = 50 + bulletItems.length * 35;
  
  drawInfoCard(doc, {
    x: leftColX,
    y: yPos,
    width: leftColWidth,
    height: cardHeight,
    title: t.projectDetails,
    items: bulletItems,
  });

  let rightYPos = drawSectionTitle(doc, {
    x: rightColX,
    y: yPos,
    title: t.solarTitle,
    width: rightColWidth,
  });

  rightYPos = drawParagraph(doc, {
    x: rightColX,
    y: rightYPos,
    text: t.solarParagraph1,
    width: rightColWidth,
    fontSize: 10,
    color: BRAND_COLORS.mediumText,
  });

  rightYPos = drawParagraph(doc, {
    x: rightColX,
    y: rightYPos,
    text: t.solarParagraph2,
    width: rightColWidth,
    fontSize: 10,
    color: BRAND_COLORS.mediumText,
  });

  drawParagraph(doc, {
    x: rightColX,
    y: rightYPos,
    text: t.solarParagraph3,
    width: rightColWidth,
    fontSize: 10,
    color: BRAND_COLORS.mediumText,
  });

  const cityForFooter = data.site.city || data.site.address || data.site.name;
  drawModernFooter(doc, {
    leftText: cityForFooter,
    centerText: t.footerPhone,
    rightText: t.footerWebsite,
    pageWidth,
    pageHeight,
  });

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
