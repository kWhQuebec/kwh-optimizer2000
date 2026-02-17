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

## What to Update

- **Market Intelligence** (`/app/market-intelligence`): Supplier prices, component pricing, market trends, competitive data
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
