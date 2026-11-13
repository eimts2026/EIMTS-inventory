# Inventory backend

Supabase project `kmfuzygltjwhjwmwebbd`, named `Eimts-Inventory`.

## Implemented milestone

The database implements IT membership, branches, locations, employee custodians, settings, assets, custody history, signed paper references, physical verification snapshots, observations, discrepancies, and activity history. Inventory starts empty. The initial confirmed IT Admin is `admin@emeraldisle.lk`.

The frontend uses real Supabase Auth and database commands. Adding a publishable key alone does not authorize a user to access inventory. Browser preview data is not imported automatically.

## SQL files

`migrations/` contains the exact SQL applied through Supabase MCP. Local filenames match the hosted migration history. Inline comments explain permissions, locking, retries, and custody rules. These files can also be reviewed in SQL Editor. Migration history prevents reapplying them. Do not run an already applied migration manually.

`tests/access_and_custody.sql` runs assertions in a transaction and rolls back its fixtures. Run it through trusted SQL access against a development project. It creates temporary Auth identities directly for database policy testing. It does not exercise an actual sign-in session.

`database.types.ts` is generated from the hosted schema. Regenerate it after schema changes.

## Access and first administrator

`it_members` is the explicit allowlist. `IT Admin` manages access and organisation settings. Both IT roles can maintain inventory and custody. A person in the employee directory receives no login permissions. Every request checks the membership table, including active status, Auth deletion, anonymous status, and account bans. User-editable metadata is not used for authorization.

The chosen administrator was created by the project owner in Auth and granted IT membership through trusted SQL. Its email confirmation and successful browser sign-in were verified. Further accounts can be created in Supabase Auth and granted inventory roles by an IT Admin in Settings. Passwords stay in Supabase Auth.

Every exposed table uses RLS. Clients have SELECT grants only. Sensitive helper functions live in the `private` schema, with an empty search path and restricted execution. Client writes pass through `inventory_command`, which checks membership and validates the operation. Changes are recorded by database triggers. Application roles cannot forge or edit activity entries. Trusted database administrators retain normal administrative access.

The frontend integration will use the project URL and publishable key. Secret and service-role keys belong in trusted server environments. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

## Command contract

Call `inventory_command(p_request_id, p_action, p_data)` using a signed-in approved IT identity. Create a UUID for each intended mutation. Retain that UUID and the identical payload when retrying a failed network response. A successful retry returns the original result. Reusing a UUID with different data or a different actor fails.

| Action | Required data |
| --- | --- |
| `save_branch` | `name`, optional client `id`. Edits also supply current `version` and `active`. |
| `save_location` | `name`, either `branch_id` or `branch_name`, optional `id`. Edits also supply `version` and `active`. A new branch name and its location are saved atomically. |
| `save_person` | `name`, `employee_id`, `department`, `location_id`, optional `id`. Edits also supply `version` and `active`. |
| `save_asset` | `tag`, `name`, `category`, `condition`, `location_id`, optional `id`, `serial`, `cost`, `purchased_on`, `warranty_until`, `next_verification_on`. Edits supply all metadata and current `version`. |
| `issue_asset` | `asset_id`, `asset_version`, `person_id`, `location_id`, `condition`, `paper_reference`. Optional `due_on`, `accessories`, `filing_location`, `signed_received`. |
| `transfer_asset` | Issue fields plus current `handover_id`, `return_reference`, optional `return_filing`. |
| `return_asset` | `asset_id`, `asset_version`, current `handover_id`, `location_id`, `condition`, `return_reference`, optional `return_filing`. |
| `record_signed_form` | `handover_id`, current handover `version`, `signed_received`, `filing_location`, optional corrected `paper_reference`. Records the current officer and server time when received. |
| `retire_asset` | `asset_id`, `asset_version`, `note`. Asset must be returned and available or awaiting service. |
| `save_settings` | Current `version`, `organisation`, `verification_days`, `paper_prefix`. Admin only. |
| `save_it_member` | Existing Auth `user_id`, `display_name`, `role`, optional `active`. Edits also supply current `version` and `active`. Admin only. |

Values for category, condition, status, and IT roles match the frontend model. Unknown serials, costs, and dates use SQL NULL. Costs are in LKR. Unique tags, known serials, employee IDs, and names within a branch are compared after trimming and case folding. Directory records can be deactivated while their history remains linked.

Custody commands lock the asset row before changing its handovers. A partial unique index permits one open handover per asset. Transfer closure and the next issue commit together. Return of a damaged asset sets `Needs service`. The current custodian is derived from the open handover through the `asset_register` view. That view uses `security_invoker` so table RLS remains effective.

Row versions reject stale edits with SQLSTATE `40001`. Validation errors use `22023`. Access failures use `42501`. Uniqueness failures use `23505`. The frontend should reload conflicted records before allowing a fresh edit and translate these codes into appropriate feedback.

## Verification performed

- Applied seven migrations and generated TypeScript types from the hosted schema.
- Executed rollback-only assertions for approved IT access, non-IT denial, anonymous denial, metadata privilege escalation denial, direct write denial, admin-only changes, the final-admin rule, and deactivation.
- Checked issue, transfer, signed form attribution, damaged return, duplicate request handling, stale versions, and atomic rollback after a failed transfer.
- Submitted two simultaneous issue requests for one asset. One succeeded. The competitor received `40001`, and SQL confirmed exactly one open handover. Temporary committed concurrency fixtures were removed after the test.
- Ran Supabase security and performance advisors. Revoked client execution on the Supabase-provided `rls_auto_enable` event trigger. Retry receipts have an explicit deny policy. The remaining Auth warning is disabled leaked-password protection, which remains a project Auth setting. New database indexes also have informational unused-index notices before real workload exists. [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Remaining approved work

Additional database reports, MFA, and database backup/restore operations follow in later milestones. Password-recovery email delivery and redirect configuration need verification against the deployment's Auth settings. Leaked-password protection remains disabled in the project. Real inventory will be normalized and validated in a dry run when the source data is supplied. No real inventory import has run.

## Physical verification commands

`start_audit` accepts `id`, `name`, `location_id`, and `due_on`. It freezes asset IDs, tags, serials, conditions, locations, and custodians. `record_observation` accepts `audit_id`, `asset_id`, `observed_location_id`, `condition`, `confirmed_serial`, and `note`. The caller's Auth ID and server time provide verification attribution. Unknown snapshot serials require identification evidence in the notes. Location mismatch and damage each create their own discrepancy.

`close_audit` accepts `audit_id`. Unseen expected assets create missing-asset cases. A repeated close returns the already-closed audit. Recording observations in a closed audit is rejected.

`raise_discrepancy` accepts `asset_id`, `title`, `type`, `owner_id`, `due_on`, optional `observed_location_id`, and `note`. `resolve_discrepancy` accepts `id`, current `version`, `resolution`, and optional `apply_location` plus current `asset_version`. Location correction is explicit and does not change the frozen audit evidence.

`inventory_snapshot` returns one consistent server snapshot for the existing dashboard, forms, reports, and exports. Its activity history is limited to the newest 1,000 entries. Full audit and custody records remain in their own tables.

`tests/verification.sql` passed checks for frozen known and unknown serials, serial mismatches, damage, retries, missing assets on closure, repeated closure, resolution conflicts, and evidence protection. Browser checks also passed directory creation, asset registration with unknown purchase cost/date, audit creation, physical observation, automatic discrepancy creation, and resolution. Temporary browser-test inventory was removed afterward.

Maintenance uses public.repairs and the open_repair / complete_repair inventory commands. Asset locks, versions and one-open-repair indexing protect custody. Successful completion returns a checked device to Available / Good. Paper service references remain physical.
