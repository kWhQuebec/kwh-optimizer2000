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

## External Dependencies

### Third-Party Services

-   **Google Solar API**: Used for roof area estimation, solar production potential, and imagery via Building Insights and Data Layers APIs, and for yield calibration in simulations.
-   **Zoho CRM**: OAuth2 authenticated integration for lead synchronization and deal creation/updates.
-   **Neon Database**: Serverless PostgreSQL solution.

### Google Solar API Limitations & Best Practices

The Google Solar API, primarily designed for residential rooftops, has limitations for large commercial/industrial buildings (e.g., system size caps, flat roof accuracy). The platform addresses this with a yield-based comparison for validation, manual roof area entry for large buildings, and applying a utilization factor.

### Key npm Packages

-   **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcrypt`, `jsonwebtoken`, `multer`, `zod`.
-   **Frontend**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `@radix-ui/*`, `tailwindcss`, `clsx`, `tailwind-merge`.
-   **Build Tools**: `vite`, `esbuild`, `typescript`.