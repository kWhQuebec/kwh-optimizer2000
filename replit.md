# kWh Québec Platform

## Overview
kWh Québec is a B2B solar + storage analysis and design platform for commercial, industrial, and institutional buildings in Québec. It automates solar assessment and proposal generation, offering lead management, detailed energy analysis from consumption data, and comprehensive PV + Battery system design. The platform aims to boost efficiency in solar deployment, accelerate project development in the C&I sector, and provide tools for Bill of Materials generation, pricing, and CRM synchronization. It enhances proposal quality with professional PDF reports, integrates with Hydro-Québec specifics, and utilizes AI for bill parsing, targeting market potential in Quebec's renewable energy sector.

## Brand DNA
- **Tagline**: "Turnkey solar and storage solutions for Quebec's commercial and industrial sectors."
- **Values**: Simplicity, Reliability, Sustainability, Pride
- **Aesthetic**: industrial scale, sustainable technology, corporate trust, engineering precision, modern cleanliness
- **Tone**: Professional, Authoritative, Technical, Reassuring
- **Brand content source of truth**: `shared/brandContent.ts`

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
The frontend uses React functional components with TanStack Query for server state, React Context for authentication and internationalization, and React Hook Form with Zod for form validation. The backend provides a RESTful API with JWT authentication and integrates a data processing engine for solar simulation, battery peak-shaving, financial calculations (NPV, IRR, LCOE), and sensitivity analysis based on Hydro-Québec tariffs. Key features include an AI-powered Hydro-Québec bill parsing system, a 2-step detailed analysis form, and a Consumption-Based Quick Analysis. It also features a comprehensive Financing Calculator and multi-scenario acquisition cashflow charts.

The analysis engine is PVSyst-calibrated, incorporating specific derate factors, ILR, and bifacial parameters. Roof capacity constraints are managed, prioritizing `site.kbKwDc` from the RoofVisualization panel layout. The platform ensures Law 25 Privacy Compliance for Quebec and includes CRM workflow automation, market intelligence pricing, a Manual Roof Drawing Tool with AI-powered constraint suggestion, and a Benchmark Calibration Tool.

### 9-Step Project Workflow (Site Detail Page)
The site detail page uses a compact numbered stepper (1-9) to mirror the solar project lifecycle, covering quick analysis, consumption data, economic validation, mandate, technical validation, EPC proposal, plans & specifications, permits & installation, and O&M. Steps 1-3 are visible to all roles; steps 4-9 are staff-only.

### Hydro-Québec Background Job System
The HQ data fetch runs as an asynchronous background job with a dedicated schema (`hqFetchJobs`, `siteMeters`). The backend service (`server/services/hqBackgroundJobRunner.ts`) handles asynchronous fetching and incremental CSV import, updating progress in the database. The API provides endpoints to start jobs, poll status, and check for active jobs. The frontend polls job status and provides global toast notifications for job completion or failure.

### Portfolio Performance Optimization
The portfolio `/full` endpoint uses `lightSiteColumns` in `server/repositories/portfolioRepo.ts` to exclude heavy JSONB columns (`hqConsumptionHistory`, `baselineMonthlyProfile`, `analysisAssumptions`, `roofAreaAutoDetails`) and large text fields (`roofVisualizationImageUrl` which stores base64 images) at the SQL level. Simulation queries for portfolio sites first fetch SCENARIO-type simulations, then fall back for sites without scenarios — avoiding fetching all historical simulations. Response: ~200 KB / ~0.4s (down from 64 MB / 2.6s).

### Master Agreement PDF (CCDC 14 Design-Build Format)
The Dream Master Agreement PDF (`server/pdf/masterAgreementPDF.ts`) generates a comprehensive Design-Build (CCDC 14) document — NOT a PPA. Entity names are fully dynamic via `_currentClientName` (set from `data.clientName`), used in footer, parties, consultant description, and signatures. Two entity-aligned portfolios exist: "Dream Summit - Master Agreement" (12 MON sites, client: Dream Summit Industrial (Quebec) Inc.) and "Dream Canada Solar - Master Agreement" (11 21xxx sites, client: Dream Industrial Canada Solar Inc). Sections: Cover, TOC, Executive Summary (3 KPIs: Sites, kW DC, Investment), Parties & Roles, Commercial Terms (Design-Build model, no PPA terms), Financial Framework ($/W column prefers `installCostPerW` from financial model, variable pricing $1.62-$1.65/W per site, auto-splits for >15 sites), Scope of Work (Section 5: 11 Owner items + 16 Design-Builder items including ITC/LCAB + 5 General Provisions consolidated on 1 page), Schedule of Values (Section 6: 7 milestones matching Dream Exhibit C — 15%/10%/15%/25%/20%/10%/5%, consolidated to 1 page, 21 pricing assumptions including O&M at $11.25/kW/yr + $0.80 consumables, 9 exclusions, payment terms), Annex A per-site schedules (degradation display uses smart formatting; ITC labeled "estimated"; interconnection DOT note added), Supplementary Conditions (Section 8: 28 SC articles, "construction legal hypothec" wording, regular thermography), and Signatures. All pages use fixed `.page` class (279.4mm height, overflow:hidden) with Puppeteer-side overflow detection.

### Building Types (CUBF-Aligned)
All building type data is centralized in `shared/buildingTypes.ts`, aligned with Quebec's CUBF (Code d'Utilisation des Biens-Fonds) standard. Each type includes CUBF code range, bilingual labels, energy intensity, operating schedule, load factors, monthly shape factors, and industry benchmarks. Legacy values (`commercial`, `institutional`, `other`) auto-resolve via aliases. Consumers: `syntheticProfile.ts`, `industryBenchmarks.ts`, `consumption-tools.tsx`, `QuickInfoForm.tsx`, `analyse-detaillee.tsx`, `emailService.ts`, `kbProposalPdfGenerator.ts`.

### Google Places Address Autocomplete
Site and Client creation forms use Google Places Autocomplete (`client/src/components/address-autocomplete.tsx`) to auto-fill city, province, postal code, and coordinates when an address is selected. The component uses the Google Maps JavaScript API with the `places` library (included alongside `drawing` and `geometry` in all Google Maps script loaders). The autocomplete dropdown is restricted to Canadian addresses. All three Google Maps script loaders (RoofVisualization, RoofDrawingModal, AddressAutocomplete) include `places` in their library list for compatibility.

### Authentication & Token Refresh
JWT access tokens expire after 15 minutes. Login returns both `token` (access) and `refreshToken` (7-day). The frontend (`client/src/lib/queryClient.ts`) automatically intercepts 401 responses, exchanges the refresh token at `/api/auth/refresh` for a new access token, and retries the failed request. The refresh endpoint validates user existence and active status before issuing new tokens.

### Roof Area Source Tracking
Both quick-potential and detailed analysis endpoints track the source of roof area data via a `roofAreaSource` field in responses: `"polygons"` (drawn), `"site"` (manual/Google Solar), `"sibling-copy"` (copied from same-address site), or `"consumption-estimate"` (reverse-engineered from consumption). The frontend displays an amber warning banner when results use estimated roof area.

### Canonical Simulation Metrics Resolver
The module `server/analysis/resolveSimulationMetrics.ts` provides the single source of truth for reading financial metrics from simulation records:
- **`resolveSimulationMetrics(simulation, target?)`** — Canonical resolver that checks `sensitivity.optimalScenarios` for the requested target ('npv'|'irr'|'selfSufficiency'), falling back to flat DB columns. Used by portfolio aggregation and PDF generation.
- **`buildSimulationInsert(siteId, result, options?)`** — Typed helper for creating simulation records. Both manual and auto-analysis paths use this, eliminating field name mismatches and `as any` casts.
- **`aggregatePortfolioKPIs(portfolioSites, target?)`** — Unified portfolio aggregation used by `/api/portfolios/:id/full`, `/recalculate`, portfolio PDF, and master agreement PDF. IRR is consistently weighted by `capexNet`.
- **`resolvePortfolioSiteMetrics(ps, target?)`** — Per-site resolution with override chain: override value → resolved metric → 0.
- **`calculateVolumeDiscount(numBuildings)`** — Shared volume discount calculation.

### Portfolio Synchronization
The portfolio recalculate endpoint (`POST /api/portfolios/:id/recalculate`) clears all site-level overrides before recalculating totals from the latest simulations. This ensures the portfolio always reflects current analysis results after sync. Portfolio PDF and master agreement PDF now live-calculate aggregates using the canonical resolver instead of reading stale pre-stored values.

### Error Handling
The backend uses a centralized error handling system with custom `AppError` classes and an `asyncHandler` wrapper for consistent error responses.

### UI/UX - Standardized Color Palette
A centralized color palette defined in `shared/colors.ts` ensures consistent branding across UI, charts, and generated documents, utilizing brand colors (Primary Blue, Dark Blue, Accent Gold) and semantic colors (Positive, Negative, Neutral, Info).

### Website Audit (Completed)
All 16 audit tasks implemented: ROI payback corrected to "5-9 ans avec incitatifs", degradation text includes year-1 context (~1-2%), CCA 43.2 qualified with "consultez votre comptable", ITC qualified as "up to 30% for eligible businesses", institutional removed from public-facing selectors (kept in backend engine), hero headline benefit-focused ("Réduisez votre facture de 30-50%"), lead form simplified to 5 fields, CTAs updated to "Voir mon potentiel solaire", phone number added to header, portfolio metrics enriched, ÉcoPerformance FAQ added, battery storage page created at `/stockage-energie`, FAQ JSON-LD expanded to 21 questions, image lazy loading verified, canonical URLs standardized to `www.kwh.quebec`, sitemap updated with new routes.

### Public Pages & Routes
- `/` — Landing page (hero, social proof band, lead form, process timeline)
- `/services` — Services page (commercial + industrial sectors only)
- `/stockage-energie` — Battery/storage page (peak shaving, Tarif M, backup, ROI)
- `/ressources` — Resources page with 21 FAQ items across 4 categories
- `/ressources/calculateur-roi-solaire` — ROI calculator with 4 educational sections
- `/portfolio` — Public portfolio grid with production/savings metrics
- `/portfolio/:id` — Project detail pages
- `/nouvelles` — Blog/news page
- `/mandat-de-conception-preliminaire` — Design mandate form

## External Dependencies

### Third-Party Services
-   **Google Solar API**: Used for solar yield estimation.
-   **Neon Database**: Serverless PostgreSQL solution.
-   **Gemini Vision**: Utilized for AI-powered Hydro-Québec bill parsing and AI-powered constraint suggestion in the roof drawing tool.

### Key npm Packages
-   **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcrypt`, `jsonwebtoken`, `multer`, `zod`.
-   **Frontend**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `@radix-ui/*`, `tailwindcss`, `clsx`, `tailwind-merge`.
-   **Build Tools**: `vite`, `esbuild`, `typescript`.