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
  source: "dsm" | "flux";
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
  // GeoTIFF convention: geo = tiePoint_geo + (pixel - tiePoint_pixel) * scale
  // Note: Y scale is negative (north-up raster)
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
  // Compute bounding box to limit scanline range
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
          // 8-connectivity neighbors
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

  // Find lowest-leftmost point
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

  // Sort by polar angle
  const sorted = points.slice(1).sort((a, b) => {
    const cross =
      (a[0] - pivot[0]) * (b[1] - pivot[1]) -
      (b[0] - pivot[0]) * (a[1] - pivot[1]);
    if (cross !== 0) return -cross; // counterclockwise
    // Collinear: closer first
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
  apiKey: string
): Promise<{
  raster: Float32Array | Float64Array | Uint8Array | Uint16Array | Int16Array;
  width: number;
  height: number;
  meta: TiePointScale;
}> {
  const urlWithKey = url.includes("key=") ? url : `${url}&key=${apiKey}`;
  const response = await fetch(urlWithKey);
  if (!response.ok) {
    throw new Error(`Failed to fetch GeoTIFF: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const raster = rasters[0] as Float32Array;
  const width = image.getWidth();
  const height = image.getHeight();

  const fileDirectory = image.fileDirectory as any;
  const tiePoint = fileDirectory.ModelTiepoint || [0, 0, 0, 0, 0, 0];
  const scale = fileDirectory.ModelPixelScale || [1, 1, 1];

  return {
    raster: raster as Float32Array,
    width,
    height,
    meta: { tiePoint: Array.from(tiePoint), scale: Array.from(scale) },
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
  minAreaSqM: number = 2
): DetectedConstraint[] {
  const constraints: DetectedConstraint[] = [];
  const pixelAreaSqM = meta.scale[0] * meta.scale[1] * (111320 * 111320); // approximate m²/pixel
  // More accurate: scale is in degrees, convert to meters at the location latitude
  const latCenter = meta.tiePoint[4] - (height / 2) * meta.scale[1];
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((latCenter * Math.PI) / 180);
  const pixelWidthM = meta.scale[0] * metersPerDegLng;
  const pixelHeightM = meta.scale[1] * metersPerDegLat;
  const pixelArea = pixelWidthM * pixelHeightM;

  for (const polygon of solarPolygons) {
    // Convert polygon coordinates [lng, lat] to pixel coordinates
    const polygonPixels: [number, number][] = polygon.coordinates.map(
      ([lng, lat]) => latLngToPixel(lat, lng, meta)
    );

    // Create mask of pixels inside this polygon
    const mask = createPolygonMask(polygonPixels, width, height);

    // Collect elevation values inside the polygon
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

    if (elevations.length < 10) continue; // Too few pixels to analyze

    const roofMedian = median(elevations);
    // Threshold: pixels more than 0.5m above median are obstacle candidates
    const threshold = roofMedian + 0.5;

    // Create obstacle bitmask
    const obstacleMask = new Uint8Array(width * height);
    for (const idx of maskedIndices) {
      if (raster[idx] > threshold) {
        obstacleMask[idx] = 1;
      }
    }

    // Find connected components
    const components = connectedComponents(obstacleMask, width, height);

    for (const component of components) {
      const areaSqM = component.length * pixelArea;
      if (areaSqM < minAreaSqM) continue; // Filter noise

      // Convert pixel indices to [px, py] coordinates
      const pixelPoints: [number, number][] = component.map((idx) => {
        const x = idx % width;
        const y = (idx - x) / width;
        return [x, y] as [number, number];
      });

      // Compute convex hull
      let hull = convexHull(pixelPoints);
      // Simplify to max ~8 vertices
      if (hull.length > 8) {
        hull = simplifyPolygon(hull, 1.5);
        if (hull.length < 3) hull = convexHull(pixelPoints);
      }

      // Convert hull back to [lng, lat]
      const geoCoords: [number, number][] = hull.map(([px, py]) =>
        pixelToLatLng(px, py, meta)
      );

      constraints.push({
        coordinates: geoCoords,
        areaSqM: Math.round(areaSqM * 10) / 10,
        label: `Obstacle — ${Math.round(areaSqM)} m²`,
        source: "dsm",
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

    // Collect flux values inside polygon
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

      // Check overlap with DSM constraints — skip if centroid is inside any DSM constraint
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

  try {
    // Fetch RGB image as base64
    const urlWithKey = rgbUrl.includes("key=")
      ? rgbUrl
      : `${rgbUrl}&key=${apiKey}`;
    const response = await fetch(urlWithKey);
    if (!response.ok) {
      log.warn("Could not fetch RGB image for classification, using generic labels");
      return constraints;
    }
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // Build obstacle centroids in pixel coordinates for the prompt
    const obstacleDescriptions = constraints.map((c, i) => {
      const centroidLng =
        c.coordinates.reduce((s, p) => s + p[0], 0) / c.coordinates.length;
      const centroidLat =
        c.coordinates.reduce((s, p) => s + p[1], 0) / c.coordinates.length;
      const [px, py] = latLngToPixel(centroidLat, centroidLng, meta);
      // Clamp to image bounds
      const clampedX = Math.max(0, Math.min(imageWidth - 1, px));
      const clampedY = Math.max(0, Math.min(imageHeight - 1, py));
      return `Obstacle ${i + 1}: pixel position (${clampedX}, ${clampedY}), area ${c.areaSqM} m², source: ${c.source}`;
    });

    const prompt = `This is a satellite view of a commercial/industrial rooftop. I detected ${constraints.length} obstacles on this roof.
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

    // Map classifications back to constraints
    return constraints.map((c, i) => {
      const classification = classifications.find((cl) => cl.id === i + 1);
      if (classification) {
        const label = `${classification.label_fr} — ${c.areaSqM} m²`;
        return { ...c, label };
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

  // Step 1: Parse DSM GeoTIFF and detect obstacles
  log.info("Parsing DSM GeoTIFF...");
  const dsm = await fetchAndParseGeoTIFF(input.dsmUrl, apiKey);
  log.info(
    `DSM loaded: ${dsm.width}×${dsm.height} pixels, scale: ${dsm.meta.scale[0].toFixed(8)}°×${dsm.meta.scale[1].toFixed(8)}°`
  );

  const dsmConstraints = detectDSMObstacles(
    dsm.raster,
    dsm.width,
    dsm.height,
    dsm.meta,
    input.solarPolygons
  );
  allConstraints.push(...dsmConstraints);
  notes.push(
    `DSM analysis: ${dsmConstraints.length} obstacle(s) detected above roof level`
  );
  log.info(`DSM: ${dsmConstraints.length} obstacles detected`);

  // Step 2: Parse annualFlux GeoTIFF and detect shadows
  if (input.annualFluxUrl) {
    try {
      log.info("Parsing annualFlux GeoTIFF...");
      const flux = await fetchAndParseGeoTIFF(input.annualFluxUrl, apiKey);
      const fluxConstraints = detectFluxShadows(
        flux.raster,
        flux.width,
        flux.height,
        flux.meta,
        input.solarPolygons,
        dsmConstraints
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

  // Step 3: Classify with Gemini Vision
  if (input.rgbUrl && allConstraints.length > 0) {
    try {
      log.info("Classifying obstacles with Gemini Vision...");
      allConstraints = await classifyWithGemini(
        input.rgbUrl,
        apiKey,
        allConstraints,
        dsm.meta,
        dsm.width,
        dsm.height
      );
      notes.push("Classification: Gemini Vision applied");
    } catch (err) {
      log.warn(
        "Gemini classification failed:",
        err instanceof Error ? err.message : err
      );
      notes.push("Classification: fallback to generic labels");
    }
  }

  log.info(
    `Detection complete: ${allConstraints.length} total constraints`
  );

  return {
    constraints: allConstraints,
    analysisNotes: notes.join(". "),
  };
}
