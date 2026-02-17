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

The analysis engine is PVSyst-calibrated (Feb 2026, Rematek reports) with a ~5.4% net system derate (wire 3%, LID 1%, mismatch 2.15%, quality gain -0.75%), ILR 1.45, and bifacial parameters (0.80 factor, 0.60 albedo). System loss parameters are defined in `shared/schema.ts` (defaultAnalysisAssumptions) and applied in `runHourlySimulation()` after temperature correction, before inverter clipping.

The platform ensures Law 25 Privacy Compliance for Quebec. CRM workflow automation integrates website leads into a sales pipeline, supported by inline entity creation and email lead nurturing sequences. Advanced analysis tools include Monte Carlo simulations and a 15-Minute Peak Shaving Calculator. Market Intelligence Pricing offers dynamic, component-based pricing with an admin UI for management, tracking supplier prices, and promoting items to a catalog. A mandatory Manual Roof Drawing Tool, coupled with AI-powered constraint suggestion, provides accurate usable roof area calculations, with KB Racking integration for BOM generation. A Benchmark Calibration Tool allows analysts to compare internal estimates against professional simulation tools. Optional snow loss profiles are configurable.

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