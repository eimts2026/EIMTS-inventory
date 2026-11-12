# Inventory backend

Supabase project `kmfuzygltjwhjwmwebbd`, named `Eimts-Inventory`.

## Implemented milestone

The database implements IT membership, branches, locations, employee custodians, settings, assets, custody history, signed paper references, and activity history. Inventory and Auth identities start empty. Organisation defaults are configuration.

The frontend currently uses browser persistence and the existing dummy login. Real Auth and database integration follow in a later step. Adding a publishable key alone does not authorize a user to access inventory.

## SQL files

`migrations/` contains the exact SQL applied through Supabase MCP. Local filenames match the hosted migration history. Inline comments explain permissions, locking, retries, and custody rules. These files can also be reviewed in SQL Editor. Migration history prevents reapplying them. Do not run an already applied migration manually.

`tests/access_and_custody.sql` runs assertions in a transaction and rolls back its fixtures. Run it through trusted SQL access against a development project. It creates temporary Auth identities directly for database policy testing. It does not exercise an actual sign-in session.

`database.types.ts` is generated from the hosted schema. Regenerate it after schema changes.

## Access and first administrator

`it_members` is the explicit allowlist. `IT Admin` manages access and organisation settings. Both IT roles can maintain inventory and custody. A person in the employee directory receives no login permissions. Every request checks the membership table, including active status, Auth deletion, anonymous status, and account bans. User-editable metadata is not used for authorization.

When Auth integration begins, create or invite the intended first administrator through Supabase Auth and verify their identity. Bootstrap their membership through trusted SQL in a transaction that sets `request.jwt.claims` to that verified Auth user ID. Then insert the member with the `IT Admin` role. The trigger attributes the bootstrap to that identity. No bootstrap identity or membership was created for production.

Every exposed table uses RLS. Clients have SELECT grants only. Sensitive helper functions live in the `private` schema, with an empty search path and restricted execution. Client writes pass through `inventory_command`, which checks membership and validates the operation. Changes are recorded by database triggers. Application roles cannot forge or edit activity entries. Trusted database administrators retain normal administrative access.

The frontend integration will use the project URL and publishable key. Secret and service-role keys belong in trusted server environments. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

## Command contract

Call `inventory_command(p_request_id, p_action, p_data)` using a signed-in approved IT identity. Create a UUID for each intended mutation. Retain that UUID and the identical payload when retrying a failed network response. A successful retry returns the original result. Reusing a UUID with different data or a different actor fails.

| Action | Required data |
| --- | --- |
| `save_branch` | `name`, optional client `id`. Edits also supply current `version` and `active`. |
| `save_location` | `name`, `branch_id`, optional `id`. Edits also supply `version` and `active`. |
| `save_person` | `name`, `employee_id`, `department`, `location_id`, optional `id`. Edits also supply `version` and `active`. |
| `save_asset` | `tag`, `name`, `category`, `condition`, `location_id`, optional `id`, `serial`, `cost`, `purchased_on`, `warranty_until`, `next_verification_on`. Edits supply all metadata and current `version`. |
| `issue_asset` | `asset_id`, `asset_version`, `person_id`, `location_id`, `condition`, `paper_reference`. Optional `due_on`, `accessories`, `filing_location`, `signed_received`. |
| `transfer_asset` | Issue fields plus current `handover_id`, `return_reference`, optional `return_filing`. |
| `return_asset` | `asset_id`, `asset_version`, current `handover_id`, `location_id`, `condition`, `return_reference`, optional `return_filing`. |
| `record_signed_form` | `handover_id`, current handover `version`, `filing_location`. Records the current officer and server time. |
| `retire_asset` | `asset_id`, `asset_version`, `note`. Asset must be returned and available or awaiting service. |
| `save_settings` | Current `version`, `organisation`, `verification_days`, `paper_prefix`. Admin only. |
| `save_it_member` | Existing Auth `user_id`, `display_name`, `role`, optional `active`. Edits also supply current `version` and `active`. Admin only. |

Values for category, condition, status, and IT roles match the frontend model. Unknown serials, costs, and dates use SQL NULL. Costs are in LKR. Unique tags, known serials, employee IDs, and names within a branch are compared after trimming and case folding. Directory records can be deactivated while their history remains linked.

Custody commands lock the asset row before changing its handovers. A partial unique index permits one open handover per asset. Transfer closure and the next issue commit together. Return of a damaged asset sets `Needs service`. The current custodian is derived from the open handover through the `asset_register` view. That view uses `security_invoker` so table RLS remains effective.

Row versions reject stale edits with SQLSTATE `40001`. Validation errors use `22023`. Access failures use `42501`. Uniqueness failures use `23505`. The frontend should reload conflicted records before allowing a fresh edit and translate these codes into appropriate feedback.

## Verification performed

- Applied three migrations and generated TypeScript types from the hosted schema.
- Executed rollback-only assertions for approved IT access, non-IT denial, anonymous denial, metadata privilege escalation denial, direct write denial, admin-only changes, the final-admin rule, and deactivation.
- Checked issue, transfer, signed form attribution, damaged return, duplicate request handling, stale versions, and atomic rollback after a failed transfer.
- Submitted two simultaneous issue requests for one asset. One succeeded. The competitor received `40001`, and SQL confirmed exactly one open handover. Temporary committed concurrency fixtures were removed after the test.
- Ran Supabase security and performance advisors. Revoked client execution on the Supabase-provided `rls_auto_enable` event trigger. Retry receipts have an explicit deny policy. The remaining Auth warning is disabled leaked-password protection, which needs review during the deferred login step. New database indexes also have informational unused-index notices before real workload exists. [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Remaining approved work

Physical verification snapshots and observations, discrepancies, maintenance, consumable movements, database reports, frontend data integration, real sign-in, IT account provisioning, and database backup/restore operations follow in later milestones. Real inventory will be normalized and validated in a dry run when the source data is supplied. No real inventory import has run.
