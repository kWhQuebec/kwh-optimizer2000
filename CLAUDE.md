# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Git Sync Protocol

**This repo is actively edited by multiple Claude instances (Claude Code on Replit + Cowork).**
To avoid conflicts:

1. **ALWAYS `git pull --rebase origin main` BEFORE starting any work** — no exceptions
2. **ALWAYS `git pull --rebase origin main` BEFORE pushing** — to catch any changes pushed while you were working
3. **Commit frequently** — small, focused commits reduce conflict surface
4. If you get a merge conflict, resolve it cleanly and continue the rebase
5. Never force push to main

## Project Overview

kWh Québec is a B2B solar + storage analysis and design platform for commercial/industrial/institutional buildings in Québec. Full-stack TypeScript monorepo with React frontend and Express backend.

## Commands

```bash
npm run dev        # Dev server on port 5000 (Vite HMR + Express)
npm run build      # Production build (client + server via script/build.ts)
npm start          # Production server (dist/index.cjs)
npm run check      # TypeScript type checking (tsc)
npm run db:push    # Apply Drizzle schema migrations to Neon DB
```

No test runner or linter is configured.

## Architecture

### Monorepo Layout

- `client/` — React 18 frontend (Vite, Wouter routing, TanStack Query, shadcn/ui + Tailwind)
- `server/` — Express backend (JWT auth, Drizzle ORM, analysis engines)
- `shared/` — Shared types, Drizzle schema (`schema.ts`), qualification engine, financial engine

### Data Layer

- **Database**: PostgreSQL on Neon serverless (`@neondatabase/serverless`)
- **ORM**: Drizzle with schema in `shared/schema.ts` (~40 tables)
- **Storage abstraction**: `server/storage.ts` implements `IStorage` interface for all CRUD
- **Soft-delete pattern**: `isArchived` boolean + `archivedAt` timestamp fields

### Frontend Architecture

Entry: `client/src/main.tsx` → `App.tsx` with provider stack (QueryClient → I18n → Auth → Tooltip).

Routing uses **Wouter** (not React Router). Protected routes wrap with `ProtectedRoute` component inside `AppLayout` (sidebar + header). 46 page components with lazy loading.

- State: TanStack Query for server state, React Context for auth/i18n
- Forms: React Hook Form + Zod validation
- UI: shadcn/ui components (Radix primitives) + Tailwind utility classes
- i18n: `client/src/lib/i18n.tsx` has 3000+ translations (fr/en), flat key structure

### Backend Architecture

Entry: `server/index.ts` sets up Express with JSON (15MB limit for base64), Vite dev middleware, WebSocket support.

Routes registered centrally in `server/routes.ts`, individual routers in `server/routes/`. Reference implementation for error handling: `server/routes/clients.ts`.

**Error handling**: `server/middleware/errorHandler.ts` with AppError classes (NotFoundError, BadRequestError, etc.) and `asyncHandler` wrapper. Routes throw errors, never manual `res.status().json()`.

Auth: JWT Bearer tokens, roles = admin | analyst | client. `AuthRequest` extends Express Request.

### Core Analysis Engines

**Solar analysis** (`server/analysis/`):
- Baseline yield: 1150 kWh/kWp (Quebec avg), effective ~1035 after corrections
- Corrections: temperature (-0.4%/°C), wire losses (2%), inverter efficiency (96%), bifacial +15%
- 11-scenario sweep (20–120% offset), outputs 3 optimized: Économique (payback), Maximum (100%), Équilibré (LCOE)
- Roof sizing from manual polygons, KB Racking formula: `(area_m² × utilization / 3.71) × 0.625 kW`
- Google Solar API used ONLY for yield estimation, never for area/sizing

**Financial engine** (`shared/finance/cashflowEngine.ts`):
- 25-year NPV/IRR with monthly peak demand tracking
- HQ incentive: $1000/kW (max 40% CAPEX, 1MW limit), Federal ITC 30%
- Financing: Cash, Loan, Lease, PPA comparison

**Lead qualification** (`shared/qualification/engine.ts`):
- 4-gate system, 100 points: Economic Potential (25), Right to Install (25), Roof Condition (25), Decision Capacity (25)
- Statuses: hot, warm, nurture, cold, disqualified, pending

### Key Integrations

- **Gemini Vision**: AI parsing of Hydro-Québec bills (`POST /api/parse-hq-bill`)
- **Google Solar API**: Yield estimation only
- **Google Cloud Storage**: File storage
- **Gmail/Outlook APIs**: Email sending
- **Stripe**: Payment for design agreements
- **PDFKit/jsPDF/pptxgenjs**: Document generation

### Path Aliases

Configured in `vite.config.ts` and `tsconfig.json`:
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

## Key Conventions

- **Bilingual**: All user-facing text uses i18n translations (FR-CA primary, EN-CA secondary). Logos auto-switch by language.
- **Brand colors**: Primary Blue #003DA6, Accent Gold #FFB005, Gray #AAAAAA
- **Typography**: Montserrat (sans), JetBrains Mono (mono)
- **Component pricing**: Catalog stores COST prices only; margins applied at quote time
- **Design agreement stages**: Sketch ($180) → Detailed ($3,500) → Final ($9,000)
- **Roof area source of truth**: Manual polygon tracing via RoofDrawingModal, never Google Solar API
- **Net metering**: Warning displayed when any scenario exceeds 1 MW limit
- **Date formats**: FR-CA (DD/MM/YYYY), EN-CA (MM/DD/YYYY)

## Environment Variables

Requires `DATABASE_URL` (Neon PostgreSQL connection string) and various API keys for Google Solar, Gemini, Stripe, Gmail/Outlook. No `.env.example` exists — check `server/index.ts` and service files for required env vars.
