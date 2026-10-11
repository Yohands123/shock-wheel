You are working in a pnpm TypeScript monorepo called "shock-wheel": a brokerage operations
exception queue with a "Shock Wheel" that randomly picks a market stress scenario (e.g. Strait
of Hormuz closure), applies it to seeded portfolios, flags margin breaches into an exception
queue, and has an explanation agent describe first- and second-order effects (including
insurance coverage angles).

## What already exists (do not rewrite unless something is broken)
- packages/shared: types, 8 scenarios (scenarios.ts), margin engine (margin.ts), seeded RNG
  (rng.ts), and 15 passing Vitest unit tests (margin.test.ts).
- apps/api: Prisma schema (Postgres), seed data (16 accounts, 21 instruments, users),
  Apollo Server 4 GraphQL API (schema.ts, resolvers.ts), idempotent exception writer,
  scheduled margin sweep job with node-cron + Postgres advisory lock, spin service,
  explanation agent (Claude API with Zod validation, deterministic template fallback when
  ANTHROPIC_API_KEY is unset), workflow state machine with optimistic locking, and
  integration tests in apps/api/test that run against real Postgres.
- docker-compose.yml (Postgres 16), .env.example.

Read packages/shared/src, apps/api/src/schema.ts, and apps/api/src/resolvers.ts first so you
know the exact GraphQL contract.

## Step 1: get the backend running and green
1. Copy .env.example to .env (root) and apps/api/.env.
2. pnpm install, then pnpm db:up, pnpm db:push, pnpm db:seed.
3. Run pnpm --filter @shock/shared test and pnpm --filter @shock/api test. Fix any failures
   in the code, not by weakening tests. Tell me what you changed.
4. Start the API with pnpm --filter @shock/api dev and confirm a spinWheel mutation works
   in Apollo Sandbox at http://localhost:4000.

## Step 2: build apps/web (React 18 + Vite + Mantine 7 + Apollo Client)
Package name @shock/web, depends on @shock/shared via workspace:*. Vite dev server on 5173.
Apollo Client points at http://localhost:4000 and sends an x-user-id header from a user
switcher in the header (users come from the `users` query; default u-maya).

Layout (desktop first, must also work at 375px wide):
- Header: product name "Shock Wheel", queue stats from `queueStats` (open, assigned,
  escalated, open deficit in USD), user switcher, and a "Run margin sweep" button
  (runMarginSweep with tick: true).
- Left column: the wheel. This is the hero and the one bold element on the page.
  - SVG wheel with 8 slices from the `scenarios` query, each filled with scenario.color and
    labelled with the scenario name (wrap text, keep it readable).
  - "Spin" button calls spinWheel. The server decides the outcome: when the response arrives,
    rotate the wheel with a CSS transform (4-6 full turns, ~4s cubic-bezier ease-out) so the
    pointer lands on the returned sliceIndex. Never pick the result client-side.
  - Optional "Replay seed" text input that passes seed to spinWheel.
  - Respect prefers-reduced-motion: skip straight to the result.
  - After landing: show scenario name, severity badge (MILD / SEVERE / TAIL), seed, breach
    count, total deficit.
- Below the wheel: the explanation panel for the latest run: headline, then three groups
  (first-order effects, second-order effects incl. insurance, ops actions) and the accounts
  at risk as clickable rows that open the account drawer. Show a small "Template" or
  "Claude" tag from explanation.source.
- Right column (wider): the exception queue as a Mantine Table.
  - Filters: status multi-select, priority multi-select, source (sweep / scenario), "this
    run only" toggle (scenarioRunId of latest run), and a debounced search box.
  - Columns: account (name + id), priority badge, status, source, deficit (right-aligned,
    tabular numbers, USD), equity, assignee, age.
  - Row click opens the account drawer.
  - Refetch the queue and stats after every mutation.
- Account drawer (Mantine Drawer, right side, ~520px):
  - Account name, owner, risk profile.
  - Before vs after margin cards from account.margin(scenarioRunId) when the exception came
    from a scenario run (equity, requirement, deficit, breached), otherwise just current.
  - Positions table: symbol, sector, qty (shorts shown clearly), price, shocked price,
    shock %, P&L coloured by sign.
  - Actions for the selected exception: Assign (select a user), Escalate (modal requiring a
    reason, min 5 chars), Resolve (modal requiring a note, min 5 chars). Disable when
    RESOLVED. Show Mantine notifications on success and show the GraphQL error message on
    failure (e.g. CONFLICT).
  - Audit trail as a Mantine Timeline (action, actor, time, payload summary).
- Empty states give direction: e.g. "No exceptions yet. Spin the wheel or run a margin sweep."

## Visual design (polish matters, this is being evaluated)
Use a custom Mantine theme, not the default look:
- Colours: background #EDF0F2, ink #172030, steel #56657A, brass accent #B8862B (primary,
  pointer, focus), breach red #B23A2E, cleared green #2F7A57. Generate Mantine 10-shade
  tuples for brass, breach, cleared.
- Type: "Bricolage Grotesque" for the product name, wheel labels, and section headings;
  "Public Sans" for UI and body. Load from Google Fonts. Use font-variant-numeric:
  tabular-nums for every money column.
- Sentence case everywhere. No all-caps eyebrow labels, no gradients, no identical
  shadowed cards for everything. Use borders and spacing for structure.
- Priority badges: CRITICAL red filled, HIGH red light, MEDIUM brass light, LOW steel light.
- Visible keyboard focus, accessible contrast, sensible loading skeletons.

## Step 3: CI
Create .github/workflows/ci.yml: on push and pull_request, ubuntu-latest, Node 22, pnpm
9 via pnpm/action-setup, Postgres 16 service container (user/password/db: shock, health
check with pg_isready), DATABASE_URL env, then pnpm install --frozen-lockfile, prisma
generate, pnpm typecheck, pnpm test, and pnpm --filter @shock/web build. Commit the
pnpm-lock.yaml.

## Step 4: README
Write README.md: one-paragraph pitch, architecture diagram (Mermaid: web -> Apollo API ->
Postgres, sweep job, explanation agent), quickstart commands, how idempotency works (unique
(accountId, dedupeKey), advisory lock, seeded replay), why the LLM only explains numbers the
engine computed, test summary, and a "next steps" list (DataLoader for N+1, real auth,
subscriptions for live queue updates). Note that prices and shock sizes are illustrative.

## Rules
- TypeScript strict everywhere; no `any` in new web code except GraphQL result typing if
  you skip codegen (codegen with @graphql-codegen is a welcome bonus).
- Do not change the GraphQL contract unless a test or the UI genuinely needs it; if you do,
  update tests.
- Run the tests and the web build before saying you're done, and give me a short summary of
  what you built and anything you couldn't finish.
