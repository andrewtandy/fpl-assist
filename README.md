# fpl-assist

A mobile-first dashboard for a Fantasy Premier League **Draft** league. It shows live gameweek scores, projected auto-substitutions, the overall league table, upcoming fixtures and per-player detail in a layout built for checking on a phone during matches.

## What it does

- **Live league table:** each manager's gameweek score as matches play out, with starters, projected bench auto-subs and live minutes. It refreshes automatically every 60 seconds while a gameweek is live.
- **Overall standings:** the season-long league table.
- **Fixture ticker:** upcoming and in-progress Premier League fixtures.
- **Player detail sheet:** points breakdown, match events and a did-not-play risk indicator for any player.

## How it works

- **Frontend:** Vue 3, TypeScript, Pinia and Vite. All data derivation happens in the Pinia store (`app/src/stores/fpl.ts`), with helpers in `app/src/lib/`, so components only display data.
- **Hosting:** Firebase Hosting.
- **API proxy:** a Cloud Function (`fplProxy`, in `app/functions/`) forwards `/api/*` to the FPL Draft API and `/api/classic/*` to the classic FPL API. It adds a short in-memory cache, which avoids CORS issues and reduces load on the upstream APIs.

## Planned: Azure data layer

In progress as a data engineering portfolio piece. Python Azure Functions poll the Draft API and land raw JSON in Blob Storage. A batch loader moves it into Azure SQL, and dbt builds staging and mart models. A new Insights tab will read those models. Infrastructure is Terraform, deployed by GitHub Actions using OIDC, with no long-lived secrets and free tiers only.

- **Plan:** [docs/project-plan.md](docs/project-plan.md) covers milestones, sprints S00–S11, and risks.
- **Conventions:** [CLAUDE.md](CLAUDE.md).
- **Decisions:** [docs/adr/](docs/adr/).

## Architecture

_Placeholder: an architecture diagram replaces this section in S11._

```text
FPL Draft API ──> Azure Functions poller ──> Blob Storage (raw JSON, immutable)
                                                  │
                                       batch loader (MERGE, load log)
                                                  ▼
                              Azure SQL: raw ──dbt──> staging ──> marts ──> serve views
                                                                               │
                         Firebase function (workload identity federation) <────┘
                                                  │
                                       Vue app: Insights tab
```

## Sprint log

| Sprint | Goal | Notes |
| --- | --- | --- |
| S00 – Repo and account setup | The repo looks like a real project before any Azure resource exists | [S00.md](docs/sprints/S00.md) |
| S01 – Infrastructure as code | `terraform apply` creates the whole dev environment from nothing | Not started |

Later sprints are listed in the [project plan](docs/project-plan.md). Each gets a row here when it closes.

## Running locally

Everything app-related lives in `app/`, so run these from there:

```bash
cd app
npm install
npm --prefix functions install

npm run dev -- --host                              # Vite dev server
firebase emulators:start --only functions,hosting  # local proxy function
```

Other scripts: `npm run build`, `npm run typecheck`, `npm run preview`.

The app reads the league ID from `VITE_LEAGUE_ID`. Set it in `app/.env.local`, which git ignores:

```bash
VITE_LEAGUE_ID=12345
```

## Changelog

A running journal of what changed and why, newest first. Each entry records the change, the reasoning behind it, and anything left open. Add an entry with every meaningful change: a feature, a restructure, a decision, or a lesson learned.

Entry template:

```markdown
### YYYY-MM-DD: Short title

**Changed:** what was done.
**Why:** the reasoning, alternatives considered, trade-offs.
**Next / open:** follow-ups or unanswered questions (optional).
```

---

### 2026-10-19: Terraform state storage bootstrapped (S01, #9)

**Changed:**
- Added `infra/bootstrap/bootstrap-tfstate.ps1` and ran it against the `FPL-Assist` subscription. It created `rg-fplassist-tfstate-uks` (with a delete lock), the `stfplassisttfstate` storage account (shared key access disabled, versioning and 30-day soft delete on) and a `tfstate` container.
- Added `docs/manual-setup.md`, which lists everything created by hand: the subscription, the budget and this bootstrap.

**Why:**
- **A script for this one step:** Terraform can't create the storage that holds its own state, so this is the single sanctioned manual step. It's scripted so it can be repeated, and documented so it isn't tribal knowledge.
- **Shared key disabled:** the account has keys, but Azure rejects them. Verified: a key-authenticated request fails with "Key based authentication is not permitted". Terraform and CI reach state through Entra ID only (`use_azuread_auth = true`), so there is no secret to leak.
- **Versioning, soft delete and the lock:** losing or corrupting state is the most painful failure in a Terraform setup, and these make it recoverable.
- **Cost:** under £0.01 a month.

**Lessons from running it:**
- **MFA:** Azure requires MFA for any change made from the CLI, not just in the portal. The first run failed until two-step verification was on.
- **Windows command quoting:** `az` on Windows is a batch file, so unquoted parentheses in a `--query` argument break `cmd` parsing. The script now avoids them.
- **Stderr warnings:** with stderr redirected, Windows PowerShell 5.1 turns `az` warnings into errors. The script now judges success by exit code.

**Next / open:**
- #10 Terraform modules, then #11 environment roots, which point their backend at this account.
- S02: grant the GitHub OIDC identity `Storage Blob Data Contributor` on the state account.

### 2026-10-11: S00 closed

**Changed:**
- Wrote the S00 sprint note ([docs/sprints/S00.md](docs/sprints/S00.md)), comparing every S00 ticket with the plan.
- Added the plan itself as [docs/project-plan.md](docs/project-plan.md).
- Enabled the `main` ruleset: PR required (squash only, 0 approvals), `build` check required with the branch up to date, linear history, and no force pushes or deletions.
- Set up the [Project board](https://github.com/users/andrewtandy/projects/1) (Backlog, Sprint, In progress, Review, Done), layer labels, milestones S00–S11, and issues for every S00 and S01 ticket.
- Added issue templates (sprint ticket, bug) and a PR template carrying the definition of done.
- Added an architecture placeholder and a sprint log to this README.

**Why:**
- **Ruleset:** makes the trunk-based workflow enforced rather than voluntary. Zero approvals because GitHub doesn't let you approve your own PR, so the passing CI check is the real gate.
- **Board, milestones, templates:** the plan asks for the project to be run like a small team's, with the work visible.
- **Plan comparison:** it showed the board and README tickets were incomplete even though S00 felt finished, so it was worth doing before closing the sprint.
- **Setup script:** I scripted the GitHub setup (`gh` plus one GraphQL call to replace the board's default Status options) and dry-ran it before creating anything.

**Next / open:**
- Configure Prettier and add a format check to CI (#14).
- Consider importing the hand-made Azure budget into Terraform in S01.
- Start S01 (Terraform state bootstrap, GitHub-to-Azure OIDC). This needs an Azure subscription with the free SQL offer.

### 2026-10-11: Function lint in CI and branch protection prep

**Changed:**
- Function ESLint now extends `eslint-config-prettier` (and drops its own `quotes` and `indent` rules), so lint passes.
- Added a lint step to the `app` workflow.
- Removed the workflow's path filters so it runs on every PR.

**Why:**
- **Lint:** the config generated by `firebase init` uses the Google style guide, whose formatting rules (brace spacing, 80-character lines) conflict with the project's Prettier convention. Letting ESLint check code quality and Prettier own formatting is the standard split, and it avoids two tools arguing over whitespace.
- **Path filters:** `build` is about to become a required status check on `main`. A required check that is skipped by a path filter never reports, so a docs-only or infra-only PR would wait forever. Running the job on every PR costs about 35 seconds.

**Next / open:**
- Enable the `main` ruleset: PR required (0 approvals, squash only), `build` check required, linear history, no force pushes or deletions.
- When `pipeline/` and `infra/` workflows arrive, switch to one workflow with path detection and a single always-running summary job as the required check.

### 2026-10-11: S00 restructure into a monorepo layout

**Changed:**
- Moved the Vue app, its Cloud Function and the Firebase config into `app/`.
- Added empty `infra/`, `pipeline/`, `transform/`, `docs/adr/` and `docs/sprints/` folders, each with a short README.
- Added a GitHub Actions workflow (`app.yml`) that typechecks and builds the frontend and the function on PRs and pushes to `main`.
- Upgraded `vue-tsc` from 1.8 to 2.x.
- Deleted the template `HelloWorld.vue` and the unused `functions/.env`.

**Why:**
- **Layout:** each layer of the data platform gets its own top-level folder, so CI can trigger on the paths that changed and the app stays deployable on its own. `firebase.json` moved with the app because all its paths (`dist`, `functions`) are relative to it, so nothing inside it needed editing.
- **vue-tsc:** `npm run typecheck` had been crashing since TypeScript 5.9 was installed, because vue-tsc 1.8 can't patch it. CI needs a working typecheck to be a useful gate.

**Decisions recorded:** ADR-000 (why Azure), ADR-001 (raw lands in Blob before SQL), and ADR-005 (UK South region, CAF-style names such as `rg-fplassist-dev-uks`). Region and naming came first because neither can be changed without recreating resources.

**Draft API history check:** before restructuring, I probed the API to see whether waiting to build the poller would lose data.
- Every past gameweek of the current season can be fetched again: live points, picks, fixtures, per-player history and waiver transactions. Backfill from GW1 will work.
- Previous seasons are not available.
- What is lost until the poller runs: point-in-time state such as player news and injury status, ownership between gameweeks, and the order events happen during live matches.
- These matter for later insights, not core data, so no stopgap capture is needed.

**Next / open:**
- Function lint fails against the generated Google ESLint config, which conflicts with Prettier. Reconcile it, then add lint to CI.
- Turn on branch protection for `main` requiring the `build` check.

### 2026-10-11: Repository set up and README rewritten

**Changed:** Moved the project into git with a private GitHub remote (`andrewtandy/fpl-assist`) on a `main` branch. Rewrote `.gitignore` and replaced the Vite template README with a project summary and this changelog.

**Why:**
- **Branch name:** `main` matches the trunk-based workflow planned in CLAUDE.md, which assumes short-lived feature branches squash-merged into a protected `main`.
- **`.gitignore`:** keeps secrets, local env files, build output, Firebase deploy caches and local AI tooling out of history. It also covers paths the data layer will create (Terraform state and `*.tfvars`, Python virtual environments, Azure Functions `local.settings.json`, dbt `target/`), so nothing sensitive can be committed by accident once those folders exist. `.terraform.lock.hcl` stays tracked so provider versions are pinned.
- **Changelog:** sits in the README so the reasoning behind changes is visible next to the code, which suits a learning and portfolio project.

**Next / open:**
- Turn on branch protection for `main` once CI exists.
- S00: restructure into `app/`, `infra/`, `pipeline/`, `transform/`, `docs/`.
- Decide the Azure region and resource naming convention.
