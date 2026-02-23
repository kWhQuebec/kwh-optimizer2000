---
name: kwh-business-rules
description: Critical business rules and common development pitfalls for kWh Québec. Use when modifying workflow logic, simulation engine, financial calculations, tariffs, or any feature that affects data integrity and business outcomes.
---

# kWh Québec — Critical Business Rules

## Rules That Must NEVER Be Broken

1. **HQ Tariffs**: Tariffs M, G, L, D must match official Hydro-Québec values in force. Never hardcode a tariff without referencing the source.
2. **Incentives**: Validate the HQ Autoproduction program against the current official grid before modifying incentive calculations. The program changes regularly.
3. **Snow loss**: Google Solar API and PVGIS **exclude** snow. Any yield from these sources MUST have a snow profile applied for Quebec.
4. **Simulations are immutable**: Never delete or overwrite an existing simulation. Simulations are historical — always create new ones.
5. **No manual checkboxes**: All task/workflow progress must be auto-detected from measurable data in the database (filled fields, signed documents, etc.). Never use manual checkboxes for workflow progression.

## Common React/Frontend Errors to Avoid

1. **React state not reset on navigation**: When the URL changes (e.g., navigating between sites), `useState` keeps its old value. Always reset in a `useEffect` that depends on the site ID.
2. **useEffect missing `id` dependency**: If an effect depends on data for a specific site, the site `id` MUST be in the dependency array.
3. **staleTime too short**: Don't override the queryClient's staleTime without good reason. The default (60s) is sufficient.
4. **Disabled navigation**: Never put `disabled={true}` on navigation tabs/steps. Use a different visual style (opacity, color) but keep the click functional.
5. **Google Solar data without snow correction**: Always apply the snow profile when yield source is `'google'` and the site is in Quebec.
6. **Orphaned simulations**: Always verify that `selectedSimulationId` corresponds to an existing simulation for the current site before using it.

## Workflow / Gate Logic

- Gate badges must distinguish **blocked** (requirement not met → "requis") from **passed** (requirement met → "disponible")
- Step status is derived from the opportunity pipeline stage via `getStepStatusFromStage()` in `shared/workflowSteps.ts`
- Gate evaluation lives in `useWorkflowProgress.ts` → `evaluateGate()`
- Task completion is auto-detected via `TASK_DETECTORS` — never add manual completion toggles

## Data Integrity

- `totalProductionKWh` in DB uses actual hourly simulation result (with snow losses, clipping, temperature correction, system derates) — NOT a simple `pvSizeKW × effectiveYield` formula
- Roof capacity (`site.kbKwDc`) from RoofVisualization is the hard cap for PV sizing
- Sensitivity analysis caps at 100% roof capacity (not 110% — roof area is a physical constraint)
- The AC/DC ratio (ILR) is configurable in Advanced System Modeling (range 1.0–2.0)
