# Deployment Guide — kWh Optimizer 2000

## Prerequisites

- Node.js 18+
- PostgreSQL (Neon serverless recommended)
- Stripe account (for Design Agreement payments)
- Resend account (for transactional emails)
- Google Cloud project (for Gemini Vision + GCS)

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/kWhQuebec/kwh-optimizer2000.git
cd kwh-optimizer2000

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your actual values (see below)

# 4. Run database migrations
npm run db:push

# 5. Start development server
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://user:pass@host.neon.tech/db` |
| `JWT_SECRET` | Secret for JWT token signing (min 32 chars) | `your-random-secret-here` |
| `GOOGLE_API_KEY` | Google Cloud API key (Gemini Vision) | `AIza...` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_...` |
| `RESEND_API_KEY` | Resend email API key | `re_...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `EMAIL_FROM` | Sender address | `noreply@kwh.quebec` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | — |
| `SMTP_HOST/PORT/USER/PASS` | SMTP fallback email | — |
| `SENTRY_DSN` | Error monitoring | — |

## Production Deployment (Replit)

The app is currently hosted on Replit. To deploy:

1. Push changes to `main` branch on GitHub
2. Replit auto-syncs from GitHub (or manually pull)
3. Environment variables are set in Replit Secrets
4. The app runs via `npm run start`

### Replit-specific notes

- Secrets are managed in the Replit UI (not .env files)
- The app auto-restarts on crash
- Domain: `kwhoptimizer.replit.app`

## Infrastructure Overview

```
GitHub (source of truth)
    |
    +---> Replit (production app)
    |         Port 5000 (Express + React)
    |         Neon PostgreSQL (serverless)
    |
    +---> GCP VM "ma-guardian" (automation)
              n8n (port 5678) — workflow automation
              Dashboard API (port 3000) — task management
              QA Agent Loop — auto-test every 15 min
              Improvement Agent — code analysis hourly
```

## Database

- **Provider**: Neon serverless PostgreSQL
- **ORM**: Drizzle
- **Schema**: ~40 tables (see `shared/schema.ts`)
- **Migrations**: `npm run db:push` (Drizzle Kit)

## Stripe Integration

- **Product**: Design Agreement ($2,500 CAD upfront)
- **Model**: One-time payment, creditable on final EPC contract
- **Config**: `server/config/designAgreement.ts`
- **Webhook**: `POST /api/stripe/webhook`

## Email

- **Primary**: Resend API (`server/services/emailPortable.ts`)
- **Fallback**: SMTP (if configured)
- **Templates**: Proposal PDF, Design Agreement confirmation

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npx vitest run tests/cashflowEngine.test.ts

# Run with coverage
npx vitest run --coverage
```

**Current coverage**: 302 tests (engines: cashflow, qualification, analysis)

## CI/CD

- **GitHub Actions**: `.github/workflows/ci.yml`
  - Runs on push to `main` and PRs
  - Steps: install → lint → test → type-check
- **n8n QA Agent**: Runs vitest every 15 min on the VM
- **Husky**: Pre-commit hooks (vitest + ESLint)

## Monitoring

- **n8n Dashboard**: https://n8n.kwh.quebec
- **Task API**: http://35.231.189.171:3000/api/stats
- **Asana**: Project tracking synced bidirectionally
