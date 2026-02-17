---
name: kwh-solar-specs
description: Technical specifications for kWh Québec solar equipment and analysis parameters. Use when editing analysis logic, equipment references, FAQ answers, proposals, reports, or any content mentioning solar panel specs, degradation, or system sizing.
---

# kWh Québec — Solar Technical Specifications

## Standard Equipment

- **Solar panels**: Jinko 625W bifacial N-type TOPCon (JKM-625N-66HL4M-BDV)
- **Inverter**: Kaco Blueplanet 375 TL3
- **Racking**: KB Racking (for BOM generation)

## System Parameters

- **Roof space**: ~3.5 m²/kW for 625W panels
- **Degradation rate**: 0.4%/year (90% capacity after 25 years)
- **DC:AC ratio (ILR)**: 1.45 (PVSyst range 1.44–1.47)
- **Hydro-Québec consumption data**: 15-minute interval data (not hourly)
- **Baseline brut yield**: 1,150 kWh/kWp (before system losses)

## PVSyst-Validated System Loss Budget (Source: Rematek PVSyst Reports Feb 2026)

| Parameter | Value | Direction | Code field |
|---|---|---|---|
| DC wiring losses | 3.0% | Loss | `wireLossPercent: 0.03` |
| Light Induced Degradation (LID) | 1.0% | Loss | `lidLossPercent: 0.01` |
| Module mismatch at MPP | 2.0% | Loss | `mismatchLossPercent: 0.02` |
| String mismatch | 0.15% | Loss | `mismatchStringsLossPercent: 0.0015` |
| Module quality gain | 0.75% | **Gain** | `moduleQualityGainPercent: 0.0075` |
| **Net system derate** | **~5.4%** | Loss | Compound of above |

### Effective Yield Calculation

- Brut baseline: 1,150 kWh/kWp
- Net derate factor: (1 - 0.03) × (1 - 0.01) × (1 - 0.02) × (1 - 0.0015) × (1 + 0.0075) ≈ 0.9463
- Effective net yield: 1,150 × 0.9463 ≈ 1,088 kWh/kWp (before temperature correction)
- With temperature correction: ~1,030 kWh/kWp (matches PVSyst output)

### Bifacial Parameters (PVSyst-calibrated)

- **Bifaciality factor**: 0.80 (80% rear-side efficiency)
- **Roof albedo**: 0.60 (conservative; PVSyst range 0.42–0.60)
- **Temperature coefficient**: -0.4%/°C

### Where These Values Live in Code

- Defaults: `shared/schema.ts` → `defaultAnalysisAssumptions`
- Interface: `server/analysis/potentialAnalysis.ts` → `SystemModelingParams`
- Simulation: `server/routes/siteAnalysisHelpers.ts` → `runHourlySimulation()`
- Duplicate simulation: `server/routes.ts` → `runHourlySimulation()` (legacy)
- Display: `shared/brandContent.ts` → `BRAND_CONTENT.assumptions`

## Important Notes

- Never reference old specs (400-500W panels, 5-6 m²/kW, 0.5%/yr degradation, 80% after 25 years)
- Never use old defaults (ILR 1.2, wireLoss 0%, no LID/mismatch losses)
- Tariff source data in the analysis engine is from Hydro-Québec April 2025 grille tarifaire — this is correct internal labeling
- Public-facing content should reference the current year (2026) for investment context, not the tariff source year
- System losses are applied in DC production calculation AFTER temperature correction and BEFORE inverter clipping
- Module quality gain is a **negative loss** (increases output) — applied as `(1 + moduleQualityGainPercent)`
