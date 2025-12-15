# kWh Québec Platform

## Overview

kWh Québec is a B2B solar + storage analysis and design platform tailored for commercial, industrial, and institutional buildings in Québec. It aims to streamline solar assessment and proposal workflows for the kWh Québec team, offering lead generation, comprehensive energy analysis from consumption data, and detailed PV + Battery system design with Bill of Materials, pricing, and CRM synchronization. The platform's vision is to enhance efficiency in solar deployment for the C&I sector in Québec, leveraging detailed analytics and design capabilities to accelerate project development and market penetration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application uses a full-stack monorepo structure with a unified TypeScript codebase, separating client-side React from server-side Express.

### Technical Stack

-   **Backend**: Node.js, Express, TypeScript
-   **Frontend**: React, TypeScript, Vite
-   **Database**: PostgreSQL via Drizzle ORM (configured for Neon serverless)
-   **Styling**: Tailwind CSS with shadcn/ui component library
-   **Routing**: Wouter

### Frontend Architecture

The frontend uses React with functional components, organized into pages, shared components, and utility functions. State management is handled by TanStack Query for server state, React Context for authentication and internationalization, and React Hook Form with Zod for form validation. The UI features a professional, data-focused design with bilingual support.

### Backend Architecture

The backend provides a RESTful API with JWT-based authentication. It includes a sophisticated data processing and analysis engine for solar simulation, battery peak-shaving, financial calculations (NPV, IRR, LCOE), and sensitivity analysis, utilizing official Hydro-Québec tariffs and configurable parameters. Data access is abstracted through an `IStorage` interface, and Multer handles CSV file uploads.

### Database Schema

A PostgreSQL database, managed by Drizzle ORM, includes `users`, `leads`, `clients`, `sites`, `meterFiles`, `meterReadings`, `simulationRuns`, `designs`, `bomItems`, and `componentCatalog`. It uses UUID primary keys, timestamp tracking, and foreign key relationships.

### Data Processing & Analysis

The server-side processes Hydro-Québec consumption data, performs 8760-hour solar production simulations, battery peak-shaving, calculates Québec and Federal incentives, tax shields, and generates 25-year cashflows. A sensitivity analysis engine optimizes system sizing by sweeping different configurations. The HQ Tariff Module incorporates official Hydro-Québec tariffs. PV modeling parameters are inspired by industry tools like Helioscope, including Inverter Load Ratio, Temperature Coefficient, Wire Losses, and Degradation Rate.

### UI Visualization

The UI uses Recharts for interactive charts displaying consumption profiles, production simulations, and financial projections. shadcn/ui table components are used for BOMs and detailed metrics. The Site Detail Page features an editable Analysis Parameters Editor, enhanced analysis results display with key KPIs, and an Optimization Analysis Section.

### Analysis Page Flow

The Site Detail analysis results follow a logical progression:
1. **Summary KPIs** - Key financial metrics (NPV, IRR, payback)
2. **System Configuration** - PV and battery sizing details
3. **Financial Breakdown** - Costs, incentives, and cashflows
4. **Financing Options** - Cash, loan, and capital lease comparison
5. **Mid-page CTA** - "View Next Steps" button linking to final section
6. **Environmental Impact** - CO2 reduction and sustainability metrics
7. **Technical Details** - Collapsible parameters and assumptions
8. **Next Steps CTA** - Final call-to-action with design agreement process

### Tariff Auto-Detection

The platform automatically detects the appropriate Hydro-Québec tariff code based on peak demand from simulation data:
- **Tariff G**: For sites with peak demand < 65 kW (small power)
- **Tariff M**: For sites with peak demand ≥ 65 kW (medium power)

This auto-detection runs when initializing analysis assumptions, with saved assumptions taking priority over auto-detected values.

### HQ Incentive Policy (Dec 2024 Update)

- **Solar**: $1,000/kW installed, capped at 40% of gross CAPEX
- **Battery**: NO standalone $300/kW incentive (discontinued)
- **Paired Storage**: Battery can only receive HQ credit when paired with solar AND there's leftover room in the 40% cap after solar incentive is applied

### System Design Module

The System Design page enables staff users to create detailed equipment specifications and bills of materials, with auto-populated form fields from optimal simulation configurations, component selection, and margin configuration.

### Multi-Scenario Analysis Features

The platform includes a Scenario Comparison Dashboard and a "Create Variant Dialog" for generating new "what-if" scenarios. A Financing Calculator provides interactive comparisons of Cash, Loan, and Capital Lease (Crédit-bail) options, featuring realistic cash flow timing for incentives. The capital lease model treats the client as owner for tax purposes, allowing them to receive all incentives (HQ rebates, Federal ITC 30%, CCA tax shield) - typically resulting in positive or break-even cashflows.

### Role-Based Access Control (RBAC)

Three user roles are supported: Admin (full access, user management), Analyst (staff access to analysis and design), and Client (read-only access to their own sites via the client portal). Security features include JWT-based authentication, server-side authorization checks, and client-specific data access.

### Client Portal

The client portal provides customers with secure, read-only access to their solar analysis reports, including a client dashboard and read-only site detail views, replacing manual PDF report distribution.

### PDF Report Generation

The platform generates professional PDF analysis reports featuring a cover page, executive summary with key KPIs, system configuration details, financial breakdown, 25-year cashflow projections, financing options comparison, and scenario comparison.

### Public Landing Page

The public landing page (`/`) serves as the primary lead generation tool with conservative, evergreen messaging, focusing on EPC positioning. It includes sections for hero, incentives, process, benefits, trust, and a contact form. Design features include Framer Motion animations, responsive layouts, and bilingual content.

### Marketing Stack

The platform uses a hybrid website strategy with the main site on Replit and campaign pages on Zoho LandingPage. Default CAPEX values for solar and battery components are configured.

### Public Pages (Dec 2024)

New public marketing pages have been added:
- `/services` - EPC services page (analyse, ingénierie, construction, maintenance)
- `/comment-ca-marche` - Step-by-step process explanation
- `/ressources` - FAQ and resources hub with search functionality

All pages are fully bilingual (FR-CA/EN-CA) with consistent navigation.

### SEO Infrastructure

- **SEOHead Component** (`client/src/components/seo-head.tsx`): Reusable component that injects:
  - Title and meta description
  - Open Graph tags with default logo image
  - Twitter Card tags
  - Language-aware og:locale (fr_CA/en_CA)
  - Schema.org JSON-LD structured data per page type
  
- **Structured Data**: Each page type has appropriate schema:
  - Landing: LocalBusiness schema
  - Services: Service schema
  - How it works: HowTo schema
  - Resources: FAQPage schema

### Portfolio Management (Dec 2024 Feature)

Multi-building project management for clients with multiple sites:

- **Database Schema**: `portfolios` table (id, clientId, name, status, aggregated KPIs) and `portfolioSites` junction table
- **Volume Pricing**: Automatic discounts based on building count:
  - 5-9 buildings: 5% discount
  - 10-19 buildings: 10% discount
  - 20+ buildings: 15% discount
- **Aggregated KPIs**: Total PV size, total battery capacity, net CAPEX, NPV, weighted IRR, annual savings, CO2 avoided
- **Executive Summary PDF**: One-page portfolio summary with site comparison table and volume pricing breakdown
- **Travel Optimization**: Estimates travel days based on 3 buildings per day
- **Routes**: `/app/portfolios` (list), `/app/portfolios/:id` (detail with KPI cards, site table, pricing)

Site Assessment Pricing (per building):
- Travel: $150/day
- Site visit: $600
- Technical evaluation: $1,000
- Single-line diagrams: $1,900

### Email Templates

Bilingual email templates (`server/emailTemplates.ts`) for:
- Quick analysis confirmation
- Detailed analysis request confirmation
- Nurturing sequence (incentives reminder, case study)
- Analysis report ready notification

Templates use placeholder substitution ({{contactName}}, {{pvSizeKW}}, etc.) and include HTML/text variants.

### Hydro-Québec Procuration System (Dec 2024 Feature)

Electronic signature and PDF generation for Hydro-Québec data access authorization:

- **3-Step Wizard** (`/analyse-detaillee`): Company info → Signature → File upload
- **Signer Fields**: Name, Title/Position, Company, HQ Account Number, Address
- **HTML5 Canvas Signature**: In-browser signature capture with validation
- **PDF Generation**: `server/procurationPdfGenerator.ts` creates official HQ procuration document
- **Validity Period**: Automatic calculation of +15 business days from signature date
- **Mandataire Info**: Pre-filled with kWh Québec (Marc-André La Barre, Chef des opérations)
- **Legal Metadata**: IP address, user agent, timestamp captured for compliance
- **Email Delivery**: PDF sent as attachment via Gmail API

**TODO BEFORE LAUNCH**: Change email recipient from `info@kwh.quebec` (testing) to Hydro-Québec's official procuration email address.

## External Dependencies

### Third-Party Services

-   **Google Solar API**: Used for roof area estimation, solar production potential, and imagery via Building Insights and Data Layers APIs, and for yield calibration in simulations.
-   **Zoho CRM**: OAuth2 authenticated integration for lead synchronization and deal creation/updates.
-   **Neon Database**: Serverless PostgreSQL solution.

### Bifacial PV Analysis (Dec 2024 Feature)

The platform automatically detects white membrane roofs from Google Solar API RGB imagery and prompts users to enable bifacial PV analysis:

- **Detection**: Analyzes average RGB brightness of roof imagery (threshold > 200 = white membrane)
- **Bifacial Boost**: Applies yield gain formula: `yield × (1 + bifacialityFactor × roofAlbedo × 0.3)`
- **Default Parameters**: bifacialityFactor=0.85, roofAlbedo=0.70 (white), 0.20 (gravel), 0.10 (dark)
- **Cost Premium**: 5% higher cost per watt for bifacial panels vs monofacial
- **UI Trigger**: Bilingual dialog appears when white roof detected, stored in `bifacialAnalysisPrompted` and `bifacialAnalysisAccepted` fields

### Google Solar API Limitations & Best Practices

The Google Solar API, primarily designed for residential rooftops, has limitations for large commercial/industrial buildings (e.g., system size caps, flat roof accuracy). The platform addresses this with a yield-based comparison for validation, manual roof area entry for large buildings, and applying a utilization factor.

### Key npm Packages

-   **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcrypt`, `jsonwebtoken`, `multer`, `zod`.
-   **Frontend**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `@radix-ui/*`, `tailwindcss`, `clsx`, `tailwind-merge`.
-   **Build Tools**: `vite`, `esbuild`, `typescript`.