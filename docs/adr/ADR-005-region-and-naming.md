# ADR-005: Azure region and resource naming

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

Both choices are hard to reverse. Most Azure resources cannot be renamed or moved between regions; they have to be recreated, which for SQL means migrating data. Storage account and Function App names are also globally unique, so the convention has to produce names that are both valid and unlikely to collide.

## Decision

**Region:** UK South (`uksouth`, short code `uks`) for every resource in both dev and prod.

**Naming:** Microsoft Cloud Adoption Framework style, `{type}-{workload}-{env}-{region}`, with workload `fplassist`:

| Resource | Pattern | Dev example |
| --- | --- | --- |
| Resource group | `rg-fplassist-{env}-uks` | `rg-fplassist-dev-uks` |
| Storage account | `stfplassist{env}uks` (no hyphens, 3–24 lowercase characters) | `stfplassistdevuks` |
| SQL server | `sql-fplassist-{env}-uks` | `sql-fplassist-dev-uks` |
| SQL database | `sqldb-fplassist-{env}` | `sqldb-fplassist-dev` |
| Function App | `func-fplassist-{env}-uks` | `func-fplassist-dev-uks` |
| App Service plan | `asp-fplassist-{env}-uks` | `asp-fplassist-dev-uks` |
| Key Vault | `kv-fplassist-{env}-uks` (3–24 characters) | `kv-fplassist-dev-uks` |
| Application Insights | `appi-fplassist-{env}-uks` | `appi-fplassist-dev-uks` |
| Log Analytics workspace | `log-fplassist-{env}-uks` | `log-fplassist-dev-uks` |
| Managed identity | `id-fplassist-{env}-{purpose}` | `id-fplassist-dev-github` |
| Terraform state storage | `stfplassisttfstate` in `rg-fplassist-tfstate-uks` | (shared) |

Environments are `dev` and `prod`. Terraform builds names in one place (a `locals` block per environment) so they are never typed by hand.

## Consequences

- UK South is close to the developer and the league. The free SQL offer and every planned service are available there.
- The serving path crosses from Firebase (`us-central1`) to UK South. That adds roughly 100 ms per uncached read, which is acceptable because the serving function caches mart reads.
- The CAF prefixes make the resources recognisable to anyone reviewing Azure work. The region suffix leaves room for a second region if one is ever needed.
- If a globally unique name is taken, add a short suffix (e.g. `stfplassistdevuks01`) and record it here.

## Alternatives considered

- **West Europe:** similar service coverage, but further away with no benefit.
- **East US:** closest to the Firebase function, but far from the developer, and serving latency is already hidden by caching.
- **Names without the region suffix:** shorter, but ambiguous if a second region is ever added.
