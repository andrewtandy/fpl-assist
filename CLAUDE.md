# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

fpl-assist is a mobile-first dashboard for an FPL Draft league (Vue 3 + TypeScript + Pinia + Vite, on Firebase Hosting with a Cloud Function proxy). I'm adding an Azure data layer to it as a portfolio piece that shows data engineering and SQL practice end to end.

The data layer: Python Azure Functions poll the FPL Draft API and land raw JSON in Blob Storage; a batch loader moves it into Azure SQL (free offer); dbt builds staging and mart layers; a Firebase function later reads the marts through workload identity federation and a new Insights tab displays them. Infrastructure is Terraform, deployed by GitHub Actions authenticating to Azure with OIDC.

The full plan (milestones, sprints S00–S11, exit criteria, risks) lives here:
https://claude.ai/code/artifact/f492e904-d37b-4497-a22c-f45cd4ea587d
When I name a sprint (e.g. "S03"), work to that sprint's goal and tickets.

## Hard rules

These are non-negotiable. If a task seems to need breaking one, stop and tell me instead.

- **Free tiers only.** Azure SQL free offer (100,000 vCore-seconds per database per month, set to auto-pause rather than bill), Functions free grant, and free-tier Storage, Key Vault and App Insights usage. Never propose a paid SKU or a service outside this list without flagging the cost. A £5 budget alert exists as a backstop, not a plan.
- **No long-lived secrets anywhere.** No connection strings, SAS tokens, storage keys, client secrets or passwords in code, config, `.env` files committed to git, Terraform variables, or GitHub secrets/variables. Use managed identity (Function App → Blob, SQL), OIDC federated credentials (GitHub → Azure), and workload identity federation (Firebase → Azure). Azure SQL uses Entra ID authentication only.
- **Protect the vCore allowance.** The poller writes only to Blob. The database wakes for batch loads and cached serving reads, never per poll. Don't add anything that queries SQL on a tight schedule.
- **Terraform is the only way infrastructure changes.** No portal or CLI changes to resources except the documented one-off state bootstrap. If something must be created by hand, write it down in `docs/`.
- **Raw is immutable.** Raw JSON is written unmodified. All cleaning, typing and derivation happens downstream in dbt.
- **No live API calls in tests or CI.** Use recorded fixtures.

## Repo layout

Layout (introduced in S00; the Vue app, its Cloud Function and the Firebase config all live under `app/`):

```
fpl-assist/
├── app/                  # existing Vue + Firebase app
├── infra/
│   ├── modules/          # storage, sql, function_app, key_vault, monitoring
│   └── envs/{dev,prod}/
├── pipeline/
│   ├── ingest/           # timer-triggered poller
│   ├── load/             # batch loader into the raw schema
│   ├── contracts/        # Pydantic models per endpoint
│   └── tests/
├── transform/            # dbt: staging, marts, snapshots, tests
├── docs/
│   ├── adr/              # ADR-000, ADR-001, ...
│   └── sprints/          # S00.md, S01.md, ... release notes
└── .github/workflows/
```

`firebase.json`, `.firebaserc` and `functions/` sit inside `app/`, so run Firebase CLI commands from `app/`. Paths in those files are relative and did not change in the move.

## Data layer conventions

**Ingestion (`pipeline/`).** Python Azure Functions, timer-triggered: every 2 minutes during live fixtures, hourly otherwise (schedule derived from bootstrap fixture times). Blob paths are deterministic: `raw/{endpoint}/season=2026-27/gw={n}/{captured_at}.json`. Retries with backoff, polite rate limiting, structured logging to Application Insights. Pydantic models in `pipeline/contracts/` are the data contracts; payloads that fail validation go to `quarantine/` with the error. Each run writes a manifest (files, counts, checksum). Backfill is `python -m pipeline.backfill --from-gw 1 --to-gw N` and must be safe to re-run.

**Idempotency.** Use deterministic paths and natural keys, never run IDs. Loads use `MERGE` on natural keys and a load-log table so re-running never duplicates rows. Event identity follows the same idea used in the frontend gameweek log: a stable natural key (e.g. `manager:player:eventType:occurrenceIndex`) with the first-seen timestamp frozen.

**Database.** Schemas: `raw` (one table per endpoint, JSON plus `source_path`, `captured_at`, `loaded_at`), dbt-managed staging and marts, and `serve` (read-only views exposing only the columns the app needs; the serving role has `SELECT` on `serve` only). Separate dev and prod databases, both on the free offer.

**dbt (`transform/`).** `dbt-sqlserver` adapter, dev and prod targets authenticating through the CI identity. T-SQL dialect (Azure SQL), so use `OPENJSON` to flatten raw JSON. Naming: `stg_*` for staging, `fct_*` / `dim_*` / `mart_*` for marts. Every model's primary key gets `unique` and `not_null` tests; add relationships and accepted-values tests where they apply, and singular tests for business rules (e.g. ownership periods never overlap). Store raw snapshots and derive deltas in SQL with window functions; never write computed deltas from application code. Large fact tables are incremental on `captured_at`.

**Terraform (`infra/`).** Shared modules, per-environment variables in `envs/dev` and `envs/prod`, remote state in a storage account. Grant access through RBAC role assignments to managed identities, not keys. Run `terraform fmt` and `terraform validate` before proposing a change, and show me the expected plan impact.

**CI/CD (`.github/workflows/`).** PRs run `terraform fmt`, `validate` and `plan` (plan posted as a PR comment), plus lint and tests for `pipeline/` and `dbt build` against dev for changes in `transform/`. Merge to `main` applies to dev. Prod deploys on a version tag behind a GitHub environment approval. Azure login uses `azure/login` with OIDC (`id-token: write` permission), with federated credentials scoped to this repo's `main` branch, pull requests and the prod environment.

## Frontend conventions (`app/`)

- Derivations happen in the Pinia store (`src/stores/fpl.ts`), never in components; components stay dumb and reactive.
- Types are the contract: check `src/types/fpl.ts` before writing logic that touches API data. Don't assume API shapes.
- Helpers over long computeds: anything over ~30 lines moves to `src/lib/`.
- Prettier formatting.
- Colour tokens: green `var(--c-done)` for positive/incoming, amber `var(--c-live)` for live, red `var(--c-danger)` for negative.
- The Insights tab (S10) is lazy-loaded and must handle empty and error states when the serving function is cold or unavailable.

## Ways of working

- Trunk-based: short-lived `feat/`, `fix/`, `chore/` branches, squash-merged into `main` by PR. `main` is protected and requires green CI.
- Conventional Commits, e.g. `feat(pipeline): add raw snapshot writer`. Scopes: `app`, `infra`, `pipeline`, `transform`, `serve`, `docs`, `ci`.
- Definition of done: merged by PR, CI green, deployed to dev and verified, docs updated if behaviour or setup changed, no secrets anywhere.
- Significant decisions get a short ADR in `docs/adr/`. Planned so far: ADR-000 why Azure, ADR-001 raw lands in Blob before SQL, ADR-002 idempotency strategy, ADR-003 incremental strategy, ADR-004 federation over connection strings. If we make a decision that's hard to reverse, suggest an ADR.
- Each sprint closes with `docs/sprints/SNN.md`: goal, what shipped, what slipped, one lesson.

## How I'd like you to work

- Give exact commands and complete file contents, and tell me what to verify before committing.
- Flag anything that could incur cost or create a long-lived credential before doing it.
- Flag decisions that are hard to change later (region, naming, schema keys) and ask rather than assume.
- Keep explanations in plain prose; this is a learning project as much as a build.

## Commands

Frontend (from `app/`):

```bash
npm run dev -- --host
npm run typecheck
npm run build
npm --prefix functions run build
firebase emulators:start --only functions,hosting
```

CI (`.github/workflows/app.yml`) runs typecheck and both builds for changes under `app/`. Function lint (`npm --prefix functions run lint`) is not in CI yet: the generated Google ESLint config conflicts with the Prettier convention and needs reconciling.

Data layer commands will be added here as each layer is built (`terraform -chdir=infra/envs/dev plan`, `func start` in `pipeline/`, `dbt build` in `transform/`, and so on). Keep this section current.

## Open decisions

None currently.

Resolved: Azure region is UK South (`uksouth`), and resource names follow CAF style `{type}-fplassist-{env}-uks` (storage: `stfplassist{env}uks`). See `docs/adr/ADR-005-region-and-naming.md`.

Resolved: Draft API history (checked 2026-10-11, see README changelog). Every past gameweek of the current season can be fetched again (`event/{n}/live`, `event/{n}/fixtures`, `entry/{id}/event/{n}`, `entry/{id}/history`, `element-summary/{id}`, `draft/league/{id}/transactions`), so backfill covers GW1 onwards. Previous seasons are not available (`season` query parameters are ignored). Point-in-time state is not stored historically and only exists once the poller captures it: player news/status/availability in `bootstrap-static`, `league/{id}/element-status` ownership between gameweeks, and the order events happened during live matches. `draft/{id}/choices` returns no draft picks for this league.