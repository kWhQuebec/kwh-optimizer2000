# kWh Québec Platform

## Overview

kWh Québec is a B2B solar + storage analysis and design platform for commercial, industrial, and institutional buildings in Québec. The application serves three primary functions:

1. **Lead Generation**: Public-facing website with lead capture forms that integrate with Zoho CRM
2. **Energy Analysis**: Import and analyze consumption data (CSV files with hourly kWh and 15-min kW readings) to generate solar + storage potential reports for individual buildings or portfolios
3. **System Design**: Generate complete PV + Battery system designs with detailed Bill of Materials (BOM), pricing calculations, and Zoho CRM synchronization

The platform is designed for internal use by kWh Québec's team to streamline their solar assessment and proposal workflow.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Monorepo Structure

The application uses a unified TypeScript codebase with client-side React and server-side Express within a single Replit project:

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL via Drizzle ORM (configured for Neon serverless)
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Routing**: Wouter (lightweight client-side routing)

**Design Rationale**: This monorepo approach simplifies deployment on Replit while maintaining clear separation between frontend and backend code. The shared TypeScript types between client and server ensure type safety across the stack.

### Frontend Architecture

**Component Framework**: React with functional components and hooks, organized into:
- `/client/src/pages/*` - Route-level page components
- `/client/src/components/*` - Shared components and shadcn/ui elements
- `/client/src/lib/*` - Utility functions, API client, authentication context, and i18n

**State Management**: 
- **TanStack Query** for server state management (data fetching, caching, mutations)
- **React Context** for authentication state and internationalization
- **React Hook Form** with Zod validation for form state

**UI Design System**: 
- Professional, data-focused design inspired by Linear and Stripe
- Bilingual support (French/English) with i18n context provider
- Custom Tailwind configuration with design tokens for consistent spacing, typography, and colors
- Inter font for UI text, JetBrains Mono for technical/numeric values

**Rationale**: TanStack Query eliminates boilerplate for API calls and provides automatic caching/refetching. The shadcn/ui component library offers accessible, customizable components that match the professional design requirements. React Hook Form with Zod provides type-safe form validation.

### Backend Architecture

**API Layer**: RESTful API with Express routes in `/server/routes.ts`

**Authentication**: JWT-based authentication with bcrypt password hashing
- Tokens stored in localStorage on client
- Auth middleware validates Bearer tokens on protected routes
- Simple admin/team user model (not multi-tenant SaaS)
- Default admin credentials: info@kwh.quebec / KiloWattHeureQc1$

**Data Access**: In-memory storage implementation (`/server/storage.ts`) with interface designed for future database integration
- All database operations abstracted behind `IStorage` interface
- Currently using mock in-memory data structures
- Ready for Drizzle ORM + PostgreSQL migration

**File Handling**: Multer middleware for CSV file uploads to `/uploads` directory

**Rationale**: The storage interface abstraction allows the application to function with mock data while the database schema is being developed, enabling parallel frontend/backend work. JWT authentication is lightweight and sufficient for small internal teams.

### Database Schema (Drizzle ORM)

**Core Entities**:
- **users**: Authentication and role-based access
- **leads**: Web form submissions from public site
- **clients**: Customer accounts
- **sites**: Physical locations/buildings per client
- **meterFiles**: Uploaded consumption CSV files
- **meterReadings**: Parsed time-series consumption data
- **simulationRuns**: Analysis scenarios with PV/battery sizing
- **designs**: Complete system designs with component selections
- **bomItems**: Bill of materials line items
- **componentCatalog**: Product library (modules, inverters, batteries, BOS)

**Schema Design**: PostgreSQL with UUID primary keys, timestamp tracking, and foreign key relationships. The schema supports portfolio analysis (multiple sites per client) and scenario comparison (multiple simulation runs per site).

**Rationale**: Drizzle provides type-safe database queries with excellent TypeScript integration. The schema separates raw meter data from analysis results, allowing re-analysis without re-uploading files.

### Data Processing & Analysis

**CSV Parsing**: Server-side parsing of Hydro-Québec consumption data files
- Supports up to 200 files simultaneously (for 24+ months of data)
- Auto-detects file type: 15-minute power (kW) vs hourly energy (kWh)
- Handles Latin-1 encoding, semicolon delimiters, French decimal format
- Accent-insensitive header detection for reliable parsing

**Advanced Analysis Engine** (server/routes.ts - `runPotentialAnalysis`):
- 8760-hour solar production simulation using Gaussian curve + seasonal adjustment
- Battery peak-shaving algorithm with SOC tracking
- Quebec Hydro-Québec incentives ($1000/kW solar + $300/kW battery, 40% cap)
- Federal ITC 30% calculation on remaining CAPEX
- Tax shield (DPA/CCA) calculation
- 25-year cashflow generation with O&M escalation and inflation
- NPV (10/20/25 year), IRR, LCOE, simple payback calculations
- Battery replacement at year 10 (60% of original cost)
- Robust IRR calculation with Newton-Raphson + bisection fallback

**Configurable Analysis Parameters** (shared/schema.ts - `AnalysisAssumptions`):
- Tariffs: Energy ($/kWh), Power ($/kW/month)
- Financial: Inflation, WACC/discount rate, corporate tax rate
- CAPEX: Solar cost ($/W), battery capacity ($/kWh), battery power ($/kW)
- O&M: Solar/battery percentages, escalation rate
- Roof constraints: Area, utilization ratio

**Report Generation**: PDF reports with bilingual support (French/English)

**Rationale**: Server-side processing ensures consistent results and protects proprietary analysis algorithms.

### UI Visualization

**Charts**: Recharts library for consumption profiles, production simulations, and financial projections
**Data Tables**: shadcn/ui table components for BOM listings and detailed metrics

**Rationale**: Recharts integrates well with React and provides responsive, accessible charts suitable for data-heavy B2B interfaces.

## External Dependencies

### Third-Party Services

**Zoho CRM Integration** (`server/zohoClient.ts`):
- OAuth2 authentication with automatic token refresh (cached tokens with expiry handling)
- Lead sync from public website form submissions (automatic on form submit)
- Deal creation/update from system designs (via "Sync to Zoho" button)
- Mock mode: Falls back gracefully when credentials not configured (returns MOCK_* IDs)
- Environment variables for credentials:
  - `ZOHO_CLIENT_ID`: OAuth client ID from Zoho API Console
  - `ZOHO_CLIENT_SECRET`: OAuth client secret
  - `ZOHO_REFRESH_TOKEN`: Long-lived refresh token for offline access
  - `ZOHO_BASE_URL`: API base URL (default: https://www.zohoapis.com)
- API status endpoint: `GET /api/zoho/status` - Check if integration is configured

**Neon Database** (PostgreSQL):
- Serverless PostgreSQL via `@neondatabase/serverless`
- Connection string in `DATABASE_URL` environment variable
- Drizzle ORM for migrations and queries

### Key npm Packages

**Backend**:
- `express` - Web framework
- `drizzle-orm` + `drizzle-kit` - Database ORM and migrations
- `@neondatabase/serverless` - PostgreSQL client
- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT authentication
- `multer` - File upload handling
- `zod` - Schema validation

**Frontend**:
- `react` + `react-dom` - UI framework
- `wouter` - Client-side routing
- `@tanstack/react-query` - Server state management
- `react-hook-form` + `@hookform/resolvers` - Form handling
- `recharts` - Data visualization
- `@radix-ui/*` - Accessible UI primitives (via shadcn/ui)
- `tailwindcss` - Utility-first CSS
- `clsx` + `tailwind-merge` - Class name utilities

**Build Tools**:
- `vite` - Frontend build tool and dev server
- `esbuild` - Backend bundler
- `typescript` - Type checking across the stack

**Rationale**: These dependencies provide production-ready solutions for common requirements (authentication, forms, data fetching) while maintaining bundle size efficiency and developer experience.