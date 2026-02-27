# Dead Code Audit — kWh Optimizer 2000
> Generated: 27 Feb 2026 | Source: GitHub API file size analysis + audit report

## Summary
81 frontend pages, 28 backend routes. ~38% pages and ~53% routes are stubs or placeholders.
This document lists candidates for removal or consolidation.

## Priority: SAFE TO REMOVE (stubs, no business logic)

### Backend Routes (server/routes/)
| File | Size | Reason |
|------|------|--------|
| benchmarks.ts | 1.6KB | Stub, no real benchmarking logic |
| partnerships.ts | 2.4KB | Stub, partnerships not in MVP |
| racking-comparison.ts | 2.7KB | Stub, can be merged into kb-racking.ts |
| news.ts | 3.7KB | Stub, "nouvelles" page is 257 bytes |

### Frontend Pages (client/src/pages/)
| File | Size | Reason |
|------|------|--------|
| nouvelles.tsx | 257B | Empty/placeholder page |
| call-script.tsx | 1.5KB | Not in active sales flow |
| roof-capture.tsx | 3.2KB | Prototype, not connected to pipeline |
| conversion-dashboard.tsx | 6.9KB | Duplicated by pipeline.tsx analytics |

## Priority: REVIEW BEFORE REMOVING (may have partial logic)

### Backend Routes
| File | Size | Reason |
|------|------|--------|
| market-intelligence.ts | 6.2KB | Large frontend (143KB) but route may be stub |
| work-queue.ts | 7.2KB | Check if used by construction flow |
| gamification.ts | 8.6KB | EOS gamification — check if active |

### Frontend Pages
| File | Size | Reason |
|------|------|--------|
| designs.tsx | 5.1KB | May be replaced by design-agreement flow |
| analyses.tsx | 6.1KB | Check if redundant with site analysis |
| site-detail/ | dir | Empty directory |

## DO NOT REMOVE (production-critical)

### Backend Routes (sorted by importance)
- leads.ts (80KB) — Core lead pipeline
- sites.ts (75KB) — Site management
- siteAnalysisHelpers.ts (33KB) — Analysis engine helpers
- portfolios.ts (25KB) — Portfolio management
- admin.ts (25KB) — Admin panel
- designs.ts (20KB) — Design agreement flow
- construction.ts (21KB) — Construction Gantt
- site-visits.ts (22KB) — Site visit scheduling
- clients.ts (20KB) — Client management
- kb-racking.ts (9.5KB) — KB Racking calculator
- eos.ts (8.9KB) — EOS module
- auth.ts (6KB) — Authentication
- hq-data.ts (6.7KB) — HQ rate data

## Action Plan
1. Run \`grep -r "import.*from.*benchmarks" client/ server/\` for each candidate
2. If zero imports found → safe to delete
3. Remove from router registration (server/index.ts or routes/index.ts)
4. Remove corresponding frontend routes (client/src/App.tsx or router config)
5. Run \`npm test\` after each removal to verify no breakage

## Estimated Impact
- ~4 route files deletable immediately (benchmarks, partnerships, racking-comparison, news)
- ~4 page files deletable immediately (nouvelles, call-script, roof-capture, conversion-dashboard)
- Reduces codebase by ~20 files, ~15KB of dead code
- Cleaner import tree, faster builds, less confusion
