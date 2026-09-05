# LightJob

LightJob is a task and referral marketplace where advertisers publish paid work, workers submit proof, and approved revenue is distributed transparently.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/lightjob run dev` — run the LightJob web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Clerk secrets: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, and `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind CSS + TanStack Query
- Authentication: Replit-managed Clerk

## Where things live

- `artifacts/lightjob/src/App.tsx` — LightJob routes, dashboards, marketplace, wallet, referral, submission, and admin UI
- `artifacts/lightjob/src/index.css` — LightJob visual system and responsive styling
- `artifacts/api-server/src/routes/` — account, task, wallet, and admin API routes
- `artifacts/api-server/src/lib/auth.ts` — Clerk user provisioning and role guards
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/` — LightJob PostgreSQL/Drizzle schema

## Architecture decisions

- The first non-seed account is bootstrapped as `super_admin`; later accounts default to workers.
- Admin visibility is role-protected in both the UI and API; only explicitly granted admin roles can access the control room.
- Approved task revenue is distributed transactionally as 40% to the task owner, 40% to the worker, and 20% to the worker's direct referrer.
- Clerk is the identity provider, while the local users table stores the application profile, role, referral relationship, balance, and ledger state.
- API contracts are OpenAPI-first; generated React Query hooks and Zod schemas must be regenerated after spec changes.

## Product

- Public landing page with clear payout policy and trust messaging
- Clerk sign-in and sign-up flows
- Worker dashboard, marketplace search/filtering, task details, proof submission, wallet, referrals, and withdrawal requests
- Advertiser task publishing and submission review
- Admin overview with marketplace metrics, withdrawal review, user listing, and role management
- Demo advertiser and marketplace tasks seeded for preview and development

## User preferences

No project-specific user preferences recorded.

## Gotchas

- LightJob's Vite config requires `PORT` and `BASE_PATH`; the managed artifact workflow supplies them automatically. For manual builds use `PORT=25837 BASE_PATH=/ pnpm --filter @workspace/lightjob run build`.
- Signed-out account queries must remain disabled until Clerk has loaded and confirmed a signed-in session; otherwise a normal `/api/me` 401 can leave the public page looking like it is still loading.
- Keep numeric PostgreSQL seed values free of thousands separators (for example, `1200.00`, not `1,200.00`).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
