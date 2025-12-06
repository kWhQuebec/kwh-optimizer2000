# kWh Québec Platform

## Overview

kWh Québec is a B2B solar + storage analysis and design platform for commercial, industrial, and institutional buildings in Québec. Its primary purpose is to streamline solar assessment and proposal workflows for the kWh Québec team. The platform offers lead generation, comprehensive energy analysis from consumption data, and detailed PV + Battery system design with Bill of Materials, pricing, and CRM synchronization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Monorepo Structure

The application uses a unified TypeScript codebase within a single Replit project, separating client-side React from server-side Express. This approach simplifies deployment and ensures type safety across the stack.

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, TypeScript, Vite
- **Database**: PostgreSQL via Drizzle ORM (configured for Neon serverless)
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Routing**: Wouter (lightweight client-side routing)

### Frontend Architecture

The frontend utilizes React with functional components, organized into pages, shared components, and utility functions. State management is handled by TanStack Query for server state, React Context for authentication and internationalization, and React Hook Form with Zod for form validation. The UI features a professional, data-focused design with bilingual support, custom Tailwind CSS, and specific font choices for readability.

### Backend Architecture

The backend provides a RESTful API with JWT-based authentication. Data access is abstracted through an `IStorage` interface, currently using in-memory storage but designed for Drizzle ORM + PostgreSQL migration. Multer middleware handles CSV file uploads. The backend also includes a sophisticated data processing and analysis engine for solar simulation, battery peak-shaving, financial calculations (NPV, IRR, LCOE), and sensitivity analysis, utilizing official Hydro-Québec tariffs and configurable parameters.

### Database Schema

The PostgreSQL database schema, managed by Drizzle ORM, includes core entities such as `users`, `leads`, `clients`, `sites`, `meterFiles`, `meterReadings`, `simulationRuns`, `designs`, `bomItems`, and `componentCatalog`. It uses UUID primary keys, timestamp tracking, and foreign key relationships to support portfolio analysis and scenario comparison.

### Data Processing & Analysis

The server-side data processing handles CSV parsing of Hydro-Québec consumption data, including auto-detection of file types, encoding, and missing data interpolation. An advanced analysis engine performs 8760-hour solar production simulations, battery peak-shaving, calculates Québec and Federal incentives, tax shields, and generates 25-year cashflows. A sensitivity analysis engine optimizes system sizing by sweeping different configurations and identifying the optimal point based on maximum NPV. The HQ Tariff Module incorporates official Hydro-Québec tariffs for various customer types. Analysis parameters are highly configurable.

**Optimal Configuration Selection**: When sensitivity analysis identifies a hybrid configuration (PV + battery) as optimal, the system uses a >= comparison with $0.01 epsilon tolerance to ensure the optimal frontier configuration is always adopted, even when NPV values are numerically equal to the initial run. This prevents edge cases where floating-point equality could cause the system to show incorrect recommendations.

### Helioscope-Inspired System Modeling

The hourly simulation engine includes professional-grade PV modeling parameters inspired by industry tools like Helioscope:

- **Inverter Load Ratio (ILR/DC-AC Ratio)**: Configurable oversizing of DC array relative to inverter AC capacity (default 1.2, range 1.0-2.0). Accounts for inverter clipping during peak production hours.
- **Temperature Coefficient**: Adjusts hourly PV output based on cell temperature using Quebec monthly temperature averages. Default -0.4%/°C typical for crystalline silicon modules. Uses cell temp model (ambient + 25°C).
- **Wire Losses**: Conductor and wiring losses applied after temperature correction (default 2%, configurable 0-10%).
- **Degradation Rate**: Annual panel degradation applied in all cashflow calculations and LCOE. Revenue for year Y = baseSavings × (1 - degradation)^(Y-1) × (1 + inflation)^(Y-1). Default 0.5%/year.

These parameters are exposed in the Analysis Parameters Editor with bilingual labels and persist with simulation runs.

### UI Visualization

The UI uses Recharts for interactive charts displaying consumption profiles, production simulations, and financial projections. shadcn/ui table components are used for BOMs and detailed metrics. The Site Detail Page features an editable Analysis Parameters Editor, enhanced analysis results display with key KPIs, and an Optimization Analysis Section with interactive charts for efficiency frontier, solar size, and battery size optimization.

### System Design Module

The System Design page (`/app/design/:simulationId`) enables staff users to create detailed equipment specifications and bills of materials:

- **Auto-populated Form Fields**: PV size, battery energy, and battery power are automatically populated from the selected simulation's optimal configuration
- **Auto-generated Design Name**: Combines site name with current date for easy identification
- **Component Selection**: Dropdowns for selecting modules, inverters, and batteries from the component catalog
- **Margin Configuration**: Adjustable profit margin percentage for pricing calculations
- **Full i18n Support**: All UI elements support FR-CA/EN-CA language switching

### Multi-Scenario Analysis Features

The platform includes advanced scenario comparison and variant creation tools:

- **Scenario Comparison Dashboard**: Side-by-side comparison of multiple simulation runs with metrics table and four comparison charts (NPV, annual savings, payback period, system sizing). Accessible via the "Compare" tab on site detail pages.
- **Create Variant Dialog** (Staff only): Allows cloning an existing simulation with modified parameters (PV size, battery size, battery power) to create new "what-if" scenarios. Backend validates and clamps sizing values to reasonable ranges.
- **Financing Calculator**: Interactive comparison of financing options (cash purchase, loan, lease, PPA) with adjustable parameters like loan term, interest rate, and down payment. Features realistic cash flow timing that shows when incentives actually return to the client:
  - **Cash Purchase**: Shows upfront equity needed (Gross CAPEX - HQ Solar rebate - 50% HQ Battery), with Year 1 returns (remaining HQ battery + CCA tax shield) and Year 2 returns (Federal ITC 30%)
  - **Loan Option**: Shows down payment, monthly payments over term, and incentive timeline with net cost calculation
  - **Timeline Breakdown**: Visual cash flow timeline for cash and loan options showing exactly when each incentive returns

### Role-Based Access Control (RBAC)

The platform supports three user roles with distinct access levels:

- **Admin**: Full access to all features plus user management (create/delete client and analyst accounts)
- **Analyst**: Staff access to all analysis, design, and data management features, but no user management
- **Client**: Read-only access to their own sites and analysis results via the client portal

Key security features:
- JWT-based authentication with role stored in token
- Server-side authorization checks on all protected routes
- Client users are linked to a specific clientId and can only access their own data
- Staff-only routes (file upload, analysis runs, design creation) return 403 for clients
- Admin-only routes (user management) require explicit admin role check

### Client Portal

The client portal (`/app/portal`) provides customers with secure, read-only access to their solar analysis reports:

- **Client Dashboard**: Shows all sites belonging to the client with analysis status badges
- **Site Detail View (Read-only)**: Displays analysis results, charts, KPIs, and PDF download button
- **No editing capabilities**: File upload, analysis parameters, and design creation are hidden for clients

This replaces manual PDF report distribution with self-service access, enabling clients to view their analyses at any time.

### Public Landing Page

The public landing page (`/`) serves as the primary lead generation tool with conservative, evergreen messaging:

**Marketing Philosophy:**
- Conservative approach: Let analysis results exceed expectations rather than overpromising
- Evergreen messaging: No dated opportunity windows; uses "Incentives can change at any time"
- EPC positioning: Clear "Turnkey Solar + Storage for C&I buildings" positioning
- Methodology page: Internal/auditing use only - removed from public navigation

**Key Sections:**
1. **Hero Section**: EPC positioning with evergreen urgency badge, service-focused stats (Free analysis, 48h response, $0 no obligation, Turnkey EPC)
2. **Why Now Section**: Four accurate HQ incentive cards (Programme HQ 1,000 kW, Rabais HQ 40% up to $1,000/kW, Federal 30% ITC, Net metering)
3. **Process Section**: 3-step journey (Send data → Receive analysis → Take action) with time estimates
4. **Benefits Section**: Service descriptions (Personalized analysis, Financial projections, Detailed design, Turnkey installation)
5. **Trust Section**: Hydro-Québec partner card only
6. **Contact Form**: Lead capture with company, contact, email, phone, city, monthly bill, building type

**Design Features:**
- Framer Motion animations for scroll-triggered effects
- Responsive grid layouts for all sections
- Gradient backgrounds and decorative elements
- Trust badges and partner logos
- Bilingual content (FR-CA/EN-CA)

**Visual Assets:**
- **Roof Measurement Overlay**: Generated image showing commercial roof with virtual dimensions and solar grid overlay
- **Installation Team Photo**: Professional stock image with gradient overlay for turnkey messaging
- **Analysis Screenshots Carousel**: Language-specific slides that auto-rotate every 4 seconds
  - English (4 slides): Consumption Profile, Recommended System, Financial Breakdown, Optimization Analysis
  - French (3 slides): Profil de consommation, Analyse d'optimisation, Options de financement
  - Slides use actual platform screenshots in the matching language

### Marketing Stack

**Hybrid Website Strategy:**
- **Main site on Replit**: Landing page, app dashboard, client portal
- **Campaign pages on Zoho LandingPage**: PPC, LinkedIn, referral partner campaigns
- See `docs/zoho-landing-page-content.md` for ready-to-use campaign copy

**CAPEX Defaults (as of Dec 2024):**
- Solar: $2.25/Wp (turnkey, including installation)
- Battery energy: $550/kWh (cells and modules)
- Battery power: $800/kW (inverter and controller)

## External Dependencies

### Third-Party Services

-   **Google Solar API**: Integration for roof area estimation, solar production potential, and imagery via Building Insights and Data Layers APIs. It also provides automatic yield calibration for simulations.
-   **Zoho CRM**: OAuth2 authenticated integration for lead synchronization from the public website and deal creation/updates from system designs.
-   **Neon Database**: Serverless PostgreSQL solution used for the database.

### Google Solar API Limitations & Best Practices

The Google Solar API is primarily designed for **residential rooftops** and has known limitations for large commercial/industrial (C&I) buildings:

**API Limitations:**
- **System size caps**: Typically returns configurations up to ~25-50 kW, even if a commercial roof could support 500+ kW
- **Flat roof accuracy**: Lower segmentation accuracy (~56% IOU) on large flat commercial roofs
- **Multi-section roofs**: Large industrial buildings with multiple elevations can confuse the segmentation model

**Cross-Validation Approach:**
The platform uses a **yield-based comparison** (kWh/kWp) rather than total production when validating against Google Solar:
- Compares specific yields to detect modeling discrepancies
- Shows "Yield Calibration" badge when system sizes differ by >50%
- Provides calibration guidance: validated (<10% diff), acceptable (10-20%), review recommended (>20%)

**Best Practices for C&I Buildings:**
1. **Use Google for yield calibration**: The specific yield (kWh/kWp) from Google is more reliable than total production for large buildings
2. **Manual roof area entry**: For buildings >5,000 sq ft, manually enter actual roof area from drawings or measurements
3. **Apply utilization factor**: Default 70% utilization accounts for HVAC, skylights, access paths, structural limitations

**Future Integration Options:**
- **QGIS + LiDAR**: UMEP/SEBE plugins for detailed shadow analysis (manual workflow, high accuracy)
- **Nearmap API**: Commercial aerial imagery with AI-powered roof measurement (~$500+/month)
- **Satellite Reports**: Per-project roof measurement reports ($20-40 each, 95%+ accuracy)

### Key npm Packages

-   **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcrypt`, `jsonwebtoken`, `multer`, `zod`.
-   **Frontend**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `@radix-ui/*`, `tailwindcss`, `clsx`, `tailwind-merge`.
-   **Build Tools**: `vite`, `esbuild`, `typescript`.