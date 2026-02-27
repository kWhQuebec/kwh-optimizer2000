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

### Master Agreement PDF (CCDC 14 Format)
The Dream Industrial REIT Master Agreement PDF (`server/pdf/masterAgreementPDF.ts`) generates a comprehensive 9-section document: Cover, TOC, Executive Summary, Parties & Roles, Commercial Terms, Financial Framework (auto-splits for >15 sites), Scope of Work (Section 5: 11 Owner items + 21 Design-Builder items + 5 General Provisions), Schedule of Values (Section 6: 10 milestones, 21 pricing assumptions, 9 exclusions, payment terms — each on separate pages), Annex A per-site schedules (compact annex-page layout), Supplementary Conditions (Section 8: 28 SC articles in 8-page batches of 3-4 articles), and Signatures. All pages use fixed `.page` class (279.4mm height, overflow:hidden) with Puppeteer-side overflow detection that warns if any page content is clipped.

### Building Types (CUBF-Aligned)
All building type data is centralized in `shared/buildingTypes.ts`, aligned with Quebec's CUBF (Code d'Utilisation des Biens-Fonds) standard. Each type includes CUBF code range, bilingual labels, energy intensity, operating schedule, load factors, monthly shape factors, and industry benchmarks. Legacy values (`commercial`, `institutional`, `other`) auto-resolve via aliases. Consumers: `syntheticProfile.ts`, `industryBenchmarks.ts`, `consumption-tools.tsx`, `QuickInfoForm.tsx`, `analyse-detaillee.tsx`, `emailService.ts`, `kbProposalPdfGenerator.ts`.

### Error Handling
The backend uses a centralized error handling system with custom `AppError` classes and an `asyncHandler` wrapper for consistent error responses.

### UI/UX - Standardized Color Palette
A centralized color palette defined in `shared/colors.ts` ensures consistent branding across UI, charts, and generated documents, utilizing brand colors (Primary Blue, Dark Blue, Accent Gold) and semantic colors (Positive, Negative, Neutral, Info).

## External Dependencies

### Third-Party Services
-   **Google Solar API**: Used for solar yield estimation.
-   **Neon Database**: Serverless PostgreSQL solution.
-   **Gemini Vision**: Utilized for AI-powered Hydro-Québec bill parsing and AI-powered constraint suggestion in the roof drawing tool.

### Key npm Packages
-   **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcrypt`, `jsonwebtoken`, `multer`, `zod`.
-   **Frontend**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `@radix-ui/*`, `tailwindcss`, `clsx`, `tailwind-merge`.
-   **Build Tools**: `vite`, `esbuild`, `typescript`.