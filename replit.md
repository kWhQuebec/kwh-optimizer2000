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

### Key Features
-   **Data Processing & Analysis**: Processes Hydro-Québec consumption data, performs solar production simulations, battery peak-shaving, calculates incentives, and generates 25-year cashflows.
-   **System Design Module**: Enables detailed equipment specifications and Bill of Materials creation.
-   **Multi-Scenario Analysis**: Offers a Scenario Comparison Dashboard and a Financing Calculator.
-   **Role-Based Access Control (RBAC)**: Supports Admin, Analyst, and Client roles.
-   **User Onboarding**: Auto-generated temporary passwords (12-char, cryptographically secure via crypto.randomBytes) sent in welcome emails. Users are forced to change password on first login for security.
-   **Client Portal**: Provides secure, read-only access to analysis reports.
-   **PDF Report Generation**: Creates professional PDF analysis reports.
-   **Portfolio Management**: Allows multi-building project management with volume pricing.
-   **Hydro-Québec Integrations**: Incorporates HQ incentive policies, net metering rules, and a procuration system for data access authorization.
-   **AI-Powered HQ Bill Parsing**: Uses Gemini Vision to extract account number, client name, address, annual consumption, and tariff code from uploaded HQ bills (PDF or images). Endpoint: `POST /api/parse-hq-bill`.
-   **2-Step Detailed Analysis Form**: Step 1 uploads HQ bill for AI parsing, Step 2 pre-fills form with extracted data for user verification and completion.
-   **Consumption-Based Quick Analysis**: Calculates solar system sizing from annual kWh consumption (via bill upload or manual entry) with 3 offset scenarios (70%, 85%, 100%). No Google Solar API dependency for sizing.
-   **HQ Procuration Email**: Staff can send bilingual authorization request emails directly to clients from the CRM.
-   **Advanced Analysis**: Includes Monte Carlo Probabilistic ROI simulations and a 15-Minute Peak Shaving Calculator.
-   **Market Intelligence Pricing**: Dynamic, component-based pricing with tiered options and an admin UI for management. Includes supplier management, price history tracking with analytics (3/6/12 month trends, supplier comparison), and "Promote to Catalog" functionality linking quotes to operational pricing. Freshness indicators (Fresh/Stale/Outdated) show when catalog prices need updating.
    -   **Pricing Architecture**: Component Catalog stores COST prices only (from suppliers). Margins are applied at quote time in the Quotation/Estimation tool, allowing per-project or per-item markup flexibility.
-   **Solar Mockup Visualization**: Generates visual mockups of solar panel installations using Google Solar API data, showing panel positions and constraint areas.
-   **Manual Roof Drawing Tool**: A mandatory interactive tool for technicians to trace roof areas before analysis, with validation tracking. Includes AI-powered constraint suggestion using Gemini Vision to automatically detect HVAC units, skylights, vents, and other rooftop obstacles from satellite imagery. Uses WebMercator projection for accurate pixel-to-geographic coordinate conversion.
-   **KB Racking Integration**: Utilizes validated KB Racking specifications for direct sizing calculations, automated BOM generation, and tiered pricing.

## External Dependencies

### Third-Party Services
-   **Google Solar API**: Used for roof area estimation, solar production potential, and imagery.
-   **Neon Database**: Serverless PostgreSQL solution.

### Key npm Packages
-   **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcrypt`, `jsonwebtoken`, `multer`, `zod`.
-   **Frontend**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `@radix-ui/*`, `tailwindcss`, `clsx`, `tailwind-merge`.
-   **Build Tools**: `vite`, `esbuild`, `typescript`.