# HUB.STUDIO - Clean Rebuild

Fresh rebuild of the platform using:

- Next.js (App Router)
- Tailwind + shadcn-style primitives
- tRPC + Zod
- Prisma + Postgres
- NextAuth
- Redis + BullMQ
- TanStack Query
- Pino + Sentry + PostHog

## What was preserved

- Visual preset model from `pages.json`
- Node runtime surface under `_nodes`

The old legacy integration layer was replaced with a clean skeleton and local-first behavior.

## Quick start

1. Install dependencies:
   - `npm install`
2. Configure environment:
   - Copy `.env.example` to `.env`
3. Generate Prisma client:
   - `npm run prisma:generate`
4. Run the app:
   - `npm run dev`

## Database setup

This project uses PostgreSQL.

- Update `DATABASE_URL` in `.env`
- Run migrations:
  - `npm run prisma:migrate`

## Auth

- Credentials auth is scaffolded.
- For clean bootstrap flow, the authorize handler upserts a local user from provided email.

## Queue

- BullMQ queue is configured in `server/queue/index.ts`
- Queue is enabled only when `REDIS_URL` is set.
- Sample enqueue endpoint is available via `health.enqueue`.

## tRPC sample endpoints

- `health.ping` -> basic API health response
- `health.enqueue` -> sample queue producer
- `nodes.listCourses` -> sample node-backed dataset

## Notes

- Sentry and PostHog are env-gated and safe when unset.
- Current build can show a BullMQ bundling warning from upstream dynamic requires; functionality remains available for server runtime usage.
