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

## Schema & Validation

- Data models in `shared/schema.ts`
- Insert schemas via `createInsertSchema` from `drizzle-zod`
- Validate request bodies with Zod before storage operations
