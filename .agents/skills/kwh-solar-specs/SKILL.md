---
name: kwh-solar-specs
description: Technical specifications for kWh Québec solar equipment and analysis parameters. Use when editing analysis logic, equipment references, FAQ answers, proposals, reports, or any content mentioning solar panel specs, degradation, or system sizing.
---

# kWh Québec — Solar Technical Specifications

## Standard Equipment

- **Solar panels**: Jinko 625W bifacial N-type
- **Inverter**: Kaco Blueplanet 375 TL3
- **Racking**: KB Racking (for BOM generation)

## System Parameters

- **Roof space**: ~3.5 m²/kW for 625W panels
- **Degradation rate**: 0.4%/year (90% capacity after 25 years)
- **DC:AC ratio (ILR)**: 1.40–1.47
- **Hydro-Québec consumption data**: 15-minute interval data (not hourly)

## Important Notes

- Never reference old specs (400-500W panels, 5-6 m²/kW, 0.5%/yr degradation, 80% after 25 years)
- Tariff source data in the analysis engine is from Hydro-Québec April 2025 grille tarifaire — this is correct internal labeling
- Public-facing content should reference the current year (2026) for investment context, not the tariff source year
