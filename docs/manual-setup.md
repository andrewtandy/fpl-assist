# Manual setup register

Terraform is the only way infrastructure changes (see CLAUDE.md). This file lists the few things that had to be created by hand, because they must exist before Terraform can run. Anything not listed here was created by Terraform. If it wasn't, that's a bug.

| What | Sprint | Created with | Why it can't be Terraform |
| --- | --- | --- | --- |
| Azure subscription `FPL-Assist` | S00 | Azure portal | Terraform needs a subscription to deploy into |
| £5 budget, email alerts at 50% and 90% | S00 | Azure portal | It was a cost backstop before any Terraform existed. It could be imported later as `azurerm_consumption_budget_subscription`. |
| Terraform state storage | S01 | `infra/bootstrap/bootstrap-tfstate.ps1` | Terraform can't create the storage that holds its own state |

---

## Azure subscription and budget (S00)

- **Subscription:** `FPL-Assist`.
- **Budget:** £5 on the subscription, with email alerts at 50% (£2.50) and 90% (£4.50) of actual spend. It's a backstop against mistakes, not a spending plan; the design targets £0.
- **Verify:** Azure portal → Cost Management → Budgets.

## Terraform state storage (S01, #9)

### What it creates

All names follow ADR-005.

| Resource | Name | Settings |
| --- | --- | --- |
| Resource group | `rg-fplassist-tfstate-uks` | UK South, with a `CanNotDelete` lock (`protect-tfstate`) |
| Storage account | `stfplassisttfstate` | Standard_LRS, StorageV2, HTTPS only, TLS 1.2, no public blob access, **shared key access disabled** |
| Blob service | | Versioning on; 30-day soft delete for blobs and containers |
| Container | `tfstate` | Private |
| Role assignment | | `Storage Blob Data Contributor` on the account for the person who ran the script |

Each environment stores its state as one blob in the container: `dev.tfstate` and `prod.tfstate`.

### Why it's set up this way

- **Shared key access disabled:** the account has keys, but Azure rejects any request that uses them, so a leaked key is useless. Terraform reaches state through Entra ID (`use_azuread_auth = true` in the backend), and so does the CI identity in S02. This keeps the "no long-lived secrets" rule.
- **Versioning and soft delete:** state is the one file whose loss is painful, because Terraform would no longer know what it manages. Versioning lets a corrupted state be rolled back, and soft delete covers accidental deletion.
- **Delete lock:** stops the resource group being deleted by accident, including by a mistaken `terraform destroy` pointed at the wrong scope.
- **Locking during runs:** the azurerm backend takes a blob lease while a run is in progress, so two runs can't write state at once. Nothing extra is needed for that.
- **Network:** the account keeps its public endpoint so GitHub-hosted runners can reach it, and access is controlled by Entra ID and RBAC. Restricting by IP isn't practical because GitHub runner IPs change.

### Cost

A few kilobytes of state plus old versions costs well under £0.01 a month at LRS hot-tier prices, and transaction costs at this volume are negligible. This is the only resource that isn't strictly inside a free grant, unless the subscription still has its 12-month free storage allowance.

### Running it

Prerequisites: the Azure CLI (`winget install Microsoft.AzureCLI`), and an account that is Owner or User Access Administrator on the subscription. Assigning roles and creating locks needs one of those.

```powershell
az login
az account list --query "[].{name:name, id:id}" -o table      # find the FPL-Assist subscription ID
./infra/bootstrap/bootstrap-tfstate.ps1 -SubscriptionId <id>
```

The script can be re-run safely. It will usually wait a minute or two while the new role assignment takes effect before it can create the container.

Sign-in problems seen on the first run (2026-10-19):

- **"User cancelled the Accounts Control Operation":** the Windows sign-in broker (WAM) closed its account picker. Switch to browser sign-in once with `az config set core.enable_broker_on_windows=false`.
- **`AADSTS50076` (MFA required) on the first write:** Azure requires multi-factor authentication for anything that creates or changes resources. Turn on two-step verification on the Microsoft account, then sign in again with `az login --tenant <tenant-id> --scope "https://management.core.windows.net//.default"`. CI uses OIDC as a workload identity, which this rule doesn't apply to.

### Verify

```powershell
az storage account show -n stfplassisttfstate -g rg-fplassist-tfstate-uks --query "{sharedKey:allowSharedKeyAccess, tls:minimumTlsVersion, publicBlob:allowBlobPublicAccess}"
# expect: sharedKey false, tls TLS1_2, publicBlob false

az storage account blob-service-properties show -n stfplassisttfstate -g rg-fplassist-tfstate-uks --query "{versioning:isVersioningEnabled, softDelete:deleteRetentionPolicy.days}"
# expect: versioning true, softDelete 30

az storage container list --account-name stfplassisttfstate --auth-mode login --query "[].name"
# expect: ["tfstate"]

az lock list -g rg-fplassist-tfstate-uks --query "[].{name:name, level:level}"
# expect: protect-tfstate, CanNotDelete
```

### Later sprints

- **S02:** the GitHub Actions OIDC identity needs `Storage Blob Data Contributor` on this account so CI can read and write state. Grant it in Terraform where possible, and record it here if it has to be done by hand.

### Removing it

Only do this when retiring the project. Every environment's state must be destroyed first (`terraform destroy` in each `envs/*`).

```powershell
az lock delete --name protect-tfstate -g rg-fplassist-tfstate-uks
az group delete --name rg-fplassist-tfstate-uks
```
