---
name: kwh-roof-capacity-consistency
description: Prevents roof capacity display inconsistencies in kWh Québec. Use whenever editing code that displays, calculates, or passes roof capacity values (kWc/kW), PV system sizing, or roof-related numbers across components (AnalysisResults, RoofVisualization, QuickInfoForm, site-detail index).
---

# Roof Capacity Consistency Rules

## The Golden Rule

**Roof capacity must ALWAYS be the real, unmodified value calculated from roof geometry (panels × panel wattage) or the formula-based estimate. NEVER apply arbitrary reduction factors (×0.9, ×0.85, etc.) to displayed roof capacity values.**

## Why This Matters

The platform displays roof capacity in multiple places (visualization tags, configuration dashboard, step 1 summary, sliders). If ANY of these applies a different factor, the numbers become inconsistent and confuse clients during presentations. This has caused repeated bugs.

## Capacity Source Hierarchy

1. **Roof geometry capacity** (`roofGeometryCapacityKW`): Calculated from drawn polygons — `panelCount × panelWattage / 1000`. This is the most accurate.
2. **Formula-based estimate** (`maxPVFromRoof`): `(usableRoofSqM / panelAreaSqM) × panelKW`. Used when no roof drawing exists.
3. **Google Solar API**: Only used for yield (kWh/kWp), NOT for capacity sizing.

## Key Variables and Their Meaning

| Variable | File | Must Equal |
|---|---|---|
| `effectiveMaxPV` | AnalysisResults.tsx | `roofGeometryCapacityKW ?? maxPVFromRoof` (raw, no factors) |
| `displayedRoofCapacityKW` | AnalysisResults.tsx | `Math.round(effectiveMaxPV)` (NO ×0.9 or any factor) |
| `displayedCapacityKW` | site-detail/index.tsx | `geometryCapacity?.realisticCapacityKW ?? Math.round(maxCapacityKW)` (NO ×0.9) |
| `maxCapacity` | RoofVisualization.tsx | `allPanelPositions.length × PANEL_KW` when polygons exist |
| `cappedPvSizeKW` | AnalysisResults.tsx | `Math.min(uncappedPvSizeKW, displayedRoofCapacityKW)` |

## Forbidden Patterns

```typescript
// NEVER DO THIS — arbitrary reduction factors on capacity
const displayedRoofCapacityKW = Math.round(effectiveMaxPV * 0.9);
const displayedCapacityKW = Math.round(maxCapacityKW * 0.9);
const capacity = roofCapacity * 0.85;

// CORRECT — use the real value
const displayedRoofCapacityKW = Math.round(effectiveMaxPV);
const displayedCapacityKW = Math.round(maxCapacityKW);
```

## Cross-Component Consistency Checklist

When editing ANY roof/capacity code, verify these all show the same number for a given site:

- [ ] **Visualization "potentiel max" badge** (RoofVisualization.tsx)
- [ ] **Slider max value** (RoofVisualization.tsx)
- [ ] **"Capacité toit estimée"** in configuration dashboard (AnalysisResults.tsx)
- [ ] **Step 1 quick analysis capacity** (site-detail/index.tsx)
- [ ] **"currentPVSizeKW" Zap badge** — must be ≤ roof capacity (capped value)

## When the Zap Badge Should Appear

The Zap badge (showing recommended PV size) should only appear when the recommended size differs from the max capacity. When the system is roof-limited (recommended = max), hiding it avoids showing two identical numbers.

## System Loss Factors

Physical system losses (wire loss, LID, mismatch, inverter clipping) are applied INSIDE the simulation engine (`runHourlySimulation`), NOT as a visible capacity reduction. The roof capacity displayed to users is always the nameplate DC capacity.
