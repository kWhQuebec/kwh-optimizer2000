import * as GeoTIFF from "geotiff";
import { ai } from "./replit_integrations/image/client";
import { createLogger } from "./lib/logger";

const log = createLogger("RoofConstraintDetector");

// --- Types ---

export interface DetectorInput {
  latitude: number;
  longitude: number;
  solarPolygons: Array<{ coordinates: [number, number][]; label?: string }>;
  dsmUrl: string;
  annualFluxUrl?: string;
  rgbUrl?: string;
}

export interface DetectedConstraint {
  coordinates: [number, number][];
  areaSqM: number;
  label: string;
  source: "dsm" | "flux" | "vision" | "shadow";
  estimatedHeightM?: number;
  confidence?: string;
}

export interface DetectorResult {
  constraints: DetectedConstraint[];
  analysisNotes: string;
}

interface TiePointScale {
  tiePoint: number[]; // [pixelX, pixelY, pixelZ, geoX, geoY, geoZ]
  scale: number[];    // [scaleX, scaleY, scaleZ]
}

// --- Coordinate helpers ---

function pixelToLatLng(
  px: number,
  py: number,
  meta: TiePointScale
): [number, number] {
  const lng = meta.tiePoint[3] + (px - meta.tiePoint[0]) * meta.scale[0];
  const lat = meta.tiePoint[4] - (py - meta.tiePoint[1]) * meta.scale[1];
  return [lng, lat];
}

function latLngToPixel(
  lat: number,
  lng: number,
  meta: TiePointScale
): [number, number] {
  const px = meta.tiePoint[0] + (lng - meta.tiePoint[3]) / meta.scale[0];
  const py = meta.tiePoint[1] + (meta.tiePoint[4] - lat) / meta.scale[1];
  return [Math.round(px), Math.round(py)];
}

// --- Geometry helpers ---

/** Scanline point-in-polygon test */
function isPointInPolygon(
  x: number,
  y: number,
  polygon: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Create bitmask of pixels inside polygon (in pixel coordinates) */
function createPolygonMask(
  polygonPixels: [number, number][],
  width: number,
  height: number
): Uint8Array {
  const mask = new Uint8Array(width * height);
  let minX = width,
    maxX = 0,
    minY = height,
    maxY = 0;
  for (const [px, py] of polygonPixels) {
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  }
  minX = Math.max(0, minX);
  maxX = Math.min(width - 1, maxX);
  minY = Math.max(0, minY);
  maxY = Math.min(height - 1, maxY);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (isPointInPolygon(x, y, polygonPixels)) {
        mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}

/** Flood-fill connected components (8-connectivity) */
function connectedComponents(
  obstacleMask: Uint8Array,
  width: number,
  height: number
): number[][] {
  const labels = new Int32Array(width * height);
  const components: number[][] = [];
  let currentLabel = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (obstacleMask[idx] === 1 && labels[idx] === 0) {
        currentLabel++;
        const component: number[] = [];
        const stack = [idx];
        while (stack.length > 0) {
          const ci = stack.pop()!;
          if (labels[ci] !== 0) continue;
          labels[ci] = currentLabel;
          component.push(ci);
          const cx = ci % width;
          const cy = (ci - cx) / width;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const ni = ny * width + nx;
                if (obstacleMask[ni] === 1 && labels[ni] === 0) {
                  stack.push(ni);
                }
              }
            }
          }
        }
        components.push(component);
      }
    }
  }
  return components;
}

/** Convex hull using Graham scan */
function convexHull(points: [number, number][]): [number, number][] {
  if (points.length <= 3) return points;

  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (
      points[i][1] < points[start][1] ||
      (points[i][1] === points[start][1] && points[i][0] < points[start][0])
    ) {
      start = i;
    }
  }
  [points[0], points[start]] = [points[start], points[0]];
  const pivot = points[0];

  const sorted = points.slice(1).sort((a, b) => {
    const cross =
      (a[0] - pivot[0]) * (b[1] - pivot[1]) -
      (b[0] - pivot[0]) * (a[1] - pivot[1]);
    if (cross !== 0) return -cross;
    const distA =
      (a[0] - pivot[0]) ** 2 + (a[1] - pivot[1]) ** 2;
    const distB =
      (b[0] - pivot[0]) ** 2 + (b[1] - pivot[1]) ** 2;
    return distA - distB;
  });

  const hull: [number, number][] = [pivot];
  for (const p of sorted) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross =
        (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      if (cross <= 0) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(p);
  }
  return hull;
}

/** Simplify polygon by reducing point count (Ramer-Douglas-Peucker) */
function simplifyPolygon(
  points: [number, number][],
  epsilon: number
): [number, number][] {
  if (points.length <= 4) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDist(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPolygon(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyPolygon(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}

function perpendicularDist(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): number {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0)
    return Math.sqrt(
      (point[0] - lineStart[0]) ** 2 + (point[1] - lineStart[1]) ** 2
    );
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) /
        lenSq
    )
  );
  const proj: [number, number] = [
    lineStart[0] + t * dx,
    lineStart[1] + t * dy,
  ];
  return Math.sqrt(
    (point[0] - proj[0]) ** 2 + (point[1] - proj[1]) ** 2
  );
}

// --- GeoTIFF parsing ---

async function fetchAndParseGeoTIFF(
  url: string,
  apiKey: string,
  centerLat?: number,
  radiusMeters?: number
): Promise<{
  raster: Float32Array | Float64Array | Uint8Array | Uint16Array | Int16Array;
  width: number;
  height: number;
  meta: TiePointScale;
}> {
  let urlWithKey = url;
  if (!url.includes("key=")) {
    const separator = url.includes("?") ? "&" : "?";
    urlWithKey = `${url}${separator}key=${apiKey}`;
  }

  log.info(`Fetching GeoTIFF: ${urlWithKey.substring(0, 80)}...`);
  const response = await fetch(urlWithKey);
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to fetch GeoTIFF: ${response.status} ${errorText.substring(0, 200)}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error("GeoTIFF response was empty");
  }
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const raster = rasters[0] as Float32Array;
  if (!raster || raster.length === 0) {
    throw new Error("GeoTIFF contained no raster data");
  }
  const width = image.getWidth();
  const height = image.getHeight();

  const fileDirectory = image.fileDirectory as any;
  let tiePoint = fileDirectory.ModelTiepoint;
  let scale = fileDirectory.ModelPixelScale;
  const modelTransformation = fileDirectory.ModelTransformation;

  if (!scale && modelTransformation && modelTransformation.length >= 16) {
    log.info("ModelPixelScale absent, deriving from ModelTransformation matrix");
    const scaleX = Math.abs(modelTransformation[0]);
    const scaleY = Math.abs(modelTransformation[5]);
    const originX = modelTransformation[3];
    const originY = modelTransformation[7];
    const scaleZ = modelTransformation.length > 10 ? Math.abs(modelTransformation[10]) : 1;

    scale = [scaleX, scaleY, scaleZ];
    tiePoint = [0, 0, 0, originX, originY, 0];

    log.info(`Derived scale: [${scaleX.toFixed(10)}, ${scaleY.toFixed(10)}], origin: [${originX.toFixed(6)}, ${originY.toFixed(6)}]`);
  }

  if (!tiePoint) {
    tiePoint = [0, 0, 0, 0, 0, 0];
  }
  if (!scale) {
    scale = [1, 1, 1];
  }

  const finalScale = Array.from(scale) as number[];
  const finalTiePoint = Array.from(tiePoint) as number[];

  if (finalScale[0] > 0.01) {
    const effectiveRadius = radiusMeters || 75;
    const effectiveLat = centerLat || finalTiePoint[4] || 46.8;
    const coverageM = effectiveRadius * 2;
    const metersPerDegLng = 111320 * Math.cos((effectiveLat * Math.PI) / 180);
    const metersPerDegLat = 111320;
    const computedScaleX = coverageM / (width * metersPerDegLng);
    const computedScaleY = coverageM / (height * metersPerDegLat);

    log.warn(`Scale unreasonably large: [${finalScale[0].toFixed(6)}, ${finalScale[1].toFixed(6)}] (>${0.01}° per pixel). Recomputing from image bounds.`);
    log.info(`Using radius=${effectiveRadius}m, lat=${effectiveLat.toFixed(2)}, image=${width}x${height}`);
    log.info(`Computed scale: [${computedScaleX.toFixed(10)}, ${computedScaleY.toFixed(10)}]`);

    finalScale[0] = computedScaleX;
    finalScale[1] = computedScaleY;

    if (finalTiePoint[3] === 0 && finalTiePoint[4] === 0 && effectiveLat) {
      const lng = centerLat ? (finalTiePoint[3] || 0) : 0;
      const lat = effectiveLat;
      finalTiePoint[3] = lng - (width / 2) * computedScaleX;
      finalTiePoint[4] = lat + (height / 2) * computedScaleY;
      log.info(`Estimated tiePoint origin: [${finalTiePoint[3].toFixed(6)}, ${finalTiePoint[4].toFixed(6)}]`);
    }
  }

  log.info(`GeoTIFF parsed: ${width}x${height}, scale=[${finalScale[0].toFixed(10)}, ${finalScale[1].toFixed(10)}]`);

  return {
    raster: raster as Float32Array,
    width,
    height,
    meta: { tiePoint: finalTiePoint, scale: finalScale },
  };
}

/** Compute median of an array of numbers */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// --- DSM obstacle detection ---

function detectDSMObstacles(
  raster: Float32Array | Float64Array | Uint8Array | Uint16Array | Int16Array,
  width: number,
  height: number,
  meta: TiePointScale,
  solarPolygons: Array<{ coordinates: [number, number][] }>,
  minAreaSqM: number = 1
): DetectedConstraint[] {
  const constraints: DetectedConstraint[] = [];
  const latCenter = meta.tiePoint[4] - (height / 2) * meta.scale[1];
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((latCenter * Math.PI) / 180);
  const pixelWidthM = meta.scale[0] * metersPerDegLng;
  const pixelHeightM = meta.scale[1] * metersPerDegLat;
  const pixelArea = pixelWidthM * pixelHeightM;

  log.info(`DSM pixel size: ${pixelWidthM.toFixed(3)}m x ${pixelHeightM.toFixed(3)}m = ${pixelArea.toFixed(4)} m²/pixel`);

  for (const polygon of solarPolygons) {
    const polygonPixels: [number, number][] = polygon.coordinates.map(
      ([lng, lat]) => latLngToPixel(lat, lng, meta)
    );

    const mask = createPolygonMask(polygonPixels, width, height);

    const elevations: number[] = [];
    const maskedIndices: number[] = [];
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        const val = raster[i];
        if (val !== 0 && !isNaN(val)) {
          elevations.push(val);
          maskedIndices.push(i);
        }
      }
    }

    if (elevations.length < 10) {
      log.warn(`Polygon has only ${elevations.length} valid pixels, skipping DSM analysis`);
      continue;
    }

    log.info(`Polygon: ${elevations.length} pixels inside mask`);

    const roofMedian = median(elevations);
    const threshold = roofMedian + 0.3;

    const obstacleMask = new Uint8Array(width * height);
    for (const idx of maskedIndices) {
      if (raster[idx] > threshold) {
        obstacleMask[idx] = 1;
      }
    }

    const components = connectedComponents(obstacleMask, width, height);

    for (const component of components) {
      const areaSqM = component.length * pixelArea;
      if (areaSqM < minAreaSqM) continue;

      const pixelPoints: [number, number][] = component.map((idx) => {
        const x = idx % width;
        const y = (idx - x) / width;
        return [x, y] as [number, number];
      });

      let hull = convexHull(pixelPoints);
      if (hull.length > 8) {
        hull = simplifyPolygon(hull, 1.5);
        if (hull.length < 3) hull = convexHull(pixelPoints);
      }

      const geoCoords: [number, number][] = hull.map(([px, py]) =>
        pixelToLatLng(px, py, meta)
      );

      const componentElevations = component.map((idx) => raster[idx]);
      const maxElevation = Math.max(...componentElevations);
      const heightAboveRoof = maxElevation - roofMedian;

      constraints.push({
        coordinates: geoCoords,
        areaSqM: Math.round(areaSqM * 10) / 10,
        label: `Obstacle — ${Math.round(areaSqM)} m²`,
        source: "dsm",
        estimatedHeightM: Math.round(heightAboveRoof * 10) / 10,
      });
    }
  }

  return constraints;
}

// --- Flux shadow detection ---

function detectFluxShadows(
  fluxRaster: Float32Array | Float64Array | Uint8Array | Uint16Array | Int16Array,
  width: number,
  height: number,
  meta: TiePointScale,
  solarPolygons: Array<{ coordinates: [number, number][] }>,
  dsmConstraints: DetectedConstraint[],
  minAreaSqM: number = 3
): DetectedConstraint[] {
  const constraints: DetectedConstraint[] = [];
  const latCenter = meta.tiePoint[4] - (height / 2) * meta.scale[1];
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((latCenter * Math.PI) / 180);
  const pixelWidthM = meta.scale[0] * metersPerDegLng;
  const pixelHeightM = meta.scale[1] * metersPerDegLat;
  const pixelArea = pixelWidthM * pixelHeightM;

  for (const polygon of solarPolygons) {
    const polygonPixels: [number, number][] = polygon.coordinates.map(
      ([lng, lat]) => latLngToPixel(lat, lng, meta)
    );

    const mask = createPolygonMask(polygonPixels, width, height);

    const fluxValues: number[] = [];
    const maskedIndices: number[] = [];
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        const val = fluxRaster[i];
        if (val > 0 && !isNaN(val)) {
          fluxValues.push(val);
          maskedIndices.push(i);
        }
      }
    }

    if (fluxValues.length < 10) continue;

    const meanFlux =
      fluxValues.reduce((a, b) => a + b, 0) / fluxValues.length;
    const shadowThreshold = meanFlux * 0.7;

    const shadowMask = new Uint8Array(width * height);
    for (const idx of maskedIndices) {
      if (fluxRaster[idx] < shadowThreshold) {
        shadowMask[idx] = 1;
      }
    }

    const components = connectedComponents(shadowMask, width, height);

    for (const component of components) {
      const areaSqM = component.length * pixelArea;
      if (areaSqM < minAreaSqM) continue;

      const pixelPoints: [number, number][] = component.map((idx) => {
        const x = idx % width;
        const y = (idx - x) / width;
        return [x, y] as [number, number];
      });

      let hull = convexHull(pixelPoints);
      if (hull.length > 8) {
        hull = simplifyPolygon(hull, 1.5);
        if (hull.length < 3) hull = convexHull(pixelPoints);
      }

      const geoCoords: [number, number][] = hull.map(([px, py]) =>
        pixelToLatLng(px, py, meta)
      );

      const centroidLng =
        geoCoords.reduce((s, c) => s + c[0], 0) / geoCoords.length;
      const centroidLat =
        geoCoords.reduce((s, c) => s + c[1], 0) / geoCoords.length;
      const overlaps = dsmConstraints.some((dc) =>
        isPointInPolygon(centroidLng, centroidLat, dc.coordinates)
      );
      if (overlaps) continue;

      constraints.push({
        coordinates: geoCoords,
        areaSqM: Math.round(areaSqM * 10) / 10,
        label: `Zone ombragée — ${Math.round(areaSqM)} m²`,
        source: "flux",
      });
    }
  }

  return constraints;
}

// --- Gemini Vision primary detection ---

async function detectWithGeminiVision(
  rgbUrl: string,
  apiKey: string,
  meta: TiePointScale,
  imageWidth: number,
  imageHeight: number
): Promise<DetectedConstraint[]> {
  let urlWithKey = rgbUrl;
  if (!rgbUrl.includes("key=")) {
    const separator = rgbUrl.includes("?") ? "&" : "?";
    urlWithKey = `${rgbUrl}${separator}key=${apiKey}`;
  }

  log.info("Fetching RGB image for Gemini Vision detection...");
  const response = await fetch(urlWithKey);
  if (!response.ok) {
    throw new Error(`Failed to fetch RGB image: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  log.info(`RGB image fetched: ${(buffer.byteLength / 1024).toFixed(0)} KB`);

  const prompt = `You are an expert rooftop obstacle detection system for commercial and industrial (C&I) solar installations.

Analyze this satellite/aerial image of a commercial or industrial rooftop. Detect ALL rooftop obstacles, equipment, and features that would prevent solar panel installation.

Look specifically for:
- HVAC units, RTU (rooftop units), air handlers, condensers
- Ventilation exhausts, turbine vents, plumbing vents, pipes
- Skylights, roof hatches, access points
- Parapets and raised edges along roof perimeters
- Drain systems and scuppers
- Satellite dishes, antennas
- Mechanical penthouses, elevator shafts
- Existing equipment pads or platforms
- Any other obstructions or raised features

For each detected obstacle, provide its location as a bounding box using percentage coordinates relative to the image dimensions (0-100%).

Return ONLY a valid JSON array (no markdown, no explanation). Each element:
[{
  "type": "HVAC",
  "label_fr": "Unité CVC",
  "label_en": "HVAC Unit",
  "x_pct": 45.2,
  "y_pct": 30.1,
  "width_pct": 8.5,
  "height_pct": 6.2,
  "estimated_height_m": 1.5,
  "confidence": "high"
}]

Rules:
- x_pct, y_pct = top-left corner of bounding box as % of image width/height
- width_pct, height_pct = size as % of image width/height
- estimated_height_m = your best estimate of the obstacle height in meters
- confidence = "high", "medium", or "low"
- label_fr = French label, label_en = English label
- If no obstacles are found, return an empty array []
- Be thorough — even small vents and pipes matter for solar layout`;

  log.info("Sending image to Gemini Vision for obstacle detection...");
  const aiResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/tiff",
              data: base64,
            },
          },
          { text: prompt },
        ],
      },
    ],
  });

  const candidate = aiResponse.candidates?.[0];
  const textPart = candidate?.content?.parts?.find(
    (part: { text?: string }) => part.text
  );

  if (!textPart?.text) {
    throw new Error("No text response from Gemini Vision detection");
  }

  const jsonMatch = textPart.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    log.warn("No JSON array found in Gemini Vision response, checking for empty result");
    return [];
  }

  const detections = JSON.parse(jsonMatch[0]) as Array<{
    type: string;
    label_fr: string;
    label_en: string;
    x_pct: number;
    y_pct: number;
    width_pct: number;
    height_pct: number;
    estimated_height_m: number;
    confidence: string;
  }>;

  log.info(`Gemini Vision detected ${detections.length} obstacles`);

  const constraints: DetectedConstraint[] = [];

  for (const det of detections) {
    const x1 = (det.x_pct / 100) * imageWidth;
    const y1 = (det.y_pct / 100) * imageHeight;
    const x2 = ((det.x_pct + det.width_pct) / 100) * imageWidth;
    const y2 = ((det.y_pct + det.height_pct) / 100) * imageHeight;

    const topLeft = pixelToLatLng(x1, y1, meta);
    const topRight = pixelToLatLng(x2, y1, meta);
    const bottomRight = pixelToLatLng(x2, y2, meta);
    const bottomLeft = pixelToLatLng(x1, y2, meta);

    const coordinates: [number, number][] = [topLeft, topRight, bottomRight, bottomLeft];

    const latCenter = meta.tiePoint[4] - (imageHeight / 2) * meta.scale[1];
    const metersPerDegLng = 111320 * Math.cos((latCenter * Math.PI) / 180);
    const metersPerDegLat = 111320;
    const widthM = (det.width_pct / 100) * imageWidth * meta.scale[0] * metersPerDegLng;
    const heightM = (det.height_pct / 100) * imageHeight * meta.scale[1] * metersPerDegLat;
    const areaSqM = widthM * heightM;

    constraints.push({
      coordinates,
      areaSqM: Math.round(areaSqM * 10) / 10,
      label: `${det.label_fr} — ${Math.round(areaSqM)} m²`,
      source: "vision",
      estimatedHeightM: det.estimated_height_m || undefined,
      confidence: det.confidence,
    });
  }

  return constraints;
}

// --- Shadow projection ---

interface SunPosition {
  altitude: number;
  azimuth: number;
  label: string;
}

function getWinterSolsticeSunPositions(): SunPosition[] {
  return [
    { altitude: 15, azimuth: 150, label: "10h solstice hiver" },
    { altitude: 19.75, azimuth: 180, label: "12h solstice hiver" },
    { altitude: 15, azimuth: 210, label: "14h solstice hiver" },
  ];
}

function projectShadows(
  obstacles: DetectedConstraint[],
  latitude: number
): DetectedConstraint[] {
  const shadows: DetectedConstraint[] = [];
  const sunPositions = getWinterSolsticeSunPositions();

  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((latitude * Math.PI) / 180);

  const obstaclesWithHeight = obstacles.filter(
    (o) => o.estimatedHeightM && o.estimatedHeightM > 0.3 && o.source !== "shadow"
  );

  log.info(`Projecting shadows for ${obstaclesWithHeight.length} obstacles with height data`);

  for (const obstacle of obstaclesWithHeight) {
    const heightM = obstacle.estimatedHeightM!;

    for (const sun of sunPositions) {
      const altRad = (sun.altitude * Math.PI) / 180;
      const shadowLength = heightM / Math.tan(altRad);

      if (shadowLength < 0.5) continue;

      const shadowDirectionDeg = (sun.azimuth + 180) % 360;
      const shadowDirRad = (shadowDirectionDeg * Math.PI) / 180;

      const dxM = shadowLength * Math.sin(shadowDirRad);
      const dyM = shadowLength * Math.cos(shadowDirRad);
      const dLng = dxM / metersPerDegLng;
      const dLat = dyM / metersPerDegLat;

      const shadowCoords: [number, number][] = obstacle.coordinates.map(
        ([lng, lat]) => [lng + dLng, lat + dLat] as [number, number]
      );

      const allCoords = [...obstacle.coordinates, ...shadowCoords];
      let hull = convexHull([...allCoords]);
      if (hull.length > 8) {
        hull = simplifyPolygon(hull, 0.000001);
        if (hull.length < 3) hull = convexHull([...allCoords]);
      }

      const centLng = hull.reduce((s, c) => s + c[0], 0) / hull.length;
      const centLat = hull.reduce((s, c) => s + c[1], 0) / hull.length;

      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const [lng, lat] of hull) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
      const areaM2 = (maxLng - minLng) * metersPerDegLng * (maxLat - minLat) * metersPerDegLat;

      const existingShadow = shadows.find((s) => {
        const sCentLng = s.coordinates.reduce((sum, c) => sum + c[0], 0) / s.coordinates.length;
        const sCentLat = s.coordinates.reduce((sum, c) => sum + c[1], 0) / s.coordinates.length;
        const distM = Math.sqrt(
          ((centLng - sCentLng) * metersPerDegLng) ** 2 +
          ((centLat - sCentLat) * metersPerDegLat) ** 2
        );
        return distM < 2;
      });

      if (existingShadow) {
        if (areaM2 > existingShadow.areaSqM) {
          existingShadow.coordinates = hull;
          existingShadow.areaSqM = Math.round(areaM2 * 10) / 10;
          existingShadow.label = `Zone d'ombre projetée — ${Math.round(areaM2)} m² (${sun.label})`;
        }
        continue;
      }

      shadows.push({
        coordinates: hull,
        areaSqM: Math.round(areaM2 * 10) / 10,
        label: `Zone d'ombre projetée — ${Math.round(areaM2)} m² (${sun.label})`,
        source: "shadow",
      });
    }
  }

  log.info(`Shadow projection: ${shadows.length} shadow zones generated`);
  return shadows;
}

// --- Gemini Vision classification ---

async function classifyWithGemini(
  rgbUrl: string,
  apiKey: string,
  constraints: DetectedConstraint[],
  meta: TiePointScale,
  imageWidth: number,
  imageHeight: number
): Promise<DetectedConstraint[]> {
  if (constraints.length === 0) return constraints;

  const unlabeled = constraints.filter(
    (c) => c.source === "dsm" || c.source === "flux"
  );
  if (unlabeled.length === 0) return constraints;

  try {
    let urlWithKey = rgbUrl;
    if (!rgbUrl.includes("key=")) {
      const separator = rgbUrl.includes("?") ? "&" : "?";
      urlWithKey = `${rgbUrl}${separator}key=${apiKey}`;
    }
    const response = await fetch(urlWithKey);
    if (!response.ok) {
      log.warn("Could not fetch RGB image for classification, using generic labels");
      return constraints;
    }
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const obstacleDescriptions = unlabeled.map((c, i) => {
      const centroidLng =
        c.coordinates.reduce((s, p) => s + p[0], 0) / c.coordinates.length;
      const centroidLat =
        c.coordinates.reduce((s, p) => s + p[1], 0) / c.coordinates.length;
      const [px, py] = latLngToPixel(centroidLat, centroidLng, meta);
      const clampedX = Math.max(0, Math.min(imageWidth - 1, px));
      const clampedY = Math.max(0, Math.min(imageHeight - 1, py));
      return `Obstacle ${i + 1}: pixel position (${clampedX}, ${clampedY}), area ${c.areaSqM} m², source: ${c.source}`;
    });

    const prompt = `This is a satellite view of a commercial/industrial rooftop. I detected ${unlabeled.length} obstacles on this roof.
Their approximate pixel locations and areas are:
${obstacleDescriptions.join("\n")}

For each obstacle, classify it as one of these categories:
- CVC/HVAC
- Ventilation
- Cheminée/Chimney
- Puits de lumière/Skylight
- Parapet
- Antenne/Antenna
- Conduit
- Zone ombragée/Shadow zone
- Inconnu/Unknown

Return ONLY a valid JSON array:
[{ "id": 1, "label_fr": "CVC/HVAC", "label_en": "HVAC" }, ...]`;

    const aiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/tiff",
                data: base64,
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    const candidate = aiResponse.candidates?.[0];
    const textPart = candidate?.content?.parts?.find(
      (part: { text?: string }) => part.text
    );

    if (!textPart?.text) {
      log.warn("No text response from Gemini classification");
      return constraints;
    }

    const jsonMatch = textPart.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log.warn("No JSON array found in Gemini response");
      return constraints;
    }

    const classifications = JSON.parse(jsonMatch[0]) as Array<{
      id: number;
      label_fr: string;
      label_en: string;
    }>;

    let classifiedIdx = 0;
    return constraints.map((c) => {
      if (c.source === "dsm" || c.source === "flux") {
        const classification = classifications.find((cl) => cl.id === classifiedIdx + 1);
        classifiedIdx++;
        if (classification) {
          const label = `${classification.label_fr} — ${c.areaSqM} m²`;
          return { ...c, label };
        }
      }
      return c;
    });
  } catch (error) {
    log.warn(
      "Gemini classification failed, using generic labels:",
      error instanceof Error ? error.message : error
    );
    return constraints;
  }
}

// --- Deduplication ---

function deduplicateConstraints(
  visionConstraints: DetectedConstraint[],
  dsmConstraints: DetectedConstraint[]
): DetectedConstraint[] {
  const merged: DetectedConstraint[] = [...visionConstraints];
  const metersPerDegLat = 111320;

  for (const dsmC of dsmConstraints) {
    const dsmCentLng = dsmC.coordinates.reduce((s, c) => s + c[0], 0) / dsmC.coordinates.length;
    const dsmCentLat = dsmC.coordinates.reduce((s, c) => s + c[1], 0) / dsmC.coordinates.length;
    const metersPerDegLng = 111320 * Math.cos((dsmCentLat * Math.PI) / 180);

    const overlapIdx = merged.findIndex((vc) => {
      const vcCentLng = vc.coordinates.reduce((s, c) => s + c[0], 0) / vc.coordinates.length;
      const vcCentLat = vc.coordinates.reduce((s, c) => s + c[1], 0) / vc.coordinates.length;
      const distM = Math.sqrt(
        ((dsmCentLng - vcCentLng) * metersPerDegLng) ** 2 +
        ((dsmCentLat - vcCentLat) * metersPerDegLat) ** 2
      );
      return distM < 3;
    });

    if (overlapIdx >= 0) {
      const existing = merged[overlapIdx];
      if (dsmC.estimatedHeightM && (!existing.estimatedHeightM || dsmC.estimatedHeightM > existing.estimatedHeightM)) {
        merged[overlapIdx] = {
          ...existing,
          estimatedHeightM: dsmC.estimatedHeightM,
        };
      }
      log.info(`Dedup: DSM obstacle overlaps with vision detection, keeping vision label`);
    } else {
      merged.push(dsmC);
    }
  }

  return merged;
}

// --- Main detection function ---

export async function detectRoofConstraints(
  input: DetectorInput
): Promise<DetectorResult> {
  const apiKey = process.env.GOOGLE_SOLAR_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_SOLAR_API_KEY not configured");
  }

  const notes: string[] = [];
  let allConstraints: DetectedConstraint[] = [];

  let dsm: { raster: Float32Array | Float64Array | Uint8Array | Uint16Array | Int16Array; width: number; height: number; meta: TiePointScale } | null = null;
  let dsmConstraints: DetectedConstraint[] = [];
  let visionConstraints: DetectedConstraint[] = [];

  // Step 1: Gemini Vision detection (primary — works on all roofs)
  if (input.rgbUrl) {
    try {
      log.info("Step 1: Running Gemini Vision obstacle detection (primary)...");
      const rgbGeoTiff = await fetchAndParseGeoTIFF(input.rgbUrl, apiKey, input.latitude, 75);
      visionConstraints = await detectWithGeminiVision(
        input.rgbUrl,
        apiKey,
        rgbGeoTiff.meta,
        rgbGeoTiff.width,
        rgbGeoTiff.height
      );
      notes.push(`Vision detection: ${visionConstraints.length} obstacle(s) detected by Gemini`);
      log.info(`Vision: ${visionConstraints.length} obstacles detected`);
    } catch (err) {
      log.warn("Gemini Vision detection failed, will rely on DSM:", err instanceof Error ? err.message : err);
      notes.push(`Vision detection: failed (${err instanceof Error ? err.message : "unknown error"})`);
    }
  } else {
    notes.push("Vision detection: skipped (no RGB URL)");
  }

  // Step 2: DSM analysis (secondary — confirms heights)
  log.info("Step 2: Parsing DSM GeoTIFF...");
  try {
    dsm = await fetchAndParseGeoTIFF(input.dsmUrl, apiKey, input.latitude, 75);
    log.info(
      `DSM loaded: ${dsm.width}x${dsm.height} pixels, scale: ${dsm.meta.scale[0].toFixed(8)}°x${dsm.meta.scale[1].toFixed(8)}°`
    );

    dsmConstraints = detectDSMObstacles(
      dsm.raster,
      dsm.width,
      dsm.height,
      dsm.meta,
      input.solarPolygons
    );
    notes.push(
      `DSM analysis: ${dsmConstraints.length} obstacle(s) detected above roof level`
    );
    log.info(`DSM: ${dsmConstraints.length} obstacles detected`);
  } catch (err) {
    log.error("DSM analysis failed:", err);
    notes.push(`DSM analysis: failed (${err instanceof Error ? err.message : "unknown error"})`);
  }

  // Step 3: Merge and deduplicate vision + DSM results
  if (visionConstraints.length > 0 && dsmConstraints.length > 0) {
    log.info("Step 3: Merging and deduplicating vision + DSM results...");
    allConstraints = deduplicateConstraints(visionConstraints, dsmConstraints);
    notes.push(`Merge: ${allConstraints.length} unique obstacles after deduplication`);
  } else if (visionConstraints.length > 0) {
    allConstraints = [...visionConstraints];
  } else {
    allConstraints = [...dsmConstraints];
  }

  // Step 4: Project shadows from all detected obstacles
  log.info("Step 4: Projecting shadows...");
  const shadowConstraints = projectShadows(allConstraints, input.latitude);
  if (shadowConstraints.length > 0) {
    allConstraints.push(...shadowConstraints);
    notes.push(`Shadow projection: ${shadowConstraints.length} shadow zone(s) projected`);
  } else {
    notes.push("Shadow projection: no shadow zones (no obstacles with height data)");
  }

  // Step 5: Parse annualFlux GeoTIFF for flux-based shadow detection
  if (input.annualFluxUrl) {
    try {
      log.info("Step 5: Parsing annualFlux GeoTIFF...");
      const flux = await fetchAndParseGeoTIFF(input.annualFluxUrl, apiKey, input.latitude, 75);
      const fluxConstraints = detectFluxShadows(
        flux.raster,
        flux.width,
        flux.height,
        flux.meta,
        input.solarPolygons,
        allConstraints.filter((c) => c.source !== "shadow")
      );
      allConstraints.push(...fluxConstraints);
      notes.push(
        `Flux analysis: ${fluxConstraints.length} shadow zone(s) detected`
      );
      log.info(`Flux: ${fluxConstraints.length} shadow zones detected`);
    } catch (err) {
      log.warn(
        "Flux analysis failed (skipping):",
        err instanceof Error ? err.message : err
      );
      notes.push("Flux analysis: skipped (data unavailable)");
    }
  } else {
    notes.push("Flux analysis: skipped (no annualFlux URL)");
  }

  // Step 6: Classify remaining unlabeled DSM/flux obstacles with Gemini
  const unlabeledCount = allConstraints.filter(
    (c) => c.source === "dsm" || c.source === "flux"
  ).length;
  if (input.rgbUrl && unlabeledCount > 0 && dsm) {
    try {
      log.info(`Step 6: Classifying ${unlabeledCount} DSM/flux obstacles with Gemini...`);
      allConstraints = await classifyWithGemini(
        input.rgbUrl,
        apiKey,
        allConstraints,
        dsm.meta,
        dsm.width,
        dsm.height
      );
      notes.push("Classification: Gemini Vision applied to DSM/flux obstacles");
    } catch (err) {
      log.warn(
        "Gemini classification failed:",
        err instanceof Error ? err.message : err
      );
      notes.push("Classification: fallback to generic labels");
    }
  }

  log.info(
    `Detection complete: ${allConstraints.length} total constraints (${visionConstraints.length} vision, ${dsmConstraints.length} DSM, ${shadowConstraints.length} shadow)`
  );

  return {
    constraints: allConstraints,
    analysisNotes: notes.join(". "),
  };
}
