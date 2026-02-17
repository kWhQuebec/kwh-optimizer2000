---
name: kwh-seo-deployment
description: SEO and deployment rules for kWh Québec. Use when adding, removing, or modifying public pages, routes, or any content that affects search engine indexing and site structure.
---

# kWh Québec — SEO & Deployment Rules

## Before Modifying Public Pages

- Verify canonical URLs use `https://www.kwh.quebec/...`
- Ensure `og:url`, `og:title`, `og:description` meta tags are set
- Include hreflang alternates: `fr-CA` and `en-CA`

## When Adding New Public Pages

- Add the page to the sitemap in `server/routes.ts` (staticPages array in the `/sitemap.xml` handler)
- Set appropriate `priority` and `changefreq` values
- Add proper SEOHead component or manual meta tags

## When Removing or Renaming URLs

- Add a server-side 301 redirect in `server/routes.ts` (oldRedirects object)
- Add a client-side redirect in `client/src/App.tsx` for SPA navigation
- Never delete a public URL without a redirect

## Current Redirects (old site → new app)

- `/apropos` → `/`
- `/contact` → `/#analyse`
- `/services` → `/`
- `/comment-ca-marche` → `/`

## Sitemap & Robots

- `GET /sitemap.xml` — dynamic, includes static pages + published blog articles
- `GET /robots.txt` — allows all crawling, references sitemap
- Both are defined in `server/routes.ts`
