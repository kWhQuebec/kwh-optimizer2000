# kWh Québec Platform

## Overview

kWh Québec is a B2B solar + storage analysis and design platform for commercial, industrial, and institutional buildings in Québec. Its primary purpose is to streamline solar assessment and proposal workflows, offering lead generation, comprehensive energy analysis from consumption data, and detailed PV + Battery system design. The platform includes Bill of Materials generation, pricing, and CRM synchronization, aiming to enhance efficiency in solar deployment and accelerate project development in the C&I sector.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application uses a full-stack monorepo with a unified TypeScript codebase, separating client-side React from server-side Express.

### Technical Stack

-   **Backend**: Node.js, Express, TypeScript
-   **Frontend**: React, TypeScript, Vite
-   **Database**: PostgreSQL via Drizzle ORM (configured for Neon serverless)
-   **Styling**: Tailwind CSS with shadcn/ui component library
-   **Routing**: Wouter

### Frontend Architecture

The frontend uses React with functional components, organized into pages, shared components, and utility functions. State management is handled by TanStack Query for server state, React Context for authentication and internationalization, and React Hook Form with Zod for form validation. The UI features a professional, data-focused design with bilingual support.

### Backend Architecture

The backend provides a RESTful API with JWT-based authentication. It includes a data processing and analysis engine for solar simulation, battery peak-shaving, financial calculations (NPV, IRR, LCOE), and sensitivity analysis, utilizing official Hydro-Québec tariffs and configurable parameters. Data access is abstracted through an `IStorage` interface, and Multer handles CSV file uploads. The system incorporates logic for meter reading deduplication and a priority-based solar production methodology (Google Solar API, Sunshine Hours, or default constant, with bifacial multipliers).

### Database Schema

A PostgreSQL database, managed by Drizzle ORM, includes `users`, `leads`, `clients`, `sites`, `meterFiles`, `meterReadings`, `simulationRuns`, `designs`, `bomItems`, `componentCatalog`, `portfolios`, `portfolioSites`, `designAgreements`, `constructionAgreements`, `constructionMilestones`, `omContracts`, `omVisits`, and `omPerformanceSnapshots`. It uses UUID primary keys, timestamp tracking, and foreign key relationships.

### Key Features and Implementations

-   **Data Processing & Analysis**: Processes Hydro-Québec consumption data, performs 8760-hour solar production simulations, battery peak-shaving, calculates Québec and Federal incentives and tax shields, and generates 25-year cashflows. Includes a sensitivity analysis engine and HQ Tariff Module.

### Meter Reading Deduplication Methodology

When processing consumption data from multiple Hydro-Québec files, the platform implements a robust deduplication algorithm to prevent overcounting:

**Problem Solved:** Sites with overlapping meter files (HOUR + FIFTEEN_MIN granularity) were causing inflated consumption totals (e.g., 303M kWh instead of 379k kWh).

**Algorithm:**
1. Sort all readings by timestamp
2. Bucket readings by hour (floor to hour boundary)
3. For each hour bucket:
   - If HOUR granularity data exists → use it directly
   - Otherwise → sum all FIFTEEN_MIN readings for that hour
   - Preserve maximum kW demand across all readings in bucket
4. Calculate `dataSpanDays` from original readings (before deduplication) for correct annualization

**Annualization Formula:**
```
annualizationFactor = 365 / dataSpanDays
annualConsumptionKWh = totalKWh × annualizationFactor
```

### Validated Calculation Benchmarks (December 2024)

| Metric | Platform Value | Industry Reference (Quebec) |
|--------|----------------|----------------------------|
| Solar Yield | 1,150-1,300 kWh/kWp/yr | 1,150-1,200 kWh/kWp/yr |
| Self-Consumption Rate | 50-70% | 50-70% (commercial, no storage) |
| Self-Sufficiency | 25-40% typical | Varies by system sizing |
| Tariff M Energy Rate | 11.933¢/kWh | HQ official 2024-2025 |
| HQ Solar Incentive | $1,000/kW (max 40% CAPEX) | Official program |
-   **UI Visualization**: Uses Recharts for interactive charts and shadcn/ui table components. The Site Detail Page features an editable Analysis Parameters Editor, enhanced analysis results display, and an Optimization Analysis Section.
-   **Analysis Page Flow**: Structured progression from Summary KPIs to Technical Details, including system configuration, financial breakdown, financing options, and environmental impact.
-   **Tariff Auto-Detection**: Automatically detects appropriate Hydro-Québec tariff codes (Tariff G or M) based on simulated peak demand.
-   **HQ Incentive Policy**: Implements current Hydro-Québec incentives for solar ($1,000/kW, capped at 40% CAPEX) and paired storage (only within solar cap).
-   **HQ Net Metering / Autoproduction Program**: Incorporates new rules for commercial net metering, including a 1 MW capacity limit, surplus compensation after 24 months, and financial projections for surplus revenue.

### HQ Net Metering Surplus Compensation Methodology

**Program Overview (Dec 2024+):**
- Clients bank surplus kWh credits for 24 months
- After 24-month bank reset, unused surplus is compensated at HQ's **cost of supply rate** (NOT client's energy tariff)

**Compensation Rate:**
- **4.54¢/kWh** (coût moyen d'approvisionnement HQ 2025)
- Source: Hydro-Québec Tariff Proposal R-4270-2024 filed with Régie de l'énergie

**Why This Matters:**
- Previous incorrect assumption: compensation at client's tariff (~6-12¢/kWh)
- Correct methodology: compensation at HQ cost of supply (~4.54¢/kWh)
- This significantly impacts surplus revenue projections in financial models

**Implementation:**
- Parameter: `hqSurplusCompensationRate` in AnalysisAssumptions (default: 0.0454 $/kWh)
- Surplus revenue starts year 3+ (after first 24-month cycle)
- Subject to annual inflation escalation like other revenues

**Reference Documents:**
- Régie de l'énergie dossier R-4270-2024
- HQ Autoproduction program: https://www.hydroquebec.com/autoproduction/
-   **System Design Module**: Enables staff to create detailed equipment specifications and bills of materials with auto-populated forms and component selection.
-   **Multi-Scenario Analysis**: Features a Scenario Comparison Dashboard, "Create Variant Dialog," and a Financing Calculator for Cash, Loan, and Capital Lease options, incorporating realistic incentive timing.
-   **Role-Based Access Control (RBAC)**: Supports Admin, Analyst, and Client roles with JWT-based authentication and server-side authorization.
-   **Client Portal**: Provides secure, read-only access for clients to their solar analysis reports.
-   **PDF Report Generation**: Generates professional PDF analysis reports with detailed financial and technical breakdowns.
-   **Public Landing Page & Marketing Pages**: Serves as the primary lead generation tool with sections on services, process, resources, and contact forms. All public pages are fully bilingual (FR-CA/EN-CA).
-   **SEO Infrastructure**: Utilizes an `SEOHead` component for dynamic meta tags, Open Graph, Twitter Cards, and Schema.org JSON-LD structured data for various page types.
-   **Portfolio Management**: Allows multi-building project management, including volume pricing based on building count, aggregated KPIs, executive summary PDFs, and travel optimization estimates.
-   **Email Templates**: Bilingual email templates for various notifications and nurturing sequences with placeholder substitution.
-   **Hydro-Québec Procuration System**: A 3-step wizard for electronic signature and PDF generation of Hydro-Québec data access authorization forms, including in-browser signature capture and legal metadata capture.
-   **Construction Agreements Module**: Manages construction contracts with status tracking (draft→sent→accepted→in_progress→completed→cancelled), milestone-based payment scheduling, electronic signature capture, and Stripe payment integration. Includes deposit payment status and progress tracking.
-   **O&M Contracts Management**: Recurring operations and maintenance contract system with coverage types (basic/standard/premium/custom), SLA tracking, billing cadence (monthly/quarterly/annual), and contract period progress indicators. Links clients and sites to maintenance services.
-   **Maintenance Visits Tracking**: Comprehensive visit scheduling and logging system supporting scheduled, emergency, warranty, and inspection visit types. Tracks technician assignments, findings, actions taken, issues found/resolved, and parts used.
-   **O&M Performance Dashboard**: Real-time monitoring of installed solar systems with KPI cards (performance ratio, uptime, savings, issues), production/savings charts using Recharts, recent visits log, and alert notifications for system anomalies.

## External Dependencies

### Third-Party Services

-   **Google Solar API**: Used for roof area estimation, solar production potential, and imagery via Building Insights and Data Layers APIs, and for yield calibration in simulations. The platform addresses its limitations for large commercial/industrial buildings.
-   **Neon Database**: Serverless PostgreSQL solution.

### Key npm Packages

-   **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcrypt`, `jsonwebtoken`, `multer`, `zod`.
-   **Frontend**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `@radix-ui/*`, `tailwindcss`, `clsx`, `tailwind-merge`.
-   **Build Tools**: `vite`, `esbuild`, `typescript`.