---
name: kwh-code-conventions
description: Code conventions for the kWh Québec platform. Use when writing new components, pages, or backend routes to ensure consistency with established patterns.
---

# kWh Québec — Code Conventions

## Color Palette

- Centralized in `shared/colors.ts` — always use these constants instead of hardcoded hex values
- Primary Blue: `#003DA6`
- Dark Blue: `#002B75`
- Accent Gold: `#FFB005`
- Positive: `#16A34A`, Negative: `#DC2626`, Neutral: `#6B7280`, Info: `#3B82F6`

## Typography

- Font body/titres: **Montserrat**
- Font données/chiffres: **JetBrains Mono**

## Bilingual Content

- All public-facing content must be available in French (FR) and English (EN)
- Use the `useI18n()` hook for translations
- Pattern: `language === "fr" ? "Texte français" : "English text"`
- French is the default language

## UI Components

- Always use existing Shadcn/ui components from `client/src/components/ui/`
- Follow the established patterns in neighboring files for new components
- Use `react-hook-form` with `zodResolver` for forms
- Use `@tanstack/react-query` for data fetching
- Routing: `useLocation` and `<Route>` from `wouter` (NOT react-router)
- Icons: `lucide-react`
- No `localStorage` for application state — everything goes through the API

## Schema & Validation

- Data models in `shared/schema.ts`
- Insert schemas via `createInsertSchema` from `drizzle-zod`
- Validate request bodies with Zod before storage operations

## TypeScript

- `strict: true` — no `any` except documented exceptional cases
- Interfaces for business objects, types for unions/intersections
- Export shared types from `shared/`

## Backend

- ORM: Drizzle — no raw SQL except for complex analytical queries
- Routes: Express with zod validation on inputs
- Errors: always return appropriate HTTP codes with clear messages

## Protected Files (NEVER modify without asking)

- `shared/schema.ts` — database schema (migration impact)
- `drizzle/` — migration files
- `server/routes/siteAnalysisHelpers.ts` — simulation engine (client financial impact)
- `shared/finance/cashflowEngine.ts` — financial model (client proposal impact)
- `.env` / `.env.production` — secrets

## Development Process

### Before coding
1. Read the affected files in full before proposing changes
2. Understand the complete data flow (frontend → API → backend → DB → return)
3. For changes touching the simulator or finances: verify assumptions against official sources (HQ, CRA, etc.)

### During development
- Make atomic changes — one objective per commit
- Verify TypeScript compiles (`npx tsc --noEmit`)
- Check visual regressions on affected pages
- If a bug is found during feature development: fix it immediately, don't leave it

### Verification before declaring "done"
- Code compiles without TypeScript errors
- API routes return correct data (test with curl or browser)
- UI displays data correctly on desktop AND mobile
- Edge cases handled (missing data, empty lists, network errors)
- No console.error in the browser
- Financial calculations produce coherent results (NPV, IRR, payback in realistic ranges)
