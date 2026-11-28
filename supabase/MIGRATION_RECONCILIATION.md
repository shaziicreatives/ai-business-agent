# Migration reconciliation — AI Business Agent

## Current production source of truth
The live Supabase project has these 16 applied migrations (recorded in Supabase migration history):

- 20261124215111 initial_multi_tenant_business_agent_schema
- 20261124215224 workspace_onboarding_rpc
- 20261125195522 private_admin_control_plane
- 20261125195600 lock_legacy_workspace_rpc
- 20261125195611 harden_updated_at_trigger
- 20261125215137 revoke_client_access_to_integration_secrets
- 20261125215234 add_missing_foreign_key_indexes
- 20261125215337 optimize_workspace_rls_policies
- 20261126052945 ai_credit_accounts_and_ledger
- 20261126053026 atomic_ai_credit_consumption_and_ledger_lock
- 20261126053139 enforce_monthly_ai_credit_quota_and_unblock_topups
- 20261127100642 add_admin_branding_assets
- 20261127100746 secure_admin_branding_storage_uploads
- 20261127102229 add_admin_operations_modules
- 20261127104318 automatic_admin_invoice_numbers
- 20261127130523 secure_browser_session_registry

## Repository drift found
The feature branch did not contain the source SQL for those 16 applied migrations. It contained only `20261126000100_admin_panel_scans.sql`, which is not present in the live database migration history. Do not assume the repository migration directory is a complete replay of production history.

## Safe Preview baseline
`20261128100653_preview_schema_baseline.sql` is a schema-only snapshot generated from the live database catalog and applied successfully to the isolated Preview Supabase project. It recreates the current 33 public tables, 7 functions, 8 triggers, sequence, constraints, indexes, RLS flags, and policies. It intentionally copies no production rows, auth users, credentials, or storage objects.

The baseline includes an additive compatibility statement for `admin_panel_scans.business_id` because the older repository-only migration creates that table without this later live column.

The separate `20261128101413_preview_admin_branding_storage.sql` migration recreates the existing `admin-branding` Storage bucket metadata and its admin-only upload policy. It copies no branding files or other Storage objects.


## Preview Edge Functions restored
The Preview Supabase project initially had no Edge Functions, while Production had `admin-console`, `admin-verify`, and `submit-access-request`. The three functions were deployed to Preview from the current Production function source. Preview-only copies are stored under `supabase/preview-functions/`; their CORS origin is `*` for the isolated Preview project only. Production function code and deployment were not changed. `admin-console` still validates the bearer token and active `private_admins` role server-side; `admin-verify` keeps JWT verification enabled; `submit-access-request` remains the public request intake endpoint.

## Rules going forward
1. Keep the live migration history read-only during Preview work.
2. Recover the original 16 SQL files from trusted Git history/backups before treating them as the canonical historical migration chain.
3. Use the schema baseline only as the clean Preview bootstrap until the original files are restored and replay-tested.
4. Every future schema change must be committed as a migration file and applied/tested in Preview first.
5. Never copy production business rows, clinic/patient records, auth users, or integration secrets into Preview.
