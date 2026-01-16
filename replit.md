# kWh Québec Platform

## Overview
kWh Québec is a B2B solar + storage analysis and design platform tailored for commercial, industrial, and institutional buildings in Québec. It aims to streamline solar assessment and proposal workflows by offering lead generation, comprehensive energy analysis from consumption data, and detailed PV + Battery system design. The platform includes Bill of Materials generation, pricing, and CRM synchronization, with the goal of enhancing efficiency in solar deployment and accelerating project development in the C&I sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application is a full-stack monorepo utilizing a unified TypeScript codebase, separating a React-based client from an Express-based server.

### Technical Stack
-   **Backend**: Node.js, Express, TypeScript
-   **Frontend**: React, TypeScript, Vite
-   **Database**: PostgreSQL via Drizzle ORM (configured for Neon serverless)
-   **Styling**: Tailwind CSS with shadcn/ui component library
-   **Routing**: Wouter

### Frontend Architecture
The frontend uses React with functional components, organized into pages, shared components, and utility functions. State management is handled by TanStack Query for server state, React Context for authentication and internationalization, and React Hook Form with Zod for form validation. The UI features a professional, data-focused design with bilingual support.

### Backend Architecture
The backend provides a RESTful API with JWT-based authentication. It includes a data processing and analysis engine for solar simulation, battery peak-shaving, financial calculations (NPV, IRR, LCOE), and sensitivity analysis, utilizing official Hydro-Québec tariffs and configurable parameters. Data access is abstracted through an `IStorage` interface, and Multer handles CSV file uploads. The system incorporates logic for meter reading deduplication and a priority-based solar production methodology.

### Database Schema
A PostgreSQL database, managed by Drizzle ORM, includes tables for `users`, `leads`, `clients`, `sites`, `meterFiles`, `meterReadings`, `simulationRuns`, `designs`, `bomItems`, `componentCatalog`, `portfolios`, `portfolioSites`, `designAgreements`, `constructionAgreements`, `constructionMilestones`, `omContracts`, `omVisits`, `omPerformanceSnapshots`, and `roofPolygons`.

### Key Features and Implementations
-   **Data Processing & Analysis**: Processes Hydro-Québec consumption data, performs 8760-hour solar production simulations, battery peak-shaving, calculates Québec and Federal incentives and tax shields, and generates 25-year cashflows.
-   **Meter Reading Deduplication**: Implements an algorithm to prevent overcounting consumption data from overlapping meter files.
-   **Solar Yield Calculation**: Tracks yield sources (Google, manual, default) and applies bifacial boost and temperature correction conditionally.
-   **Structural Constraints Tracking**: Stores and displays engineering feasibility data for each site.
-   **UI Visualization**: Uses Recharts for interactive charts and shadcn/ui table components.
-   **Unified Optimal Scenario Display**: Displays a "Recommended System" based on the optimal NPV scenario from frontier analysis on the Site Detail page.
-   **Tariff Auto-Detection**: Automatically detects appropriate Hydro-Québec tariff codes (Tariff G or M).
-   **HQ Incentive Policy**: Incorporates current Hydro-Québec incentives for solar and paired storage.
-   **HQ Net Metering / Autoproduction Program**: Integrates new rules for commercial net metering, including surplus compensation at HQ's cost of supply rate.
-   **System Design Module**: Enables detailed equipment specifications and Bill of Materials creation.
-   **Multi-Scenario Analysis**: Features a Scenario Comparison Dashboard and a Financing Calculator for various options.
-   **Role-Based Access Control (RBAC)**: Supports Admin, Analyst, and Client roles with JWT-based authentication.
-   **Client Portal**: Provides secure, read-only access to solar analysis reports.
-   **PDF Report Generation**: Generates professional PDF analysis reports.
-   **Public Landing Page & Marketing Pages**: Serves as a bilingual lead generation tool with SEO infrastructure.
-   **Portfolio Management**: Allows multi-building project management with volume pricing and aggregated KPIs.
-   **Pipeline RFP Split Display**: Portfolio opportunities with mixed RFP eligibility are automatically split into two virtual cards in the pipeline view:
    -   RFP HQ card (green badge) showing eligible sites count and CAPEX value
    -   Hors RFP card (amber badge) showing non-eligible sites count and CAPEX value
    -   Pipeline values correctly calculated from split display values
    -   Stage changes and edits operate on parent opportunity for database integrity
-   **HQ RFP Eligibility Tracking**: Tracks Hydro-Québec RFP eligibility for commercial sites including:
    -   RFP status (eligible/not_eligible/pending) with semantic color-coded badges
    -   Network upgrade cost breakdown (distribution, substation, protections, communications)
    -   DOT capacity status and lead times
    -   Structural feasibility pass/fail status
    -   Building metadata (external ID, square footage, year built)
    -   Substation and transformer identifiers
-   **Email Templates**: Bilingual email templates for notifications.
-   **Hydro-Québec Procuration System**: A wizard for electronic signature and PDF generation of data access authorization forms.
-   **Construction Agreements Module**: Manages construction contracts, payment scheduling, and Stripe integration.
-   **O&M Contracts Management**: System for recurring O&M contracts with SLA tracking and billing.
-   **Maintenance Visits Tracking**: Schedules and logs various types of maintenance visits.
-   **O&M Performance Dashboard**: Real-time monitoring of installed solar systems with KPIs, charts, and alerts.
-   **Automatic Tiered Pricing**: Solar cost per watt is automatically adjusted based on system size (economies of scale):
    -   < 100 kW: $2.30/W (small commercial)
    -   100-500 kW: $2.15/W (medium commercial)
    -   500 kW - 1 MW: $2.00/W (large commercial)
    -   1-3 MW: $1.85/W (industrial)
    -   3 MW+: $1.70/W (utility-scale)
-   **Solar Mockup Visualization**: Automatically generates visual mockups of solar panel installations using Google Solar API data:
    -   Satellite imagery overlay with panel positions (blue rectangles)
    -   Constraint areas highlighted (orange) for roof obstacles
    -   Adjustable panel count slider
    -   PNG export for client presentations
    -   Integration with system sizing recommendations
    -   Fallback algorithmic panel generation (teal panels) when Google data is limited (<10 panels)
-   **IFC-Compliant Panel Placement**: All solar capacity calculations use consistent, industry-standard parameters:
    -   **Panel specifications**: 590W bifacial, 2.0m × 1.0m physical dimensions
    -   **Perimeter setback**: 1.2m (4 feet) IFC fire code standard - properly enforced via polygon inset
    -   **Obstacle setback**: 1.2m from HVAC/constraints - enforced via polygon expansion + distance validation
    -   **Panel gap**: 0.1m for thermal expansion and maintenance
    -   **Row spacing**: 0.5m additional (1.5m total pitch) for 10° ballast systems typical in Quebec
    -   **Effective panel footprint**: 3.15 m² (2.1m × 1.5m grid cell)
    -   **Utilization ratio**: 85% of roof area usable after perimeter setback
    -   **Power density**: ~187 W/m² effective
    -   Consistent parameters across: RoofVisualization, SolarMockup, quick-potential, quick-estimate endpoints
    -   **Simple Grid-Based Fill Algorithm**: For all roof geometries including L/U/T-shaped:
        -   Uses global PCA axis for uniform panel orientation across entire roof
        -   CCW polygon winding normalization ensures correct inset/expansion operations
        -   Roof polygon inset by 1.2m creates containment boundary - panels must have ALL 4 corners inside
        -   Constraint polygons expanded by 1.2m for obstacle clearance
        -   Distance-based fallback validation when polygon expansion fails (tiny/degenerate obstacles)
        -   Fire corridors (1.2m width) enforced for roofs > 40m in either dimension
        -   Handles concave/convex polygons uniformly without face decomposition
        -   Matches industry tools (Aurora/Helioscope) for professional-looking layouts
        -   **Triangular Section Handling**: Fallback containment check uses meter-space pointInPolygon when inset polygon collapses in narrow sections, ensuring panels appear in triangular protrusions
-   **Manual Roof Drawing Tool (MANDATORY)**: Interactive roof area tracing required before running analysis for commercial buildings:
    -   **Mandatory Workflow**: Technicians must draw roof areas BEFORE running any solar analysis simulation
    -   Prominent amber alert banner blocks analysis until roof is validated
    -   Sites list shows validation status badges: "Roof validated" (green) or "Roof pending" (red)
    -   Google Maps satellite view with Drawing Manager
    -   Polygon and rectangle drawing tools for roof outlines
    -   Real-time area calculation using `google.maps.geometry.spherical.computeArea()`
    -   Custom labels for each roof section (e.g., "Main Building", "Warehouse A")
    -   GeoJSON coordinate storage for polygon persistence
    -   Total combined area calculation automatically updates roof area parameter
    -   Database schema: `roofPolygons` table with coordinates, areaSqM, color, and metadata
    -   Database fields: `roofAreaValidated`, `roofAreaValidatedAt`, `roofAreaValidatedBy` track validation state
-   **KB Racking Integration**: Real-world commercial racking data from 18 actual projects (~40 MW, $7.3M):
    -   **Validated Panel Specs**: Jinko 625W bifacial (2.382m × 1.134m × 30mm, 32.4kg)
    -   **Racking System**: AeroGrid 10° Landscape ballast mount (12.84 kg/panel)
    -   **Fixed Row Spacing**: 1.557m (inter-row 0.435m) for optimal tilt angle
    -   **Perimeter Setback**: 1.22m IFC fire code compliance
    -   **Tiered Pricing Curve**: 
        - <1,500 panels: $115.50/panel
        - 1,500-3,000 panels: $113.00/panel
        - 3,000-5,000 panels: $111.50/panel
        - 5,000-8,000 panels: $111.00/panel
        - 8,000+ panels: $110.00/panel
    -   **Automated BOM Generation**: Panels, racking, shipping, PE stamped engineering
    -   **Portfolio Intelligence Dashboard**: Total MW, racking value, price analytics
    -   **Quote Expiration Tracking**: 30-day validity with 7-day warning alerts
    -   **PDF Proposal Generator**: Bilingual FR/EN professional quotes
    -   **API Endpoints**:
        - `/api/kb-racking/estimate` - Cost estimation by panel count
        - `/api/kb-racking/estimate-from-area` - Estimation from roof area (m²)
        - `/api/kb-racking/bom/:panelCount` - Bill of Materials generation
        - `/api/kb-racking/specs` - Standard specifications
        - `/api/kb-racking/portfolio-stats` - Portfolio KPI summary
        - `/api/kb-racking/expiring-quotes` - Quotes expiring soon
        - `/api/kb-racking/proposal-pdf/:siteId` - PDF proposal generation
-   **Advanced Analysis Modules**:
    -   **Monte Carlo Probabilistic ROI**: A 500-iteration simulation for financial calculations with variable ranges, returning P10/P50/P90 confidence intervals.
    -   **15-Minute Peak Shaving Calculator**: Analyzes granular consumption data for battery storage optimization and demand charge savings.
    -   **Standard Kit Recommender**: Snaps optimal system sizing to predefined standard kits for simplified proposals.

## External Dependencies

### Third-Party Services
-   **Google Solar API**: Used for roof area estimation, solar production potential, imagery, and yield calibration.
-   **Neon Database**: Serverless PostgreSQL solution.

### Key npm Packages
-   **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcrypt`, `jsonwebtoken`, `multer`, `zod`.
-   **Frontend**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `@radix-ui/*`, `tailwindcss`, `clsx`, `tailwind-merge`.
-   **Build Tools**: `vite`, `esbuild`, `typescript`.