---
name: kwh-market-intelligence
description: Rule to keep Market Intelligence and Methodology sections up to date. Use whenever new pricing data, supplier information, analysis methods, or calculation improvements are implemented in the platform.
---

# kWh Québec — Market Intelligence & Methodology Updates

## Rule

Always update the Market Intelligence and Methodology sections when new information is received or new methods are applied to the platform.

## When to Update

- New supplier pricing data is added or updated
- Component catalog prices change
- New analysis methods or calculation improvements are implemented
- Solar yield estimation methodology changes
- Financial calculation formulas are modified (NPV, IRR, LCOE, etc.)
- New tariff data from Hydro-Québec is integrated
- Battery or peak-shaving algorithms are updated
- Monte Carlo simulation parameters change
- Benchmark calibration data is updated
- PVSyst system loss parameters are modified
- Government incentive programs change (OSE versions, ITC, CCA)

## What to Update

- **Market Intelligence** (`/app/market-intelligence`): Supplier prices, component pricing, market trends, competitive data, program updates
- **Methodology** (`/app/methodology`): Analysis approach, calculation methods, data sources, assumptions, validation procedures

## Where the Data Lives

- Pricing components: `pricing_components` table
- Supplier data: `suppliers` table
- Price history: `price_history` table
- Component catalog: `component_catalog` table
- Analysis parameters: `shared/schema.ts` (defaultAnalysisAssumptions)

## PVSyst Calibration Baseline (Feb 2026)

The analysis engine is calibrated against Rematek PVSyst reports for Montreal-area C&I projects. Key calibration points:

- **System loss budget**: ~5.4% net derate (wire 3%, LID 1%, mismatch 2.15%, quality gain -0.75%)
- **DC:AC ratio**: 1.45 (PVSyst range 1.44–1.47)
- **Bifaciality**: 0.80 factor, 0.60 albedo (conservative)
- **Effective net yield**: ~1,030 kWh/kWp after all derates + temperature correction

When modifying any yield or loss parameters, the methodology page must reflect the change and note the PVSyst validation source.

## OSE 6.0 Baseline (Effective March 31, 2026)

Program: "Solutions efficaces" under Hydro-Québec (replaces ÉcoPerformance/TEQ which was dissolved).

### Solar PV Measure
- **Incentive**: $1,000/kW installed
- **Cap**: 40% of admissible costs (solar only — excludes storage, interconnection, financing)
- **Limit**: 1 MW per subscription
- **Eligible tariffs**: All except Tarif L and contrats particuliers
- **Certifications**: CSA 22.2 No 61730 + CAN/CAS-IEC 61215
- **Installer**: RBQ license required
- **Equipment purchase**: Must be after March 31, 2026
- **Recommendation**: Wait for HQ conditional acceptance before purchasing

### Partner Incentive Tiers (Offre simplifiée)
- < $10K: 10%
- $10-20K: 11%
- $20-40K: 12%
- $40-80K: 13%
- $80-160K: 14%
- $160K+: 15%
- Max $50,000/project
- Retroactive to January 1, 2026
- No minimum threshold required

### Other Key Changes
- **LED lighting**: DLC Standard eliminated; DLC Premium $40→$20/lum
- **Building automation**: 100% coverage until April 30, 2026 (normally 75-90%)
- **M&GE minimum threshold**: $2,500→$1,000
- **Project cap**: $5M (harmonized with Offre sur mesure)
- **Markets**: 5→3 (commercial + institutional merged)
- **Max buildings**: 10 per project in OSE tool
- **Thermal envelope**: 2-20x increase in financial support

### Transition Rules
- Projects ≥ March 31, 2026 → OSE 6.0
- Oct 7, 2024 – March 30, 2026 → OSE 5.1
- May 9, 2022 – Oct 6, 2024 → OSE 4.1

### Multi-Measure Bonus (Internal Only)
- +10% for 2 measures, +15% for 3 measures from different groups
- Groups: heat recovery, geothermal, thermal envelope
- **Solar PV is NOT eligible** for this bonus
- Useful to know if client also plans building envelope or HVAC work

### Financial Engine Status
Already correct — no changes needed:
- $1,000/kW incentive ✅
- 40% cap on admissible CAPEX ✅
- 1 MW max ✅
- Battery: no standalone incentive ✅
- Tarif L excluded ✅
