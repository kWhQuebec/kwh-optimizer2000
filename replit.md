# kWh Québec Platform

## Overview
kWh Québec is a B2B solar + storage analysis and design platform for commercial, industrial, and institutional buildings in Québec. It streamlines solar assessment and proposal workflows by providing lead generation, comprehensive energy analysis from consumption data, and detailed PV + Battery system design. The platform aims to enhance efficiency in solar deployment and accelerate project development in the C&I sector through Bill of Materials generation, pricing, and CRM synchronization.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application is a full-stack monorepo with a unified TypeScript codebase, separating a React-based client from an Express-based server.

### Technical Stack
-   **Backend**: Node.js, Express, TypeScript
-   **Frontend**: React, TypeScript, Vite
-   **Database**: PostgreSQL via Drizzle ORM (configured for Neon serverless)
-   **Styling**: Tailwind CSS with shadcn/ui
-   **Routing**: Wouter

### Architecture Details
The frontend uses React with functional components, managing state via TanStack Query for server state, React Context for authentication and internationalization, and React Hook Form with Zod for form validation. The backend provides a RESTful API with JWT-based authentication, integrating a data processing and analysis engine for solar simulation, battery peak-shaving, financial calculations (NPV, IRR, LCOE), and sensitivity analysis using Hydro-Québec tariffs. Data access is abstracted through an `IStorage` interface, and Multer handles CSV file uploads. The system includes logic for meter reading deduplication and a priority-based solar production methodology.

### Error Handling Pattern
The backend uses a centralized error handling system (`server/middleware/errorHandler.ts`):
-   **AppError classes**: NotFoundError, BadRequestError, ValidationError, ConflictError, UnauthorizedError, ForbiddenError
-   **asyncHandler wrapper**: Wraps route handlers to catch async errors and forward to middleware
-   **Response format**: `{error: string, details?: array}` - details array preserves structured Zod validation errors
-   **Usage**: Routes throw errors instead of manual `res.status().json()` for errors
-   See `server/routes/clients.ts` as the reference implementation

### Key Features
-   **Data Processing & Analysis**: Processes Hydro-Québec consumption data, performs solar production simulations, battery peak-shaving, calculates incentives, and generates 25-year cashflows. Financial engine uses monthly peak demand tracking (not annual average) for accurate demand savings, accounts for battery grid charging costs, and models charging demand impact on utility meter readings.
-   **System Design Module**: Enables detailed equipment specifications and Bill of Materials creation.
-   **Multi-Scenario Analysis**: Offers a Scenario Comparison Dashboard and a Financing Calculator.
-   **Role-Based Access Control (RBAC)**: Supports Admin, Analyst, and Client roles.
-   **Archive System**: Soft-delete capability for clients and sites with isArchived boolean field, optional cascade archiving of sites when archiving clients, and UI toggles to show/hide archived records.
-   **User Onboarding**: Auto-generated temporary passwords (12-char, cryptographically secure via crypto.randomBytes) sent in welcome emails. Users are forced to change password on first login for security.
-   **Client Portal**: Provides secure, read-only access to analysis reports.
-   **PDF Report Generation**: Creates professional conversion-optimized PDF proposals with Project Snapshot, Financial Waterfall, Surplus Credits (net metering), Assumptions & Exclusions, Equipment & Warranties, Timeline, and 3-block Next Steps sections. All content sourced from `server/brandContent.ts` (SSOT). Matching PPTX presentations and HTML slide decks also generated. Smart currency formatting: values ≥$1M show as "$X.XM", ≥$10k as "$Xk" for KPI headlines; detailed line items retain full formatting. Surplus credits section includes correct HQ net metering language (24-month credit bank, ~4.54¢/kWh reference rate).
-   **Portfolio Management**: Allows multi-building project management with volume pricing.
-   **Hydro-Québec Integrations**: Incorporates HQ incentive policies, net metering rules, and a procuration system for data access authorization.
-   **AI-Powered HQ Bill Parsing**: Uses Gemini Vision to extract account number, client name, address, annual consumption, and tariff code from uploaded HQ bills (PDF or images). Endpoint: `POST /api/parse-hq-bill`.
-   **2-Step Detailed Analysis Form**: Step 1 uploads HQ bill for AI parsing, Step 2 pre-fills form with extracted data for user verification and completion.
-   **Consumption-Based Quick Analysis with Dynamic Optimization**: Calculates solar system sizing from annual kWh consumption (via bill upload or manual entry). Analyzes 11 scenarios from 20% to 120% offset in 10% increments, then returns 3 optimized scenarios: **"Économique"** (shortest payback period, recommended), **"Maximum"** (100% offset reference), and either **"Équilibré"** (best LCOE or intermediate option). No Google Solar API dependency for sizing. **Defaults to bill upload mode**. **Unified methodology** matches Detailed Analysis: BASELINE_YIELD=1150 kWh/kWp, temperature correction (-0.4%/°C), wire losses (2%), inverter efficiency (96%), effective yield ~1035 kWh/kWp. Uses tiered pricing from getTieredSolarCostPerW(). HQ incentive $1000/kW (max 40% CAPEX, 1MW limit), Federal ITC 30%. **Warning displayed when any scenario exceeds 1 MW** (Net Metering limit).
-   **Law 25 Privacy Compliance**: Quebec privacy law compliance with mandatory consent checkbox on Quick Analysis form (button disabled until checked), bilingual privacy policy page at `/privacy` with data collection disclosures, retention periods, security measures, and data subject rights (access, rectification, erasure, withdrawal, portability). Contact: info@kwh.quebec, 514.427.8871.
-   **Financing Calculator**: Compares Cash, Loan, Lease, and PPA options over 25-year horizon. PPA defaults set conservatively (75% Year 2+ rate = 25% savings, 15-year term) to ensure ownership options show better long-term value on comparison charts.
-   **HQ Procuration Email**: Staff can send bilingual authorization request emails directly to clients from the CRM.
-   **Advanced Analysis**: Includes Monte Carlo Probabilistic ROI simulations and a 15-Minute Peak Shaving Calculator.
-   **Market Intelligence Pricing**: Dynamic, component-based pricing with tiered options and an admin UI for management. Includes supplier management, price history tracking with analytics (3/6/12 month trends, supplier comparison), and "Promote to Catalog" functionality linking quotes to operational pricing. Freshness indicators (Fresh/Stale/Outdated) show when catalog prices need updating.
    -   **Pricing Architecture**: Component Catalog stores COST prices only (from suppliers). Margins are applied at quote time in the Quotation/Estimation tool, allowing per-project or per-item markup flexibility.
-   **Solar Mockup Visualization**: Generates visual mockups of solar panel installations using Google Solar API data, showing panel positions and constraint areas.
-   **Manual Roof Drawing Tool**: A mandatory interactive tool for technicians to trace roof areas before analysis, with validation tracking. Includes AI-powered constraint suggestion using Gemini Vision to automatically detect HVAC units, skylights, vents, and other rooftop obstacles from satellite imagery. Uses WebMercator projection for accurate pixel-to-geographic coordinate conversion.
-   **KB Racking Integration**: Utilizes validated KB Racking specifications for direct sizing calculations, automated BOM generation, and tiered pricing.
-   **CRM Workflow Automation**: Website leads (from quick estimate and detailed analysis forms) automatically create Opportunity records in the sales pipeline. Dashboard QuickStart shows 5-step workflow (0. New Opportunity → 1. Create Site → 2. Import Data → 3. Run Analysis → 4. Generate Proposal) and displays "New Prospects" count to prompt timely follow-up. Clicking the "New Prospects" KPI navigates to pipeline with stage filter pre-applied.
-   **Pipeline Stage Filtering**: Pipeline page supports URL parameter `?stage=prospect` to pre-filter by stage. Stage filter dropdown allows filtering opportunities by pipeline stage in both Kanban and List views.
-   **Inline Entity Creation**: Opportunity creation form supports inline creation of new clients and sites without leaving the dialog. When creating a new client, fields appear for name, email, and phone. When an existing client is selected, a site dropdown appears with existing client sites plus "Create new site" option. Inline site creation includes fields for name (required), address, city, and province (defaults to Québec). Entities are created sequentially: client → site → opportunity.

## Standardized Color Palette
The platform uses a centralized color palette defined in `shared/colors.ts`. All charts, sales tools, PDFs, PPTX, and UI components must use these colors consistently.

### Brand Colors
-   **Primary Blue** `#003DA6` — Titles, CTA buttons, sidebar, "Net" in waterfall, positive cashflow bars
-   **Dark Blue** `#002B75` — Deeper accent for headings
-   **Accent Gold** `#FFB005` — Highlights, recommendations, cumulative line, payback marker

### Semantic Colors
-   **Positive/Green** `#16A34A` — Benefits, savings, HQ incentives, won stages, environmental metrics
-   **Negative/Red** `#DC2626` — Costs, losses, negative cashflow bars, exclusions, lost stage
-   **Neutral/Gray** `#6B7280` — CAPEX Brut bar, secondary text, labels
-   **Info/Blue** `#3B82F6` — ITC, tax shield, supplementary data series

### Chart Color Conventions
-   Waterfall: Gray gross → Gold HQ incentive → Blue ITC/tax shield → Dark blue net (hide $0 bars)
-   Cashflow: Blue positive bars, Red negative bars, Gold cumulative line, Gold payback marker
-   Pipeline CRM: Blue gradient (cold→warm) → Gold (decision) → Green gradient (won) → Red (lost)
-   KPI icons: Brand blue (primary metrics) and brand gold (action/highlight metrics)
-   Financing: Green (cash), Blue (loan), Gold (lease), Info blue (PPA)

### Colors NOT to use
-   `#22C55E` (old green) — replaced by `#16A34A`
-   `#2D915F` / `#48bb78` (old greens) — replaced by `#16A34A`
-   `#ef4444` (old red) — replaced by `#DC2626`
-   `#F43F5E` (rose) — replaced by `#3B82F6` or `#DC2626` depending on context
-   Tailwind `emerald-*` and `rose-*` — use `green-*` and `red-*` instead

## External Dependencies

### Third-Party Services
-   **Google Solar API**: Used **ONLY for solar yield estimation** (kWh/kWp at location). Roof area and sizing come from manually traced polygons (see Methodology below).
-   **Neon Database**: Serverless PostgreSQL solution.

### Roof Area & Sizing Methodology
**Source of Truth**: Manual roof tracing via RoofDrawingModal is the authoritative source for roof surfaces in C&I projects. Google Solar API is NOT used for area/sizing.

**Workflow**:
1. Technician traces roof polygons using satellite imagery overlay
2. Polygons with label "Constraint" or color orange (#f97316) are excluded from usable area
3. Total usable area = sum of solar polygon areas (stored in `roof_polygons.area_sq_m`)
4. Max PV capacity calculated using KB Racking formula: `(usable_area_m² × utilization_ratio / 3.71) × 0.625 kW`
5. Sensitivity analysis limits scenarios to roof's actual capacity (no arbitrary 1000+ kWc)

**Yield Calculation** (Google Solar used here only):
- Google Solar provides base yield (kWh/kWp) for the location if available
- Default baseline: 1150 kWh/kWp (Quebec average)
- Adjustments: temperature correction (-0.4%/°C), wire losses (2%), inverter efficiency (96%)
- Bifacial bonus: +15% if enabled
- Effective yield typically ~1035-1100 kWh/kWp after corrections

### Key npm Packages
-   **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcrypt`, `jsonwebtoken`, `multer`, `zod`.
-   **Frontend**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `@radix-ui/*`, `tailwindcss`, `clsx`, `tailwind-merge`.
-   **Build Tools**: `vite`, `esbuild`, `typescript`.