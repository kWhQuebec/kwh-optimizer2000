---
name: kwh-presentation-consistency
description: Ensures all presentation tools (PDF reports, PPTX slides, client portal, emails) pull data from the same centralized sources. Use when editing any document generator, report template, presentation slide, email template, or client-facing output.
---

# kWh Québec — Presentation Consistency Rules

## Golden Rule

All presentation tools MUST pull shared data from centralized sources — never hardcode equipment, timelines, assumptions, pricing, or brand content directly in a generator file.

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
3. **PPTX** — `server/pptxGenerator.ts`
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
