---
name: kwh-presentation-consistency
description: Ensures all presentation tools (PDF reports, PPTX slides, client portal, emails) pull data from the same centralized sources. Use when editing any document generator, report template, presentation slide, email template, or client-facing output.
---

# kWh Québec — Presentation Consistency Rules

## Golden Rule

All presentation tools MUST pull shared data from centralized sources — never hardcode equipment, timelines, assumptions, pricing, or brand content directly in a generator file.

## CRITICAL: Simulation Data Single-Source-of-Truth

### The Problem That Must Never Recur

When a user selects an optimized scenario (Économique, Maximum, Équilibré), ALL financial metrics, hourly profiles, and cashflows must come from that scenario's `scenarioBreakdown` — not from the base simulation. Displaying base simulation data instead of scenario-specific data causes inconsistencies between the Validation page, presentation slides, and PDF/PPTX reports.

### Three Merge Points — ALL Must Stay Synchronized

There are exactly 3 places where scenario data is merged into the simulation object. **When modifying any one, you MUST check and update all three.**

| Output | File | Merge Location | How hourlyProfile is accessed |
|--------|------|----------------|-------------------------------|
| Validation page | `client/src/pages/site-detail/components/AnalysisResults.tsx` | No merge needed — reads `displayedScenario.scenarioBreakdown.hourlyProfileSummary` directly | `displayedScenario?.scenarioBreakdown?.hourlyProfileSummary` |
| Presentation slides (HTML) | `client/src/pages/presentation.tsx` | Client-side merge at `optimizedSimulation` (~line 161) | `merged._scenarioHourlyProfileSummary = bd.hourlyProfileSummary` |
| PDF & PPTX reports | `server/documentDataProvider.ts` | `applyOptimalScenario()` function (~line 326) | Converts `scenarioBreakdown.hourlyProfileSummary` → `HourlyProfileEntry[]` format into `merged.hourlyProfile` |

### Scenario Data Fields That Must Be Merged

When merging an optimal scenario into a simulation object, ALL of these fields must come from the scenario, not the base simulation:

**From `optimal` (top-level):**
- `pvSizeKW`, `battEnergyKWh`, `battPowerKW`
- `capexNet`, `npv25`, `irr25`, `simplePaybackYears`
- `selfSufficiencyPercent`, `annualSavings`, `totalProductionKWh`
- `co2AvoidedTonnesPerYear`

**From `optimal.scenarioBreakdown`:**
- `capexGross`, `capexSolar` (→ capexPV), `capexBattery`
- `actualHQSolar` (→ incentivesHQSolar), `actualHQBattery` (→ incentivesHQBattery)
- `itcAmount` (→ incentivesFederal), `taxShield`, `lcoe`
- `annualEnergySavingsKWh`, `totalExportedKWh`, `annualSurplusRevenue`
- **`hourlyProfileSummary`** — CRITICAL: the per-hour consumption/production profile
- **`cashflows`** — the 25-year cashflow array

### HourlyProfileSummary Format Conversion

The `hourlyProfileSummary` from scenarioBreakdown uses a summary format:
```typescript
{ hour: string; consumptionBefore: number; consumptionAfter: number; peakBefore: number; peakAfter: number }
```

The PDF/PPTX `HourlyProfileEntry` format requires conversion:
```typescript
{ hour: number; month: 0; consumption: consumptionBefore; production: consumptionBefore - consumptionAfter; peakBefore; peakAfter; batterySOC: 0 }
```

The presentation slides (HTML) use the summary format directly via `_scenarioHourlyProfileSummary` — no conversion needed.

### Mandatory Checklist When Touching Scenario/Simulation Data

1. Does the change add or modify a field in `scenarioBreakdown`?
   → Update ALL 3 merge points listed above
2. Does the change modify how hourly profiles are displayed?
   → Verify AnalysisResults, EnergyProfileSlide (presentation.tsx), and PDF hourly chart all show identical data
3. Does the change affect financial KPIs?
   → Verify KPIResultsSlide, SnapshotSlide, PDF KPI section, and PPTX KPI section all match
4. Does the change touch cashflows?
   → Verify CashflowSlide (presentation.tsx), PDF cashflow chart, and PPTX cashflow section

### Architecture Note

The client-side merge in `presentation.tsx` duplicates the server-side `applyOptimalScenario()` in `documentDataProvider.ts`. Both must be kept in sync. If refactoring, consider having the presentation page call a server endpoint that uses `applyOptimalScenario()` directly.

## Centralized Data Sources

| Data Type | Source File | Helper Function |
|-----------|------------|-----------------|
| Equipment & specs | `shared/brandContent.ts` | `getEquipment(lang)` |
| Equipment tech summary | `shared/brandContent.ts` | `getEquipmentTechnicalSummary(lang)` |
| Timeline / steps | `shared/brandContent.ts` | `getTimeline(lang)` |
| Financial assumptions | `shared/brandContent.ts` | `getAssumptions(lang, isSyntheticData)` |
| Exclusions | `shared/brandContent.ts` | `getExclusions(lang)` |
| KPI labels | `shared/brandContent.ts` | `getKpiLabel(key, lang)` |
| Contact info | `shared/brandContent.ts` | `getContact()` / `getContactString()` |
| Design mandate pricing | `shared/brandContent.ts` | `getDesignMandatePrice(lang)` |
| Color palette | `shared/colors.ts` | Named exports (e.g. `TIMELINE_GRADIENT`) |
| Logos | `client/public/assets/` | `logo-fr-white.png`, `logo-en-white.png` |
| Narrative arc | `shared/brandContent.ts` | `getNarrativeAct(act, lang)` |

## Presentation Tools That Must Stay Aligned

1. **PDF v1** (PDFKit) — `server/pdf/sections/*.ts` + `server/pdf/index.ts`
2. **PDF v2** (Puppeteer HTML) — `server/services/pdfGeneratorV2.ts`
3. **PPTX** — `server/pptxGeneratorV2.ts`
4. **Client Portal** — `client/src/pages/presentation.tsx`
5. **Email templates** — `server/emailTemplates.ts`, `server/emailService.ts`
6. **Methodology PDF** — `server/pdf/methodologyPDF.ts`
7. **Construction proposal** — `server/constructionProposalPdf.ts`

## Data Source Detection (Synthetic vs Real)

All generators must distinguish between synthetic and real consumption data:
```typescript
const isSyntheticData = !(simulation.hourlyProfile && simulation.hourlyProfile.length > 0);
```
- **Synthetic**: Label as "Données synthétiques (estimation)" / "Synthetic data (estimate)"
- **Real**: Label as "Données Hydro-Québec réelles" / "Real Hydro-Québec data"

## Dynamic Override Pattern

All generators support a dynamic override from the database (BOM items, construction projects) which takes priority over brandContent defaults:
```typescript
const equipment = sim.catalogEquipment?.length > 0
  ? sim.catalogEquipment
  : getEquipment(lang); // fallback to brandContent
```

## Cross-Tool Consistency Rule

**When modifying any visual element, content, or layout in one presentation tool, ALWAYS check if the same element exists in the other tools and apply the fix everywhere.** The tools share many common sections (timeline, equipment, KPIs, next steps, FAQ, etc.) — a fix in one must be propagated to all.

## Checklist When Updating Any Spec

1. Update `shared/brandContent.ts` (single source of truth)
2. Verify all 7 presentation tools reflect the change automatically
3. If a tool has hardcoded fallbacks, replace them with brandContent calls
4. When fixing a visual/layout bug, search for the same pattern in ALL presentation tools
5. Run a test PDF/PPTX generation to verify output
