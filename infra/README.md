# infra

Terraform for the Azure data layer: shared modules in `modules/` (storage, sql, function_app, key_vault, monitoring) and per-environment roots in `envs/dev` and `envs/prod`. Built from S01 onwards.

- `bootstrap/`: the one-off script that creates the Terraform state storage account. It's the only infrastructure not managed by Terraform; see [docs/manual-setup.md](../docs/manual-setup.md).
