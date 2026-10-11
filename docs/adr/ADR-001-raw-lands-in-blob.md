# ADR-001: Raw API responses land in Blob Storage before SQL

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

The poller calls the FPL Draft API every 2 minutes during live fixtures and hourly otherwise. The Azure SQL free offer allows 100,000 vCore-seconds per database per month and stays free only if the database auto-pauses when idle. Writing each poll straight to SQL would keep the database awake through every live match and use up the allowance.

Some API state is point-in-time and cannot be fetched again later: player news and availability, ownership between gameweeks, and the order of events during live matches. Losing a capture loses that data permanently.

## Decision

The poller writes each response unmodified to Blob Storage at a deterministic path, `raw/{endpoint}/season=2026-27/gw={n}/{captured_at}.json`, and never touches SQL. A separate batch loader moves new blobs into the SQL `raw` schema on a schedule, using `MERGE` and a load-log table so re-runs are safe. All cleaning and typing happens in dbt.

## Consequences

- SQL wakes only for batch loads and serving reads, which keeps usage inside the free allowance.
- Blob is the permanent record. If a dbt model or loader has a bug, everything can be rebuilt from raw.
- Data in SQL lags capture by up to one load interval. That is acceptable for insights; the live dashboard still reads the API through the existing proxy.
- There are two moving parts (poller and loader) instead of one, each needing monitoring.

## Alternatives considered

- **Poller writes directly to SQL:** simpler, but it breaks the vCore budget and couples capture to database availability.
- **Queue between poller and SQL:** decouples them, but the database still wakes per message, and it adds a service without solving the budget problem.
