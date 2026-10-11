# fpl-assist

A mobile-first dashboard for a Fantasy Premier League **Draft** league. It shows live gameweek scores, projected auto-substitutions, the overall league table, upcoming fixtures and per-player detail in a layout built for checking on a phone during matches.

## What it does

- **Live league table:** each manager's gameweek score as matches play out, with starters, projected bench auto-subs and live minutes. It refreshes automatically every 60 seconds while a gameweek is live.
- **Overall standings:** the season-long league table.
- **Fixture ticker:** upcoming and in-progress Premier League fixtures.
- **Player detail sheet:** points breakdown, match events and a did-not-play risk indicator for any player.

## How it works

- **Frontend:** Vue 3, TypeScript, Pinia and Vite. All data derivation happens in the Pinia store (`src/stores/fpl.ts`), with helpers in `src/lib/`, so components only display data.
- **Hosting:** Firebase Hosting.
- **API proxy:** a Cloud Function (`fplProxy`, in `functions/`) forwards `/api/*` to the FPL Draft API and `/api/classic/*` to the classic FPL API. It adds a short in-memory cache, which avoids CORS issues and reduces load on the upstream APIs.

## Planned: Azure data layer

In progress as a data engineering portfolio piece. Python Azure Functions poll the Draft API and land raw JSON in Blob Storage. A batch loader moves it into Azure SQL, and dbt builds staging and mart models. A new Insights tab will read those models. Infrastructure is Terraform, deployed by GitHub Actions using OIDC, with no long-lived secrets and free tiers only. See [CLAUDE.md](CLAUDE.md) for the full conventions.

## Running locally

```bash
npm install
npm --prefix functions install

npm run dev -- --host                              # Vite dev server
firebase emulators:start --only functions,hosting  # local proxy function
```

Other scripts: `npm run build`, `npm run typecheck`, `npm run preview`.

The app reads the league ID from `VITE_LEAGUE_ID`. Set it in a `.env.local` file at the repo root, which git ignores:

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
