/**
 * SLD (Single Line Diagram) — Schéma unifilaire interactif
 *
 * Génère automatiquement un SLD basé sur les arrays modulaires du système PV.
 * Supporte string inverters et micro-inverters.
 *
 * Conventions:
 * - Jinko 660W panels, Voc = 49.85V, Isc = 17.28A
 * - String inverters: max 1000V DC (CSA), ~13 panels/string max
 * - Micro-inverters: 1 per panel, AC bus daisy-chain
 * - IFC/CSA compliant labeling
 */

import React, { useMemo, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SLDArrayInfo {
  id: number;
  panelCount: number;
  rows: number;
  columns: number;
  capacityKW: number;
  polygonId: string;
}

export interface SLDElectricalConfig {
  inverterType: "string" | "micro";
  // String inverter config
  stringInverterModelName?: string;
  stringInverterPowerKW?: number;
  // Micro inverter config
  microInverterModelName?: string;
  microInverterPowerW?: number;
  // Electrical service
  serviceVoltage?: number; // 120/240, 347/600, etc.
  serviceAmperage?: number;
  mainBreakerA?: number;
  // Site info
  siteName?: string;
  siteAddress?: string;
  systemCapacityKW?: number;
  totalPanels?: number;
}

interface SLDInverterAssignment {
  inverterId: number;
  inverterLabel: string;
  powerKW: number;
  strings: {
    stringId: number;
    panelsInString: number;
    vocString: number; // Voc × panels
    iscString: number;
    arrayId: number;
  }[];
  totalPanels: number;
  totalCapacityKW: number;
}

interface SLDMicroInverterGroup {
  arrayId: number;
  panelCount: number;
  capacityKW: number;
  acBranchCircuitA: number;
}

export interface SLDDiagramProps {
  arrays: SLDArrayInfo[];
  config: SLDElectricalConfig;
  language?: "fr" | "en";
  width?: number;
  height?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS — Jinko 660W JKM660N-78HL4-BDV
// ═══════════════════════════════════════════════════════════════════════════════

const PANEL_WATT = 660;
const PANEL_VOC = 49.85; // V — Open circuit voltage at STC
const PANEL_ISC = 17.28; // A — Short circuit current at STC
const PANEL_VMP = 41.69; // V — Max power voltage
const PANEL_IMP = 15.84; // A — Max power current

// String sizing — CSA/NEC: max system voltage 1000V DC
const MAX_SYSTEM_VOLTAGE_DC = 1000;
// Temperature correction factor for cold climate (Quebec, -30°C)
// Voc increases ~0.3%/°C below 25°C → factor ≈ 1.165 for -30°C
const TEMP_CORRECTION_VOC = 1.165;
const MAX_PANELS_PER_STRING = Math.floor(MAX_SYSTEM_VOLTAGE_DC / (PANEL_VOC * TEMP_CORRECTION_VOC)); // ~17

// Default string inverter specs (generic 50kW commercial)
const DEFAULT_STRING_INV_KW = 50;
const DEFAULT_STRING_INV_NAME = "Onduleur string 50 kW";
const DEFAULT_STRING_INV_MAX_STRINGS = 10;
const DEFAULT_STRING_INV_MPPT = 4;

// Default micro inverter specs
const DEFAULT_MICRO_INV_W = 800;
const DEFAULT_MICRO_INV_NAME = "Micro-onduleur 800W";
const DEFAULT_MICRO_INV_MAX_PER_BRANCH = 16; // Max micros per AC branch circuit

// SVG layout constants
const SVG_MARGIN = 30;
const ELEMENT_H = 40;
const ELEMENT_W = 120;
const STRING_BOX_W = 90;
const STRING_BOX_H = 32;
const ARRAY_BOX_W = 100;
const ARRAY_BOX_H = 36;
const INV_BOX_W = 110;
const INV_BOX_H = 44;
const COMBINER_W = 80;
const COMBINER_H = 36;
const METER_R = 22;
const PANEL_BOX_W = 70;
const PANEL_BOX_H = 50;
const ROW_GAP = 60;
const COL_GAP = 40;

// ═══════════════════════════════════════════════════════════════════════════════
// ELECTRICAL CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateStringInverterLayout(
  arrays: SLDArrayInfo[],
  invPowerKW: number = DEFAULT_STRING_INV_KW,
  invName: string = DEFAULT_STRING_INV_NAME
): SLDInverterAssignment[] {
  const totalPanels = arrays.reduce((sum, a) => sum + a.panelCount, 0);
  const totalCapacityKW = totalPanels * PANEL_WATT / 1000;

  // Optimal panels per string: maximize without exceeding voltage
  const panelsPerString = Math.min(MAX_PANELS_PER_STRING, 13); // Conservative: 13 panels × 49.85V × 1.165 = 755V

  // Build all strings from all arrays
  const allStrings: { panelsInString: number; arrayId: number }[] = [];

  for (const arr of arrays) {
    let remaining = arr.panelCount;
    while (remaining > 0) {
      const n = Math.min(remaining, panelsPerString);
      if (n >= Math.ceil(panelsPerString * 0.6)) { // Min 60% of target string length
        allStrings.push({ panelsInString: n, arrayId: arr.id });
      } else if (allStrings.length > 0 && allStrings[allStrings.length - 1].arrayId === arr.id) {
        // Add remainder to last string of same array if possible
        allStrings[allStrings.length - 1].panelsInString += n;
      } else {
        allStrings.push({ panelsInString: n, arrayId: arr.id });
      }
      remaining -= n;
    }
  }

  // Assign strings to inverters
  const maxStringsPerInv = DEFAULT_STRING_INV_MAX_STRINGS;
  const inverters: SLDInverterAssignment[] = [];
  let strIdx = 0;
  let invId = 1;

  while (strIdx < allStrings.length) {
    const invStrings: SLDInverterAssignment["strings"] = [];
    let invPanels = 0;
    let stringInInv = 0;

    while (strIdx < allStrings.length && stringInInv < maxStringsPerInv) {
      const s = allStrings[strIdx];
      // Check if adding this string exceeds inverter DC capacity (typically 1.3× AC rating)
      const newCapKW = (invPanels + s.panelsInString) * PANEL_WATT / 1000;
      if (invStrings.length > 0 && newCapKW > invPowerKW * 1.3) break;

      invStrings.push({
        stringId: stringInInv + 1,
        panelsInString: s.panelsInString,
        vocString: Math.round(s.panelsInString * PANEL_VOC * 10) / 10,
        iscString: PANEL_ISC,
        arrayId: s.arrayId,
      });
      invPanels += s.panelsInString;
      stringInInv++;
      strIdx++;
    }

    if (invStrings.length > 0) {
      inverters.push({
        inverterId: invId++,
        inverterLabel: `${invName} #${invId - 1}`,
        powerKW: invPowerKW,
        strings: invStrings,
        totalPanels: invPanels,
        totalCapacityKW: Math.round(invPanels * PANEL_WATT / 10) / 100,
      });
    }
  }

  return inverters;
}

function calculateMicroInverterLayout(
  arrays: SLDArrayInfo[],
  microPowerW: number = DEFAULT_MICRO_INV_W
): SLDMicroInverterGroup[] {
  return arrays.map((arr) => ({
    arrayId: arr.id,
    panelCount: arr.panelCount,
    capacityKW: Math.round(arr.panelCount * Math.min(PANEL_WATT, microPowerW) / 10) / 100,
    acBranchCircuitA: Math.round(
      Math.ceil(arr.panelCount / DEFAULT_MICRO_INV_MAX_PER_BRANCH) *
      (microPowerW / 240) * 1.25 * 10
    ) / 10, // 125% continuous load factor
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG DRAWING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function SLDBox({ x, y, w, h, label, sublabel, fill = "#f8fafc", stroke = "#334155", fontSize = 10, bold = false }: {
  x: number; y: number; w: number; h: number; label: string; sublabel?: string;
  fill?: string; stroke?: string; fontSize?: number; bold?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + (sublabel ? h / 2 - 5 : h / 2 + 1)} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fontWeight={bold ? 700 : 500} fill="#1e293b" fontFamily="Inter, system-ui, sans-serif">
        {label}
      </text>
      {sublabel && (
        <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" dominantBaseline="middle"
          fontSize={8} fill="#64748b" fontFamily="Inter, system-ui, sans-serif">
          {sublabel}
        </text>
      )}
    </g>
  );
}

function SLDCircle({ cx, cy, r, label, sublabel, fill = "#f8fafc", stroke = "#334155" }: {
  cx: number; cy: number; r: number; label: string; sublabel?: string;
  fill?: string; stroke?: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text x={cx} y={cy - (sublabel ? 4 : 0)} textAnchor="middle" dominantBaseline="middle"
        fontSize={10} fontWeight={600} fill="#1e293b" fontFamily="Inter, system-ui, sans-serif">
        {label}
      </text>
      {sublabel && (
        <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle"
          fontSize={7} fill="#64748b" fontFamily="Inter, system-ui, sans-serif">
          {sublabel}
        </text>
      )}
    </g>
  );
}

function SLDLine({ x1, y1, x2, y2, dashed = false, color = "#475569" }: {
  x1: number; y1: number; x2: number; y2: number; dashed?: boolean; color?: string;
}) {
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5}
      strokeDasharray={dashed ? "4 3" : undefined} />
  );
}

function SLDLabel({ x, y, text, fontSize = 8, color = "#64748b", anchor = "middle" as const }: {
  x: number; y: number; text: string; fontSize?: number; color?: string; anchor?: "start" | "middle" | "end";
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
      fontSize={fontSize} fill={color} fontFamily="Inter, system-ui, sans-serif">
      {text}
    </text>
  );
}

// Wire label annotation
function WireLabel({ x1, y1, x2, y2, label }: {
  x1: number; y1: number; x2: number; y2: number; label: string;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <text x={mx} y={my - 6} textAnchor="middle" dominantBaseline="middle"
      fontSize={7} fill="#94a3b8" fontFamily="Inter, system-ui, sans-serif" fontStyle="italic">
      {label}
    </text>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRING INVERTER SLD RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

function StringInverterSLD({
  inverters,
  config,
  language = "fr"
}: {
  inverters: SLDInverterAssignment[];
  config: SLDElectricalConfig;
  language: "fr" | "en";
}) {
  const fr = language === "fr";

  // Layout: LEFT → RIGHT flow
  // [PV Arrays] → [Combiner Boxes] → [Inverters] → [AC Disconnect] → [Meter] → [Main Panel] → [Grid]

  // Calculate vertical space needed
  const maxStringsPerInv = Math.max(...inverters.map(inv => inv.strings.length), 1);
  const totalInverters = inverters.length;
  const invBlockH = Math.max(INV_BOX_H + 10, maxStringsPerInv * (STRING_BOX_H + 8) + 20);
  const totalH = totalInverters * invBlockH + SVG_MARGIN * 2 + 80; // +80 for title/legend

  // Column positions (X)
  const colPV = SVG_MARGIN;
  const colCombiner = colPV + STRING_BOX_W + COL_GAP + 20;
  const colInverter = colCombiner + COMBINER_W + COL_GAP;
  const colACDisconnect = colInverter + INV_BOX_W + COL_GAP;
  const colMeter = colACDisconnect + ELEMENT_W + COL_GAP;
  const colMainPanel = colMeter + METER_R * 2 + COL_GAP + 20;
  const colGrid = colMainPanel + ELEMENT_W + COL_GAP;
  const totalW = colGrid + ELEMENT_W + SVG_MARGIN;

  const titleY = 20;
  const startY = titleY + 50;

  // Service info
  const serviceV = config.serviceVoltage || 600;
  const serviceA = config.serviceAmperage || 400;
  const mainBreakerA = config.mainBreakerA || 200;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ maxWidth: totalW, background: "white" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Title block */}
      <text x={totalW / 2} y={titleY} textAnchor="middle" fontSize={14} fontWeight={700}
        fill="#0f172a" fontFamily="Inter, system-ui, sans-serif">
        {fr ? "SCHÉMA UNIFILAIRE — SYSTÈME PHOTOVOLTAÏQUE" : "SINGLE LINE DIAGRAM — PHOTOVOLTAIC SYSTEM"}
      </text>
      <text x={totalW / 2} y={titleY + 16} textAnchor="middle" fontSize={9} fill="#64748b"
        fontFamily="Inter, system-ui, sans-serif">
        {config.siteName || ""} — {config.systemCapacityKW ? `${config.systemCapacityKW} kWc` : ""} — {config.totalPanels || 0} {fr ? "panneaux" : "panels"} Jinko 660W
      </text>

      {/* Column headers */}
      <SLDLabel x={colPV + STRING_BOX_W / 2} y={startY - 12} text={fr ? "STRINGS PV" : "PV STRINGS"} fontSize={8} color="#475569" />
      <SLDLabel x={colCombiner + COMBINER_W / 2} y={startY - 12} text={fr ? "BOÎTE COMB." : "COMBINER"} fontSize={8} color="#475569" />
      <SLDLabel x={colInverter + INV_BOX_W / 2} y={startY - 12} text={fr ? "ONDULEUR" : "INVERTER"} fontSize={8} color="#475569" />
      <SLDLabel x={colACDisconnect + ELEMENT_W / 2} y={startY - 12} text={fr ? "SECTIONNEUR AC" : "AC DISCONNECT"} fontSize={8} color="#475569" />

      {/* For each inverter, draw its block */}
      {inverters.map((inv, invIdx) => {
        const blockY = startY + invIdx * invBlockH;
        const invCenterY = blockY + invBlockH / 2;

        return (
          <g key={inv.inverterId}>
            {/* Strings */}
            {inv.strings.map((str, sIdx) => {
              const strY = blockY + 10 + sIdx * (STRING_BOX_H + 8);
              const strCenterY = strY + STRING_BOX_H / 2;

              return (
                <g key={str.stringId}>
                  <SLDBox
                    x={colPV} y={strY} w={STRING_BOX_W} h={STRING_BOX_H}
                    label={`${str.panelsInString}× PV`}
                    sublabel={`${str.vocString}V / ${str.iscString}A`}
                    fill="#fef3c7" stroke="#d97706"
                  />
                  {/* Wire from string to combiner */}
                  <SLDLine
                    x1={colPV + STRING_BOX_W} y1={strCenterY}
                    x2={colCombiner} y2={strCenterY}
                    color="#dc2626"
                  />
                  {/* DC label on first string wire */}
                  {sIdx === 0 && (
                    <WireLabel
                      x1={colPV + STRING_BOX_W} y1={strCenterY}
                      x2={colCombiner} y2={strCenterY}
                      label="DC"
                    />
                  )}
                </g>
              );
            })}

            {/* Combiner box */}
            <SLDBox
              x={colCombiner} y={invCenterY - COMBINER_H / 2} w={COMBINER_W} h={COMBINER_H}
              label={fr ? `Comb. #${inv.inverterId}` : `Comb. #${inv.inverterId}`}
              sublabel={`${inv.strings.length} str.`}
              fill="#e0f2fe" stroke="#0284c7"
            />

            {/* Wire combiner → inverter */}
            <SLDLine
              x1={colCombiner + COMBINER_W} y1={invCenterY}
              x2={colInverter} y2={invCenterY}
              color="#dc2626"
            />
            <WireLabel
              x1={colCombiner + COMBINER_W} y1={invCenterY}
              x2={colInverter} y2={invCenterY}
              label={`DC ${Math.round(inv.totalCapacityKW * 1000 / (serviceV || 600))}A`}
            />

            {/* Inverter */}
            <SLDBox
              x={colInverter} y={invCenterY - INV_BOX_H / 2} w={INV_BOX_W} h={INV_BOX_H}
              label={`INV-${inv.inverterId}`}
              sublabel={`${inv.powerKW} kW | ${inv.totalPanels} pan.`}
              fill="#dcfce7" stroke="#16a34a"
              bold
            />

            {/* Wire inverter → AC disconnect */}
            <SLDLine
              x1={colInverter + INV_BOX_W} y1={invCenterY}
              x2={colACDisconnect} y2={invCenterY}
              color="#2563eb"
            />
            <WireLabel
              x1={colInverter + INV_BOX_W} y1={invCenterY}
              x2={colACDisconnect} y2={invCenterY}
              label="AC"
            />

            {/* AC Disconnect */}
            <SLDBox
              x={colACDisconnect} y={invCenterY - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? `Sectionneur #${inv.inverterId}` : `Disconnect #${inv.inverterId}`}
              sublabel={`${Math.round(inv.powerKW * 1000 / (serviceV || 600) * 1.25)}A`}
              fill="#fef9c3" stroke="#ca8a04"
            />

            {/* Connect combiner to all strings vertically */}
            {inv.strings.length > 1 && (
              <>
                <SLDLine
                  x1={colCombiner} y1={blockY + 10 + STRING_BOX_H / 2}
                  x2={colCombiner} y2={blockY + 10 + (inv.strings.length - 1) * (STRING_BOX_H + 8) + STRING_BOX_H / 2}
                  color="#0284c7"
                />
              </>
            )}
          </g>
        );
      })}

      {/* Common AC bus section (right side) */}
      {(() => {
        const busX = colACDisconnect + ELEMENT_W + 20;
        const busTopY = startY + invBlockH / 2;
        const busBottomY = startY + (totalInverters - 1) * invBlockH + invBlockH / 2;
        const busMidY = (busTopY + busBottomY) / 2;

        return (
          <g>
            {/* Vertical AC bus */}
            {totalInverters > 1 && (
              <SLDLine x1={busX} y1={busTopY} x2={busX} y2={busBottomY} color="#2563eb" />
            )}

            {/* Connect each disconnect to bus */}
            {inverters.map((inv, invIdx) => {
              const cy = startY + invIdx * invBlockH + invBlockH / 2;
              return (
                <SLDLine key={inv.inverterId}
                  x1={colACDisconnect + ELEMENT_W} y1={cy}
                  x2={busX} y2={cy}
                  color="#2563eb"
                />
              );
            })}

            {/* Bus → Meter */}
            <SLDLine x1={busX} y1={busMidY} x2={colMeter} y2={busMidY} color="#2563eb" />
            <WireLabel x1={busX} y1={busMidY} x2={colMeter} y2={busMidY}
              label={`${serviceV}V`} />

            {/* Production Meter */}
            <SLDCircle
              cx={colMeter + METER_R} cy={busMidY} r={METER_R}
              label="kWh" sublabel={fr ? "Prod." : "Prod."}
              fill="#f0fdf4" stroke="#16a34a"
            />

            {/* Meter → Main Panel */}
            <SLDLine
              x1={colMeter + METER_R * 2} y1={busMidY}
              x2={colMainPanel} y2={busMidY}
              color="#2563eb"
            />

            {/* Main Electrical Panel */}
            <SLDBox
              x={colMainPanel} y={busMidY - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? "Panneau principal" : "Main Panel"}
              sublabel={`${mainBreakerA}A / ${serviceV}V`}
              fill="#f1f5f9" stroke="#334155"
              bold
            />

            {/* Main Panel → Grid */}
            <SLDLine
              x1={colMainPanel + ELEMENT_W} y1={busMidY}
              x2={colGrid} y2={busMidY}
              color="#475569"
            />
            <WireLabel
              x1={colMainPanel + ELEMENT_W} y1={busMidY}
              x2={colGrid} y2={busMidY}
              label={fr ? "Réseau HQ" : "Grid"}
            />

            {/* Grid symbol */}
            <SLDBox
              x={colGrid} y={busMidY - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? "RÉSEAU" : "GRID"}
              sublabel={`${serviceV}V / ${serviceA}A`}
              fill="#e2e8f0" stroke="#1e293b"
              bold
            />

            {/* Ground symbol at main panel */}
            <SLDLine x1={colMainPanel + ELEMENT_W / 2} y1={busMidY + ELEMENT_H / 2}
              x2={colMainPanel + ELEMENT_W / 2} y2={busMidY + ELEMENT_H / 2 + 15} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 10} y1={busMidY + ELEMENT_H / 2 + 15}
              x2={colMainPanel + ELEMENT_W / 2 + 10} y2={busMidY + ELEMENT_H / 2 + 15} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 6} y1={busMidY + ELEMENT_H / 2 + 19}
              x2={colMainPanel + ELEMENT_W / 2 + 6} y2={busMidY + ELEMENT_H / 2 + 19} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 2} y1={busMidY + ELEMENT_H / 2 + 23}
              x2={colMainPanel + ELEMENT_W / 2 + 2} y2={busMidY + ELEMENT_H / 2 + 23} color="#475569" />
            <SLDLabel x={colMainPanel + ELEMENT_W / 2 + 15} y={busMidY + ELEMENT_H / 2 + 19}
              text="GND" fontSize={7} color="#475569" anchor="start" />
          </g>
        );
      })()}

      {/* Legend */}
      <g transform={`translate(${SVG_MARGIN}, ${totalH - 30})`}>
        <SLDLine x1={0} y1={0} x2={20} y2={0} color="#dc2626" />
        <SLDLabel x={25} y={0} text="DC" fontSize={7} color="#dc2626" anchor="start" />
        <SLDLine x1={60} y1={0} x2={80} y2={0} color="#2563eb" />
        <SLDLabel x={85} y={0} text="AC" fontSize={7} color="#2563eb" anchor="start" />
        <SLDLabel x={130} y={0} text={`Jinko JKM660N — Voc=${PANEL_VOC}V — Isc=${PANEL_ISC}A — Vmp=${PANEL_VMP}V`}
          fontSize={7} color="#94a3b8" anchor="start" />
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MICRO INVERTER SLD RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

function MicroInverterSLD({
  groups,
  config,
  language = "fr"
}: {
  groups: SLDMicroInverterGroup[];
  config: SLDElectricalConfig;
  language: "fr" | "en";
}) {
  const fr = language === "fr";

  const blockH = 70;
  const totalGroups = groups.length;
  const startY = 60;
  const totalH = startY + totalGroups * blockH + 80;

  const colPV = SVG_MARGIN;
  const colMicro = colPV + ARRAY_BOX_W + COL_GAP;
  const colBranch = colMicro + INV_BOX_W + COL_GAP;
  const colMeter = colBranch + ELEMENT_W + COL_GAP;
  const colMainPanel = colMeter + METER_R * 2 + COL_GAP + 20;
  const colGrid = colMainPanel + ELEMENT_W + COL_GAP;
  const totalW = colGrid + ELEMENT_W + SVG_MARGIN;

  const microName = config.microInverterModelName || DEFAULT_MICRO_INV_NAME;
  const microW = config.microInverterPowerW || DEFAULT_MICRO_INV_W;
  const serviceV = config.serviceVoltage || 240;
  const serviceA = config.serviceAmperage || 200;
  const mainBreakerA = config.mainBreakerA || 200;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ maxWidth: totalW, background: "white" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Title */}
      <text x={totalW / 2} y={20} textAnchor="middle" fontSize={14} fontWeight={700}
        fill="#0f172a" fontFamily="Inter, system-ui, sans-serif">
        {fr ? "SCHÉMA UNIFILAIRE — MICRO-ONDULEURS" : "SINGLE LINE DIAGRAM — MICROINVERTERS"}
      </text>
      <text x={totalW / 2} y={36} textAnchor="middle" fontSize={9} fill="#64748b"
        fontFamily="Inter, system-ui, sans-serif">
        {config.siteName || ""} — {config.systemCapacityKW ? `${config.systemCapacityKW} kWc` : ""} — {microName} ({microW}W)
      </text>

      {/* Column headers */}
      <SLDLabel x={colPV + ARRAY_BOX_W / 2} y={startY - 12} text={fr ? "ARRAY PV" : "PV ARRAY"} fontSize={8} color="#475569" />
      <SLDLabel x={colMicro + INV_BOX_W / 2} y={startY - 12} text={fr ? "MICRO-ONDULEURS" : "MICROINVERTERS"} fontSize={8} color="#475569" />
      <SLDLabel x={colBranch + ELEMENT_W / 2} y={startY - 12} text={fr ? "CIRCUIT BRANCHE" : "BRANCH CIRCUIT"} fontSize={8} color="#475569" />

      {groups.map((grp, gIdx) => {
        const cy = startY + gIdx * blockH + blockH / 2;

        return (
          <g key={grp.arrayId}>
            {/* PV Array */}
            <SLDBox
              x={colPV} y={cy - ARRAY_BOX_H / 2} w={ARRAY_BOX_W} h={ARRAY_BOX_H}
              label={`Array #${grp.arrayId}`}
              sublabel={`${grp.panelCount} pan. / ${grp.capacityKW} kW`}
              fill="#fef3c7" stroke="#d97706"
            />

            {/* DC wire */}
            <SLDLine x1={colPV + ARRAY_BOX_W} y1={cy} x2={colMicro} y2={cy} color="#dc2626" />
            <WireLabel x1={colPV + ARRAY_BOX_W} y1={cy} x2={colMicro} y2={cy} label="DC 1:1" />

            {/* Micro-inverter block */}
            <SLDBox
              x={colMicro} y={cy - INV_BOX_H / 2} w={INV_BOX_W} h={INV_BOX_H}
              label={`${grp.panelCount}× μINV`}
              sublabel={`${microW}W ${fr ? "chaque" : "each"}`}
              fill="#dcfce7" stroke="#16a34a"
              bold
            />

            {/* AC wire */}
            <SLDLine x1={colMicro + INV_BOX_W} y1={cy} x2={colBranch} y2={cy} color="#2563eb" />
            <WireLabel x1={colMicro + INV_BOX_W} y1={cy} x2={colBranch} y2={cy} label="AC Bus" />

            {/* Branch circuit breaker */}
            <SLDBox
              x={colBranch} y={cy - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? `Disj. #${grp.arrayId}` : `Brkr #${grp.arrayId}`}
              sublabel={`${Math.ceil(grp.acBranchCircuitA)}A`}
              fill="#fef9c3" stroke="#ca8a04"
            />
          </g>
        );
      })}

      {/* Common section */}
      {(() => {
        const busX = colBranch + ELEMENT_W + 20;
        const busTopY = startY + blockH / 2;
        const busBottomY = startY + (totalGroups - 1) * blockH + blockH / 2;
        const busMidY = (busTopY + busBottomY) / 2;

        return (
          <g>
            {totalGroups > 1 && (
              <SLDLine x1={busX} y1={busTopY} x2={busX} y2={busBottomY} color="#2563eb" />
            )}

            {groups.map((grp, gIdx) => {
              const cy = startY + gIdx * blockH + blockH / 2;
              return (
                <SLDLine key={grp.arrayId}
                  x1={colBranch + ELEMENT_W} y1={cy} x2={busX} y2={cy} color="#2563eb"
                />
              );
            })}

            <SLDLine x1={busX} y1={busMidY} x2={colMeter} y2={busMidY} color="#2563eb" />

            <SLDCircle
              cx={colMeter + METER_R} cy={busMidY} r={METER_R}
              label="kWh" sublabel={fr ? "Prod." : "Prod."}
              fill="#f0fdf4" stroke="#16a34a"
            />

            <SLDLine x1={colMeter + METER_R * 2} y1={busMidY} x2={colMainPanel} y2={busMidY} color="#2563eb" />

            <SLDBox
              x={colMainPanel} y={busMidY - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? "Panneau principal" : "Main Panel"}
              sublabel={`${mainBreakerA}A / ${serviceV}V`}
              fill="#f1f5f9" stroke="#334155"
              bold
            />

            <SLDLine x1={colMainPanel + ELEMENT_W} y1={busMidY} x2={colGrid} y2={busMidY} color="#475569" />

            <SLDBox
              x={colGrid} y={busMidY - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? "RÉSEAU" : "GRID"}
              sublabel={`${serviceV}V / ${serviceA}A`}
              fill="#e2e8f0" stroke="#1e293b"
              bold
            />

            {/* Ground */}
            <SLDLine x1={colMainPanel + ELEMENT_W / 2} y1={busMidY + ELEMENT_H / 2}
              x2={colMainPanel + ELEMENT_W / 2} y2={busMidY + ELEMENT_H / 2 + 15} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 10} y1={busMidY + ELEMENT_H / 2 + 15}
              x2={colMainPanel + ELEMENT_W / 2 + 10} y2={busMidY + ELEMENT_H / 2 + 15} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 6} y1={busMidY + ELEMENT_H / 2 + 19}
              x2={colMainPanel + ELEMENT_W / 2 + 6} y2={busMidY + ELEMENT_H / 2 + 19} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 2} y1={busMidY + ELEMENT_H / 2 + 23}
              x2={colMainPanel + ELEMENT_W / 2 + 2} y2={busMidY + ELEMENT_H / 2 + 23} color="#475569" />
            <SLDLabel x={colMainPanel + ELEMENT_W / 2 + 15} y={busMidY + ELEMENT_H / 2 + 19}
              text="GND" fontSize={7} color="#475569" anchor="start" />
          </g>
        );
      })()}

      {/* Legend */}
      <g transform={`translate(${SVG_MARGIN}, ${totalH - 30})`}>
        <SLDLine x1={0} y1={0} x2={20} y2={0} color="#dc2626" />
        <SLDLabel x={25} y={0} text="DC" fontSize={7} color="#dc2626" anchor="start" />
        <SLDLine x1={60} y1={0} x2={80} y2={0} color="#2563eb" />
        <SLDLabel x={85} y={0} text="AC" fontSize={7} color="#2563eb" anchor="start" />
        <SLDLabel x={130} y={0} text={`Jinko JKM660N — ${DEFAULT_MICRO_INV_NAME} (${DEFAULT_MICRO_INV_W}W)`}
          fontSize={7} color="#94a3b8" anchor="start" />
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SLDDiagram({ arrays, config, language = "fr", width, height }: SLDDiagramProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fr = language === "fr";

  // Compute electrical layout
  const inverterLayout = useMemo(() => {
    if (config.inverterType === "string") {
      return calculateStringInverterLayout(
        arrays,
        config.stringInverterPowerKW || DEFAULT_STRING_INV_KW,
        config.stringInverterModelName || DEFAULT_STRING_INV_NAME
      );
    }
    return null;
  }, [arrays, config]);

  const microLayout = useMemo(() => {
    if (config.inverterType === "micro") {
      return calculateMicroInverterLayout(
        arrays,
        config.microInverterPowerW || DEFAULT_MICRO_INV_W
      );
    }
    return null;
  }, [arrays, config]);

  // Export SVG as string (for PDF generation)
  const getSVGString = useCallback((): string | null => {
    // Find the actual SVG element inside the wrapper
    const container = svgRef.current;
    if (!container) return null;

    // The rendered SVG is a child since we wrap in a div
    const svgEl = container.querySelector?.("svg") || container;
    if (!svgEl) return null;

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgEl);
  }, []);

  // Expose getSVGString for parent components
  // Store on the ref div as a property for parent access
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      (node as any).__getSVGString = getSVGString;
    }
    (svgRef as any).current = node;
  }, [getSVGString]);

  if (!arrays || arrays.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {fr
          ? "Aucun array PV défini. Configurez d'abord le système sur l'onglet Analyse."
          : "No PV arrays defined. Configure the system in the Analysis tab first."}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="sld-diagram-container overflow-x-auto">
      {config.inverterType === "string" && inverterLayout && (
        <StringInverterSLD
          inverters={inverterLayout}
          config={config}
          language={language}
        />
      )}
      {config.inverterType === "micro" && microLayout && (
        <MicroInverterSLD
          groups={microLayout}
          config={config}
          language={language}
        />
      )}

      {/* Summary table below diagram */}
      <div className="mt-4 text-xs text-muted-foreground space-y-1 px-2">
        <div className="flex justify-between border-b pb-1">
          <span className="font-medium">{fr ? "Résumé électrique" : "Electrical Summary"}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
          <span>{fr ? "Puissance DC totale" : "Total DC Power"}: <strong>{config.systemCapacityKW} kWc</strong></span>
          <span>{fr ? "Panneaux" : "Panels"}: <strong>{config.totalPanels}× Jinko 660W</strong></span>
          <span>{fr ? "Type onduleur" : "Inverter Type"}: <strong>{config.inverterType === "string"
            ? (fr ? "String (centralisé)" : "String (central)")
            : (fr ? "Micro-onduleurs" : "Microinverters")}</strong></span>
          {config.inverterType === "string" && inverterLayout && (
            <>
              <span>{fr ? "Nombre d'onduleurs" : "Inverter Count"}: <strong>{inverterLayout.length}× {config.stringInverterPowerKW || DEFAULT_STRING_INV_KW} kW</strong></span>
              <span>{fr ? "Strings totaux" : "Total Strings"}: <strong>{inverterLayout.reduce((s, inv) => s + inv.strings.length, 0)}</strong></span>
              <span>Voc max/string: <strong>{Math.round(MAX_PANELS_PER_STRING * PANEL_VOC * TEMP_CORRECTION_VOC)}V</strong> ({"<"} {MAX_SYSTEM_VOLTAGE_DC}V)</span>
            </>
          )}
          {config.inverterType === "micro" && microLayout && (
            <>
              <span>{fr ? "Micro-onduleurs" : "Microinverters"}: <strong>{microLayout.reduce((s, g) => s + g.panelCount, 0)}× {config.microInverterPowerW || DEFAULT_MICRO_INV_W}W</strong></span>
              <span>{fr ? "Circuits branche" : "Branch Circuits"}: <strong>{microLayout.length}</strong></span>
            </>
          )}
          <span>{fr ? "Tension service" : "Service Voltage"}: <strong>{config.serviceVoltage || 600}V / {config.serviceAmperage || 400}A</strong></span>
        </div>
      </div>
    </div>
  );
}
