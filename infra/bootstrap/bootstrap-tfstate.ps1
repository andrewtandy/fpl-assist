<#
.SYNOPSIS
  One-off bootstrap of the storage account that holds Terraform remote state.

.DESCRIPTION
  This is the only sanctioned manual infrastructure step (see docs/manual-setup.md).
  Terraform cannot create the storage account that stores its own state, so this
  script does it once with the Azure CLI. Everything else is Terraform.

  Safe to re-run: every step checks or converges to the desired state.

  Creates (names per docs/adr/ADR-005-region-and-naming.md):
    - Resource group  rg-fplassist-tfstate-uks, with a CanNotDelete lock
    - Storage account stfplassisttfstate (Standard_LRS, shared key access disabled)
    - Blob versioning and 30-day soft delete for blobs and containers
    - Container       tfstate
    - Storage Blob Data Contributor on the account for the signed-in user

  No keys, SAS tokens or connection strings are created or used: shared key access
  is disabled on the account and all data-plane calls use Entra ID (--auth-mode login).

.PARAMETER SubscriptionId
  Target subscription. Required so the script can never run against the wrong one.

.EXAMPLE
  az login
  ./infra/bootstrap/bootstrap-tfstate.ps1 -SubscriptionId <subscription-guid>
#>
param(
  [Parameter(Mandatory = $true)][string]$SubscriptionId,
  [string]$Location = 'uksouth'
)
$ErrorActionPreference = 'Stop'

$ResourceGroup = 'rg-fplassist-tfstate-uks'
$StorageAccount = 'stfplassisttfstate'
$Container = 'tfstate'
$RetentionDays = 30
$Tags = @('workload=fplassist', 'purpose=tfstate', 'managed-by=bootstrap-script')

function Invoke-Az {
  # Judge success by exit code only. With stderr redirected, Windows PowerShell 5.1 turns
  # az's harmless WARNING lines into errors, which 'Stop' would make fatal.
  $ErrorActionPreference = 'Continue'
  $output = & az @args
  if ($LASTEXITCODE -ne 0) { throw "az $($args -join ' ') failed with exit code $LASTEXITCODE" }
  return $output
}

Write-Host "==> Selecting subscription $SubscriptionId"
Invoke-Az account set --subscription $SubscriptionId | Out-Null
$sub = Invoke-Az account show --query '{name:name, user:user.name}' -o json | ConvertFrom-Json
Write-Host "    Subscription: $($sub.name)  Signed in as: $($sub.user)"

Write-Host "==> Registering the Microsoft.Storage resource provider (no-op if already registered)"
Invoke-Az provider register --namespace Microsoft.Storage --wait | Out-Null

Write-Host "==> Resource group $ResourceGroup"
Invoke-Az group create --name $ResourceGroup --location $Location --tags @Tags -o none

Write-Host "==> Storage account $StorageAccount"
$exists = @(Invoke-Az storage account list --resource-group $ResourceGroup --query "[?name=='$StorageAccount'].id" -o tsv | Where-Object { $_ }).Count -gt 0
if (-not $exists) {
  $check = Invoke-Az storage account check-name --name $StorageAccount -o json | ConvertFrom-Json
  if (-not $check.nameAvailable) {
    throw "Storage account name '$StorageAccount' is taken globally ($($check.reason)). Pick a suffixed name and record it in ADR-005."
  }
}
# create converges an existing account to these settings as well as creating a new one
Invoke-Az storage account create `
  --name $StorageAccount `
  --resource-group $ResourceGroup `
  --location $Location `
  --sku Standard_LRS `
  --kind StorageV2 `
  --access-tier Hot `
  --https-only true `
  --min-tls-version TLS1_2 `
  --allow-blob-public-access false `
  --allow-shared-key-access false `
  --tags @Tags `
  -o none
$accountId = Invoke-Az storage account show --name $StorageAccount --resource-group $ResourceGroup --query id -o tsv

Write-Host "==> Blob versioning and $RetentionDays-day soft delete"
Invoke-Az storage account blob-service-properties update `
  --account-name $StorageAccount `
  --resource-group $ResourceGroup `
  --enable-versioning true `
  --enable-delete-retention true `
  --delete-retention-days $RetentionDays `
  --enable-container-delete-retention true `
  --container-delete-retention-days $RetentionDays `
  -o none

Write-Host "==> Storage Blob Data Contributor for the signed-in user"
$userId = Invoke-Az ad signed-in-user show --query id -o tsv
$role = 'Storage Blob Data Contributor'
# Count ids rather than using JMESPath length(@): az.cmd runs through cmd.exe, which
# mis-parses unquoted parentheses in arguments.
$assigned = @(Invoke-Az role assignment list --assignee $userId --role $role --scope $accountId --query '[].id' -o tsv | Where-Object { $_ })
if ($assigned.Count -eq 0) {
  Invoke-Az role assignment create --assignee-object-id $userId --assignee-principal-type User --role $role --scope $accountId -o none
  Write-Host "    Assigned. Data-plane role assignments can take a few minutes to apply."
} else {
  Write-Host "    Already assigned."
}

Write-Host "==> Container $Container (Entra ID auth, retried while the role assignment propagates)"
$deadline = (Get-Date).AddMinutes(10)
while ($true) {
  & az storage container create --name $Container --account-name $StorageAccount --auth-mode login -o none 2>$null
  if ($LASTEXITCODE -eq 0) { break }
  if ((Get-Date) -gt $deadline) { throw "Could not create container '$Container' after 10 minutes. Check the role assignment and re-run." }
  Write-Host "    Not authorised yet, retrying in 30s..."
  Start-Sleep -Seconds 30
}

Write-Host "==> CanNotDelete lock on $ResourceGroup"
$locks = @(Invoke-Az lock list --resource-group $ResourceGroup --query "[?name=='protect-tfstate'].id" -o tsv | Where-Object { $_ })
if ($locks.Count -eq 0) {
  Invoke-Az lock create --name protect-tfstate --lock-type CanNotDelete --resource-group $ResourceGroup `
    --notes 'Holds Terraform state for every environment. Remove deliberately, never casually.' -o none
}

Write-Host ''
Write-Host 'Done. Backend settings for infra/envs/<env>/backend.tf:'
Write-Host "  resource_group_name  = `"$ResourceGroup`""
Write-Host "  storage_account_name = `"$StorageAccount`""
Write-Host "  container_name       = `"$Container`""
Write-Host '  key                  = "<env>.tfstate"'
Write-Host '  use_azuread_auth     = true'
