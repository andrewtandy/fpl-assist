# ADR-000: Build the data layer on Azure

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

fpl-assist already runs on Firebase (Hosting plus a Cloud Function proxy). The new data layer is a portfolio piece meant to show end-to-end data engineering and SQL practice: ingestion, a relational warehouse, modelled transformations, infrastructure as code and keyless CI/CD. It must run at zero cost.

## Decision

Build the data layer on Azure: Functions for ingestion, Blob Storage for raw landing, Azure SQL Database (free offer) as the warehouse, dbt for transformation, Terraform for infrastructure and GitHub Actions with OIDC for deployment. The existing Firebase app stays where it is and reads the marts through workload identity federation.

## Consequences

- Azure SQL gives a real T-SQL warehouse (`MERGE`, window functions, `OPENJSON`) for free within 100,000 vCore-seconds per database per month, if it auto-pauses. The pipeline must be designed around that allowance: SQL wakes for batch loads and cached serving reads, never per poll.
- The project spans two clouds. Firebase-to-Azure access needs workload identity federation instead of a shared secret (ADR-004).
- Azure skills (Entra ID, managed identity, RBAC) become part of what the project demonstrates.

## Alternatives considered

- **Stay on Google Cloud (BigQuery, Cloud Functions):** one cloud and simpler identity. BigQuery's free tier is generous, but it is a different SQL dialect and less transferable to the SQL Server and Azure roles this portfolio targets.
- **Supabase or another Postgres host:** cheap and simple, but it shows less infrastructure-as-code and identity work, and free tiers pause or limit storage unpredictably.
- **Local only (DuckDB):** zero cost, but no cloud deployment, identity or CI/CD story.
