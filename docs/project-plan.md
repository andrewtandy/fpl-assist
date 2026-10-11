# fpl-assist Data Platform: Project Plan

Source of truth: https://claude.ai/code/artifact/f492e904-d37b-4497-a22c-f45cd4ea587d

## Overview

Add an Azure data layer to fpl-assist across 12 faux sprints in 4 milestones, so the repo shows production data engineering practice end to end. Each sprint delivers one key function; a sprint is done when it is merged and demoable, not when two weeks pass.

**The portfolio should demonstrate:**

- Infrastructure as code (Terraform) with separate dev and prod environments
- CI/CD with keyless (OIDC) authentication from GitHub to Azure
- An idempotent ingestion pipeline with a replayable raw layer and full-season backfill
- Layered SQL modelling in dbt (raw, staging, marts) with tests and generated lineage docs
- Advanced SQL: window functions for team deltas, SCD Type 2 ownership history, H2H analytics
- Cross-cloud integration: Firebase (GCP) reading Azure via workload identity federation, no stored keys
- Cost-aware design: everything runs inside the Azure SQL free offer and Functions free grant

**Out of scope:** rewriting the existing live dashboard, real-time streaming, and any paid Azure service.

## Ways of working

Run it like a small team would: every sprint has a goal, a short ticket list, a demo and a retro note, all visible in the repo.

- **Board:** a GitHub Project with columns Backlog, Sprint, In progress, Review, Done. One issue per ticket, labelled by layer (`infra`, `pipeline`, `transform`, `serve`, `docs`) and linked to a milestone.
- **Sprint cadence:** open a GitHub milestone per sprint, e.g. `S03 – Ingestion`. Close it with a release note in `docs/sprints/S03.md` covering goal, what shipped, what slipped and one lesson.
- **Branching:** trunk-based. Short-lived `feat/`, `fix/`, `chore/` branches, squash-merged via PR into `main`. Branch protection on `main` requires green CI.
- **Commits:** Conventional Commits (`feat(pipeline): add raw snapshot writer`), so a changelog can be generated later.
- **Environments:** everything deploys to dev on merge; prod deploys on a tagged release with a manual approval gate.

**Definition of done (every ticket):**

- [ ] Code merged to `main` through a reviewed PR (self-review with a checklist counts)
- [ ] CI green: lint, unit tests, and `terraform plan` or `dbt build` where relevant
- [ ] Deployed to dev and verified
- [ ] README or docs updated if behaviour or setup changed
- [ ] No secrets in code, config or CI variables

## Target architecture and repo layout

_Architecture diagram: see the live plan document (to be replaced by a diagram in the README in S11)._

The poller writes only to cheap Blob Storage; the database wakes for batch loads and cached reads, and no service anywhere holds a long-lived key.

```text
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
│   ├── adr/
│   └── sprints/
└── .github/workflows/
```

## Milestones at a glance

_Roadmap diagram: see the live plan document._

Each diamond is a milestone gate: don't start the next milestone until its criteria are met, so the project is always in a showable state if it pauses.

## Milestone 1: Platform foundation (S00–S02)

Exit criteria: a commit to `main` deploys Azure infrastructure to dev through CI, with no stored credentials anywhere.

### S00 – Repo and account setup

**Goal:** the repo looks like a real project before any Azure resource exists.

- [ ] Restructure into `app/` (existing Vue/Firebase code), `infra/`, `pipeline/`, `transform/`, `docs/`
- [ ] Create the Azure subscription; set a £5 budget with email alerts at 50% and 90%
- [ ] GitHub Project board, labels, issue and PR templates, branch protection on `main`
- [ ] README skeleton: purpose, architecture placeholder, local setup, sprint log links
- [ ] ADR-000: record the decision to use Azure for the data layer and why

**Demo:** the board, a protected `main`, and the budget alert screen.

### S01 – Infrastructure as code

**Goal:** `terraform apply` creates the whole dev environment from nothing.

- [ ] Bootstrap remote Terraform state in a storage account (one-off script, documented)
- [ ] Modules for resource group, storage account (raw container), Key Vault, Azure SQL server and free-offer database, Function App, Application Insights
- [ ] `envs/dev` and `envs/prod` with shared modules and per-environment variables
- [ ] Managed identity on the Function App, granted Blob write and SQL access via RBAC
- [ ] ADR-001: why raw lands in Blob before SQL (protecting the 100,000 vCore-second monthly allowance)

**Demo:** destroy and recreate dev in one command.

### S02 – CI/CD with OIDC

**Goal:** GitHub Actions plans and applies Terraform without any Azure secret.

- [ ] Entra ID app registration with federated credentials scoped to this repo's `main` branch and pull requests
- [ ] PR workflow: `terraform fmt`, `validate`, `plan`, with the plan posted as a PR comment
- [ ] Merge workflow: apply to dev automatically; apply to prod on a version tag behind a GitHub environment approval
- [ ] Lint and test jobs stubbed for `pipeline/` and `transform/`

**Demo:** open a PR, see the plan comment, merge, watch dev update.

## Milestone 2: Data flowing (S03–S05)

Exit criteria: every gameweek of the current season is in Azure SQL, refreshed automatically on matchdays, and any load can be re-run without duplicates.

### S03 – Ingestion function

**Goal:** a scheduled function lands raw API snapshots in Blob Storage.

- [ ] Python Azure Function with a timer trigger: every 2 minutes during live fixtures, hourly otherwise (schedule decided from bootstrap fixture times)
- [ ] Fetch league details, live gameweek data, each entry's picks and league transactions
- [ ] Write unmodified JSON to `raw/{endpoint}/season=2026-27/gw={n}/{captured_at}.json`
- [ ] Retries with backoff, polite rate limiting, structured logs to Application Insights
- [ ] Unit tests with recorded API fixtures (no live calls in CI)

**Demo:** a live matchday's files appearing in the container, and the logs in Application Insights.

### S04 – Backfill and data contracts

**Goal:** the full season can be rebuilt from the API on demand, and bad payloads are caught early.

- [ ] Backfill CLI: `python -m pipeline.backfill --from-gw 1 --to-gw N`, safe to re-run
- [ ] Pydantic models per endpoint as data contracts; payloads that fail validation go to a `quarantine/` path with the error
- [ ] Manifest file per run (files written, counts, checksum) for traceability
- [ ] ADR-002: idempotency strategy (deterministic paths and natural keys, not run IDs)

**Demo:** wipe dev's raw container, run the backfill, show identical results twice.

### S05 – Load into Azure SQL

**Goal:** raw files become queryable tables without waking the database every two minutes.

- [ ] `raw` schema: one table per endpoint, JSON stored with load metadata (`source_path`, `captured_at`, `loaded_at`)
- [ ] Batch loader function: hourly on matchdays, once after the gameweek finishes; loads only files not yet in a load-log table
- [ ] `MERGE` on natural keys so re-loads never duplicate
- [ ] Monitor the free vCore-seconds remaining metric with an alert at 10%

**Demo:** query a gameweek's snapshots in the Azure portal query editor; re-run the load and show unchanged row counts.

## Milestone 3: Modelled data (S06–S08)

Exit criteria: dbt builds tested staging and mart layers in CI, and the marts answer at least four league questions the live app cannot.

### S06 – dbt foundation and staging

**Goal:** clean, typed, tested staging models over every raw table.

- [ ] dbt project on the `dbt-sqlserver` adapter, with dev and prod targets authenticating through the CI identity
- [ ] Sources with freshness checks (warn after 3 hours on matchdays)
- [ ] Staging models: `stg_players`, `stg_teams`, `stg_fixtures`, `stg_entries`, `stg_picks`, `stg_live_player_gw`, `stg_transactions`, `stg_h2h_matches`, flattening JSON with `OPENJSON`
- [ ] Tests on every primary key (unique, not null), relationships, and accepted values for positions and transaction types
- [ ] CI job: `dbt build` against dev on every PR touching `transform/`

**Demo:** the dbt docs lineage graph from sources to staging.

### S07 – Team snapshot deltas

**Goal:** the headline feature: how each team's score moved through a gameweek.

- [ ] `fct_team_snapshots`: one row per entry per capture, with live points and projected points after auto-subs
- [ ] Deltas with `LAG` per entry and gameweek; auto-sub swing as projected minus live
- [ ] `fct_h2h_lead_changes`: every time the lead flipped in a head-to-head, with timestamp and margin
- [ ] `mart_biggest_comebacks`: largest deficit overturned per gameweek and season
- [ ] Incremental materialisation on `captured_at`; ADR-003 explains the incremental strategy

**Demo:** chart one match's lead swinging over a weekend from the mart.

### S08 – Ownership history and league analytics

**Goal:** slowly changing dimensions and the fun season-long stats.

- [ ] `dim_player_ownership` as SCD Type 2 (dbt snapshot or `valid_from`/`valid_to` built from transactions)
- [ ] `mart_waiver_value`: points a pickup scored for the new owner versus for the manager who dropped him
- [ ] `mart_luck_index`: actual H2H record versus an all-play table, and points against relative to league average
- [ ] `mart_bench_points_lost` and `mart_dnp_risk_accuracy` (flag versus actual minutes)
- [ ] Singular tests for business rules, e.g. ownership periods never overlap for one player

**Demo:** "who owned this player in GW7, and what did dropping him cost?" answered in one query.

## Milestone 4: Served end to end and launched (S09–S11)

Exit criteria: the live fpl-assist app shows mart data read from Azure through federated identity, and the repo is ready to share publicly.

### S09 – Cross-cloud serving

**Goal:** a Firebase function reads Azure marts with no stored Azure credential.

- [ ] Federated credential on an Entra ID app registration that trusts the Firebase function's Google service account (issuer `accounts.google.com`)
- [ ] Firebase function exchanges its Google ID token for an Entra token, then queries a read-only `serve` schema
- [ ] `serve` views expose only the columns the app needs; database role grants `SELECT` on `serve` only
- [ ] Response caching (e.g. 5 minutes) so app traffic doesn't wake the database repeatedly
- [ ] ADR-004: federation over connection strings, with a sequence diagram of the token exchange

**Demo:** call the endpoint and show there's no Azure secret in Firebase config or Secret Manager.

### S10 – Insights tab in the app

**Goal:** the data work becomes visible to the league.

- [ ] New lazy-loaded tab in the Vue app: score-swing chart for each H2H match, biggest comebacks, luck index table
- [ ] Player detail sheet gains ownership history from `dim_player_ownership`
- [ ] Graceful empty and error states when the serving function is cold or unavailable

**Demo:** walk the league through the new tab on a live matchday.

### S11 – Observability, docs and launch

**Goal:** a reviewer understands the project in five minutes and trusts that it runs.

- [ ] Pipeline health: alerts on function failures, stale sources and quarantined payloads
- [ ] dbt docs published to GitHub Pages from CI
- [ ] README: architecture diagram, how to run locally, cost breakdown, links to ADRs and sprint notes
- [ ] CI badges, a tagged `v1.0.0` release with a generated changelog
- [ ] Short write-up (blog or LinkedIn post) on the most interesting problem solved

**Demo:** the public repo, top to bottom.

## Risks and mitigations

The biggest risk is the free vCore allowance; the architecture already guards it, and the rest are manageable with small habits.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Free SQL compute (100,000 vCore-seconds/month per database) runs out | Database pauses until month end | Batch loads only, serving cache, 10% remaining alert; set the free offer to auto-pause rather than bill |
| Unofficial FPL draft API changes shape or rate-limits | Ingestion breaks mid-season | Pydantic contracts and quarantine path; raw layer lets you reprocess after a fix |
| Unexpected Azure charges | Real cost | £5 budget alert from S00; Terraform-only changes so nothing is created by hand |
| Season timing (mid-season start, breaks) | Thin live data to demo | Backfill covers past gameweeks; international breaks are good sprints for infra and docs work |
| OIDC and federation setup is fiddly | S02 and S09 overrun | Timebox each to one sprint; fall back to a Key Vault secret temporarily and log it as tech debt |
| Hobby momentum fades | Project stalls half-built | Each milestone is shippable alone; write the sprint note even for a small sprint |

**Open question:** how much historical data does the draft API return for past seasons? If it's current-season only, start capturing now so next season has year-over-year comparisons.

## Stretch backlog

Pull from here once v1.0.0 ships, or swap one in if a sprint finishes early.

- **Data quality dashboard:** test results and freshness over time, stored from dbt run artifacts
- **Orchestration upgrade:** replace timers with Azure Durable Functions to show fan-out and dependency handling
- **Classic FPL support:** extend contracts and staging to the main FPL game for a second source system
- **Projections model:** a simple expected-points model from historical marts, with backtesting
- **Season archive:** export marts to Parquet in Blob at season end for cheap long-term storage
- **Power BI report:** a free Power BI Desktop report on the marts, linked from the README