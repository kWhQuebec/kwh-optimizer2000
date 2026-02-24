# kWh Québec Platform

## Overview
kWh Québec is a B2B solar + storage analysis and design platform tailored for commercial, industrial, and institutional buildings in Québec. It automates and optimizes solar assessment and proposal generation, offering lead management, detailed energy analysis from consumption data, and comprehensive PV + Battery system design. The platform's core purpose is to boost efficiency in solar deployment, accelerate project development in the C&I sector, and provide tools for Bill of Materials generation, pricing, and CRM synchronization. It enhances proposal quality with professional PDF reports, integrates with Hydro-Québec specifics, and utilizes AI for bill parsing, aiming to capture market potential in Quebec's renewable energy sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application is a full-stack monorepo built with a unified TypeScript codebase, separating a React-based client from an Express-based server.

### Technical Stack
-   **Backend**: Node.js, Express, TypeScript
-   **Frontend**: React, TypeScript, Vite
-   **Database**: PostgreSQL via Drizzle ORM (configured for Neon serverless)
-   **Styling**: Tailwind CSS with shadcn/ui
-   **Routing**: Wouter

### Design Patterns & Core Features
The frontend leverages React functional components, using TanStack Query for server state, React Context for authentication and internationalization, and React Hook Form with Zod for form validation. The backend provides a RESTful API with JWT authentication and integrates a robust data processing engine for solar simulation, battery peak-shaving, financial calculations (NPV, IRR, LCOE), and sensitivity analysis based on Hydro-Québec tariffs. Data access is abstracted, and Multer handles CSV file uploads. The system includes an archive system for soft-deletion, role-based access control (RBAC) for Admin, Analyst, and Client roles, and secure user onboarding with forced password changes.

Key features include an AI-powered Hydro-Québec bill parsing system (using Gemini Vision) for extracting consumption data, and a 2-step detailed analysis form. A Consumption-Based Quick Analysis calculates solar sizing and provides optimized scenarios ("Économique", "Maximum", "Équilibré") without relying on Google Solar API for sizing. It also features a comprehensive Financing Calculator comparing Cash, Loan, Lease, and PPA options, and multi-scenario acquisition cashflow charts.

The analysis engine is PVSyst-calibrated (Feb 2026, Rematek reports) with a ~5.4% net system derate (wire 3%, LID 1%, mismatch 2.15%, quality gain -0.75%), ILR 1.45, and bifacial parameters (0.80 factor, 0.60 albedo). System loss parameters are defined in `shared/schema.ts` (defaultAnalysisAssumptions) and applied in `runHourlySimulation()` after temperature correction, before inverter clipping. The reported `totalProductionKWh` uses the hourly simulation result (with all losses and clipping applied), not a simple `pvSizeKW × effectiveYield` multiplication.

**Roof capacity constraint**: The analysis engine uses `site.kbKwDc` (from RoofVisualization panel layout, auto-saved to DB) as the hard cap for PV sizing when available, falling back to the KB Racking formula `(usableAreaSqM / 3.71) × 0.660` otherwise. The sensitivity analysis strictly caps at `maxPVFromRoof × 1.0` (no 110% overflow — roof area is a physical constraint). The AC/DC ratio (ILR) is configurable in Advanced System Modeling parameters (range 1.0-2.0).

The platform ensures Law 25 Privacy Compliance for Quebec. CRM workflow automation integrates website leads into a sales pipeline, supported by inline entity creation and email lead nurturing sequences. Advanced analysis tools include Monte Carlo simulations and a 15-Minute Peak Shaving Calculator. Market Intelligence Pricing offers dynamic, component-based pricing with an admin UI for management, tracking supplier prices, and promoting items to a catalog. A mandatory Manual Roof Drawing Tool, coupled with AI-powered constraint suggestion, provides accurate usable roof area calculations, with KB Racking integration for BOM generation. A Benchmark Calibration Tool allows analysts to compare internal estimates against professional simulation tools. Optional snow loss profiles are configurable.

### 9-Step Project Workflow (Site Detail Page)
The site detail page uses a compact numbered stepper (1-9) to mirror the solar project lifecycle:
1. **Analyse rapide** - Quick potential estimate from roof area (staff-only controls)
2. **Données de consommation** - CSV upload, HQ data fetch, meter management, load profiles
3. **Validation économique** - Full analysis results, scenario comparison, benchmark calibration (sub-tool)
4. **Mandat** - Preliminary design mandate with e-signature
5. **Validation technique** - Technical site visit documentation
6. **Proposition EPC** - EPC proposal management (placeholder)
7. **Plans & devis** - Plans and specifications (placeholder)
8. **Permis et installation** - Permit and installation management (placeholder)
9. **O&M** - Operations & maintenance tracking (placeholder)

Steps 1-3 are visible to all roles; steps 4-9 are staff-only. The "Compare" sub-view and "Activities" history are accessible from within the workflow but are not numbered steps. The stepper shows status indicators: green (complete), blue (available), gray (pending).

### Hydro-Québec Background Job System
The HQ data fetch runs as an asynchronous background job rather than a synchronous SSE stream. Key components:
-   **Schema**: `hqFetchJobs` table tracks job state (status, progress counts, contract metadata, timestamps). `siteMeters` has fields for HQ metadata (hqContractNumber, hqMeterNumber, tariffCode, subscribedPowerKw, maxDemandKw, serviceAddress).
-   **Backend**: `server/services/hqBackgroundJobRunner.ts` runs the fetch asynchronously with incremental CSV import (each file saved immediately after download). Progress is updated in DB at each step. Only one job can run at a time.
-   **API**: `POST /api/admin/hq-data/start-job` starts a job and returns immediately. `GET /api/admin/hq-data/jobs/:jobId` polls status. `GET /api/admin/hq-data/active-job` checks for running jobs. Job stages use machine codes ("login", "fetching_accounts", "fetching_contracts", "downloading", "completed") mapped to bilingual labels in the frontend.
-   **Frontend**: `HQDataFetchInline.tsx` polls job status every 2 seconds with elapsed timer, progress bars, ETA, and contract details. Survives page navigation (checks for active job on mount). `HQJobNotifier.tsx` provides global toast notifications when jobs complete/fail from any page.
-   **Notifications**: Toast notification on completion (global, visible from any page). Optional email notification for large batches.

### Error Handling
The backend uses a centralized error handling system with custom `AppError` classes (e.g., `NotFoundError`, `ValidationError`) and an `asyncHandler` wrapper for route handlers, providing consistent `{error: string, details?: array}` responses.

### UI/UX - Standardized Color Palette
A centralized color palette defined in `shared/colors.ts` ensures consistent branding across UI, charts, and generated documents.

**Brand Colors**:
-   Primary Blue (`#003DA6`)
-   Dark Blue (`#002B75`)
-   Accent Gold (`#FFB005`)

**Semantic Colors**:
-   Positive/Green (`#16A34A`)
-   Negative/Red (`#DC2626`)
-   Neutral/Gray (`#6B7280`)
-   Info/Blue (`#3B82F6`)

Specific color conventions apply to charts (waterfall, cashflow), CRM pipeline stages, and KPI icons, ensuring visual clarity and brand consistency. Obsolete Tailwind colors have been replaced with the standardized palette.

## External Dependencies

### Third-Party Services
-   **Google Solar API**: Used exclusively for solar yield estimation (kWh/kWp at location).
-   **Neon Database**: Serverless PostgreSQL solution.
-   **Gemini Vision**: Utilized for AI-powered Hydro-Québec bill parsing and AI-powered constraint suggestion in the roof drawing tool.

### Key npm Packages
-   **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcrypt`, `jsonwebtoken`, `multer`, `zod`.
-   **Frontend**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `@radix-ui/*`, `tailwindcss`, `clsx`, `tailwind-merge`.
-   **Build Tools**: `vite`, `esbuild`, `typescript`.

## Recent Changes
- **Feb 2026**: Fixed yield inflation bug — `totalProductionKWh` stored in DB now uses actual hourly simulation result (with snow losses, clipping, temperature correction, system derates) instead of simple `pvSizeKW × effectiveYield` formula. Both main sim and sensitivity analysis now produce consistent yield per kWp.
- **Feb 2026**: Fixed inverted seasonal curve in `runHourlySimulation` — changed `1 - 0.4*cos(...)` to `1 + 0.4*cos(...)` so solar production correctly peaks in summer (~11% in May/June) and is lowest in winter (~5.5% in Dec/Jan), matching Quebec latitude ~46°N patterns.
- **Feb 2026**: Updated `SNOW_LOSS_FLAT_ROOF` to PVGIS-calibrated values (Jan 55%, Feb 45%, Mar 30%, Apr 5%, Nov 10%, Dec 40%) yielding ~15% annual loss. Added `SNOW_LOSS_TILTED` profile for roofs >15° slope. Snow loss auto-forced when `yieldSource === 'google'` (Google Solar API excludes snow). Existing analyses flagged `snowProfileOutdated: true`.
- **Feb 2026**: Roof capacity single-source-of-truth — RoofVisualization saves kbKwDc/kbPanelCount to site DB, analysis engine prefers this over formula
- **Feb 2026**: Sensitivity analysis caps at 100% roof capacity (was 110%)
- **Feb 2026**: "Meilleur TRI" optimization tab always visible (falls back to bestNPV data when bestIRR is null)
- **Feb 2026**: Roof drawing sharing by address — sites at the same address auto-copy roof polygons to avoid redrawing
- **Feb 2026**: Consolidated PDF generators — removed V1 (PDFKit) entirely, V2 (Puppeteer/HTML) is now the sole PDF generator. Eliminated `?v=1` fallback route. PDF and HTML presentation now share same page structure and brandContent sources.
- **Feb 2026**: PDF V2 enhanced — added Delivery Assurance page (milestones, QA checkpoints, delivery team, warranty roadmap, Hydro-Québec interconnection), Fit Score page (circular gauge, 4 criteria bars, verdict using shared computeFitScore), and Credibility page (replaces old About page, positioned last). Equipment table now shows Certifications badges instead of Weight/Dimensions.
- **Feb 2026**: PDF V2 page order: Cover → Why Solar Now → Project Snapshot → Results → Net Investment → Energy Profile (cond.) → Storage (cond.) → Financial Projections → Equipment → Delivery Assurance → Fit Score → Assumptions → Next Steps → Credibility

- **Feb 2026**: Added "Nouvelles de l'industrie" (Industry News) feature — automated RSS feed aggregation from Google News (FR+EN), Gemini AI relevance scoring and content generation, admin curation UI at `/app/admin/news`, public page at `/nouvelles`. Auto-fetches every 6h. Enhanced with: category system (politique/technologie/financement/marché/réglementation), SEO-optimized individual article pages (`/nouvelles/:slug`) with JSON-LD structured data, category filter tabs on public page, LinkedIn share buttons with pre-filled social posts, view count tracking, and AI-suggested categories. News articles consolidated under Ressources page (`/blog?tab=nouvelles`) with `/nouvelles` redirecting there.

- **Feb 2026**: Dream RFP portfolio — validated 23 sites (removed 3 OUT sites: 21231, 21317, 21318 that failed DOT capacity). Added `financialModel` JSONB field to `portfolioSites` for per-site financial model data (project specs, costs, revenue, operating costs, financing, ITC, results). New `SiteFinancialModel` interface in `shared/schema.ts`. UI component `SiteFinancialModel.tsx` shows branded tables with kWh/Dream/Computed responsibility badges. Master Agreement header section frames Dream/kWh/ScaleClean Tech 3-party relationship. 2520 Marie-Curie seeded with first financial model data.
- **Feb 2026**: Removed "Factor Details" section from PDF Fit Score page (was rendering with clipped text). Evaluation Factors bars and final score box remain.
- **Feb 2026**: Satellite image centering — Google Static Maps now centers on polygon centroid (avg of all roof polygon coordinates) with auto-zoom derived from bounding box. Falls back to site lat/lng when no polygons exist.

## TODO / Future Work
- **Option B: Parent site with sub-meters** — Restructure so a single "building" entity owns the roof drawing, with multiple meter/compteur sub-entities attached. This replaces the current address-matching copy approach with a proper parent-child relationship. Priority: medium-term.