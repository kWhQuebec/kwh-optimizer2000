# kWh Québec Platform

## Overview
kWh Québec is a B2B solar + storage analysis and design platform tailored for commercial, industrial, and institutional buildings in Québec. It automates solar assessment, lead management, and proposal generation by performing detailed energy analysis from consumption data and comprehensive PV + Battery system design. The platform aims to enhance efficiency in solar deployment, accelerate project development in the C&I sector, and provide tools for Bill of Materials generation, pricing, and CRM synchronization. It focuses on improving proposal quality with professional PDF reports, integrating Hydro-Québec specificities, and leveraging AI for bill parsing to capitalize on Quebec's renewable energy market potential.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application is a full-stack monorepo built with a unified TypeScript codebase, separating a React-based client from an Express-based server. It utilizes Node.js, Express, and TypeScript for the backend, and React, TypeScript, and Vite for the frontend. Data persistence is handled by PostgreSQL via Drizzle ORM, configured for Neon serverless. Styling is managed with Tailwind CSS and shadcn/ui, and Wouter is used for routing.

The frontend employs React functional components with TanStack Query for server state management, React Context for authentication and internationalization, and React Hook Form with Zod for form validation. The backend offers a RESTful API with JWT authentication and integrates a robust data processing engine for solar simulation, battery peak-shaving, financial calculations (NPV, IRR, LCOE), and sensitivity analysis based on Hydro-Québec tariffs. Key features include an AI-powered Hydro-Québec bill parsing system, a 2-step detailed analysis form, and a Consumption-Based Quick Analysis, alongside a comprehensive Financing Calculator and multi-scenario acquisition cashflow charts.

The analysis engine is PVSyst-calibrated, incorporating specific derate factors, ILR, and bifacial parameters. The platform manages roof capacity constraints, prioritizes site data from the RoofVisualization panel layout, ensures Law 25 Privacy Compliance for Quebec, and includes CRM workflow automation, market intelligence pricing, a Manual Roof Drawing Tool with AI-powered constraint suggestion, and a Benchmark Calibration Tool.

The application features a 9-step project workflow on the site detail page, mirroring the solar project lifecycle from quick analysis to O&M. A Hydro-Québec background job system handles asynchronous data fetching and incremental CSV imports, with progress updates and global toast notifications. Portfolio performance is optimized by excluding heavy JSONB columns and large text fields from initial queries.

A Master Agreement PDF generator creates comprehensive Design-Build (CCDC 14) documents with dynamic entity names, including detailed sections on commercial terms, scope of work, schedule of values, and supplementary conditions. Building type data is centralized and aligned with Quebec's CUBF standard, including CUBF code ranges, bilingual labels, energy intensity, and operating schedules. Google Places Autocomplete is integrated into site and client creation forms for address validation and auto-filling, restricted to Canadian addresses. The backend features a centralized error handling system with custom `AppError` classes.

The platform follows WCAG accessibility guidelines: all decorative SVG icons use `aria-hidden="true"`, public pages use semantic landmarks (`<main>`, labeled `<nav>`), the viewport meta allows user scaling, the landing page step selector uses proper ARIA tab roles, and the toast viewport conditionally renders to avoid empty list announcements. A `scroll-padding-top: 4rem` on `<html>` prevents the fixed header from covering focused elements.

The public-facing site includes an À propos page (`/a-propos`) with company mission/vision, founding story, team members with LinkedIn profiles, values, certifications/partnerships, and CTAs. The old `/apropos` URL (from the Zoho site) redirects to `/a-propos`. Navigation includes: `Services ▾ (Solaire | Stockage) | Portfolio | Ressources | À propos | 514.427.8871 | EN | Connexion`.

UI/UX ensures a standardized color palette using brand and semantic colors. Typography uses a dual-font system: Plus Jakarta Sans (700/800) for h1-h3 headings on public pages via `.public-page` CSS class, and Montserrat for body text. Public pages feature photo-based hero sections with dark gradient overlays, real images, and platform screenshots for visual enrichment. Section spacing follows `py-20 md:py-24` for standard sections and `py-24 sm:py-32` for hero sections. Each public page has a page-specific Open Graph image for social sharing. A reusable `ScrollReveal` component (`client/src/components/scroll-reveal.tsx`) wraps Framer Motion scroll animations with configurable direction, delay, and duration. The efficiency frontier chart is integrated across all presentation outputs, displaying net investment versus 25-year NPV for various configurations and highlighting the optimal point. The platform incorporates Hydro-Québec's "Solutions efficaces" program guidelines across all content and tools. Equipment on public pages uses a Tier-based labeling system, while internal proposals use specific manufacturer models. The O&M Performance page (`/app/om-performance`) includes both a site list view and a per-site detail dashboard, accessible from the sidebar under the "Opération" section.

Company values are centralized in `shared/brandContent.ts` and used across all presentation tools (landing page, À propos, PPTX generators, PDF reports, analysis results). The 4 values are: Simplicité, Fiabilité, Pérennité, Fierté. All public page CTA buttons point to `/#analyse` (the analysis upload form section on the landing page).

## External Dependencies

### Third-Party Services
-   **Google Solar API**: For solar yield estimation.
-   **Neon Database**: Serverless PostgreSQL solution.
-   **Gemini Vision**: For AI-powered Hydro-Québec bill parsing and AI-powered constraint suggestion in the roof drawing tool.

### Key npm Packages
-   **Backend**: `express`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `bcrypt`, `jsonwebtoken`, `multer`, `zod`.
-   **Frontend**: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `@radix-ui/*`, `tailwindcss`, `clsx`, `tailwind-merge`.
-   **Build Tools**: `vite`, `esbuild`, `typescript`.