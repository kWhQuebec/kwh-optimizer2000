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

## What to Update

- **Market Intelligence** (`/app/market-intelligence`): Supplier prices, component pricing, market trends, competitive data
- **Methodology** (`/app/methodology`): Analysis approach, calculation methods, data sources, assumptions, validation procedures

## Where the Data Lives

- Pricing components: `pricing_components` table
- Supplier data: `suppliers` table
- Price history: `price_history` table
- Component catalog: `component_catalog` table
- Analysis parameters: `shared/schema.ts` (defaultAnalysisAssumptions)
