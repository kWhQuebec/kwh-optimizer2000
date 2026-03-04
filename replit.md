# kWh Québec Platform

## Overview
kWh Québec is a B2B solar + storage analysis and design platform for commercial, industrial, and institutional buildings in Québec. It automates solar assessment and proposal generation, offering lead management, detailed energy analysis from consumption data, and comprehensive PV + Battery system design. The platform aims to boost efficiency in solar deployment, accelerate project development in the C&I sector, and provide tools for Bill of Materials generation, pricing, and CRM synchronization. It enhances proposal quality with professional PDF reports, integrates with Hydro-Québec specifics, and utilizes AI for bill parsing, targeting market potential in Quebec's renewable energy sector.

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

### Error Handling
The backend uses a centralized error handling system with custom `AppError` classes and an `asyncHandler` wrapper for consistent error responses.

### UI/UX - Standardized Color Palette
A centralized color palette defined in `shared/colors.ts` ensures consistent branding across UI, charts, and generated documents, utilizing brand colors (Primary Blue, Dark Blue, Accent Gold) and semantic colors (Positive, Negative, Neutral, Info).

### Website Audit (Completed)
All 16 audit tasks implemented: ROI payback corrected to "5-9 ans avec incitatifs", degradation text includes year-1 context (~1-2%), CCA 43.2 qualified with "consultez votre comptable", ITC qualified as "up to 30% for eligible businesses", institutional removed from public-facing selectors (kept in backend engine), hero headline benefit-focused ("Réduisez votre facture de 30-50%"), lead form simplified to 5 fields, CTAs updated to "Voir mon potentiel solaire", phone number added to header, portfolio metrics enriched, ÉcoPerformance FAQ added, battery storage page created at `/stockage-energie`, FAQ JSON-LD expanded to 21 questions, image lazy loading verified, canonical URLs standardized to `www.kwh.quebec`, sitemap updated with new routes.

### Optimization Frontier Chart (All Presentation Tools)
The efficiency frontier chart ("Analyse d'optimisation") is integrated across all four presentation outputs, consistently positioned after Financial Projections/Cashflow and before Surplus Credits/Financing. It plots net investment (x) vs 25-year NPV (y) for all swept configurations — solar (gold #FFB005), storage (blue #003DA6), hybrid (green #16A34A). Unprofitable points (NPV<0) are faded; the optimal point (max NPV) is highlighted with a ring. A red dashed NPV=0 profitability threshold line is drawn. A summary box identifies the optimal configuration with key metrics. Implementations: (1) PDF (`pdfGeneratorV2.ts`): `buildOptimizationPage` with inline SVG via `generateFrontierSVG`, conditional on frontier data; (2) HTML presentation (`presentation.tsx`): `OptimizationFrontierSlide` using Recharts ScatterChart, always in SLIDES array with no-data placeholder; (3) PPTX V2 (`pptxGeneratorV2.ts`): inline SVG in `wrapSlide()`, conditional; (4) PPTX V1 (`pptxGenerator.ts`): native pptxgenjs shapes, conditional. OSE 6.0 incentive: battery receives 0 HQ incentive (solar-only program); no spillover from solar cap to battery.

### OSE 6.0 Content Update (March 2026)
Hydro-Québec "Solutions efficaces" program (replacing TEQ/ÉcoPerformance) updated across all public-facing content, internal tools, and PDF proposals. Solar PV measure: $1,000/kW, 40% cap, 1 MW max, CSA certifications required, RBQ license, effective March 31 2026. Financial engine was already correct — only labels and content were updated. Market Intelligence page includes full OSE 6.0 reference card with partner incentive tiers, transition rules, and multi-measure bonus details (internal only). Files updated: ressources.tsx, seo-head.tsx, structured-data.tsx, methodology.tsx, methodologyPDF.ts, calculateur-roi.tsx, i18n.tsx, brandContent.ts, pdfGeneratorV2.ts, pdfEnhancements.ts, market-intelligence.tsx.

### Public Pages & Routes
- `/` — Landing page (hero, social proof band, lead form, process timeline)
- `/services` — Services page (commercial + industrial sectors only)
- `/stockage-energie` — Battery/storage page (peak shaving, Tarif M, backup, ROI)
- `/ressources` — Resources page with 22+ FAQ items across 4 categories (updated for OSE 6.0)
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