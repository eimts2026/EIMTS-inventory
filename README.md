# EIMTS-inventory

A React and TypeScript frontend for the IT department’s asset register, custody records, physical verification, and follow-up work.

## Run locally

Use Node.js 24 LTS and npm.

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. Run `npm run build` for a production build and `npm run typecheck` for TypeScript validation.

## Frontend workflows

- Dashboard with branch filtering, inventory totals, verification progress, and attention items.
- Asset registration and editing, search, category/location/status filters, CSV import/export, retirement, and QR label printing.
- Employee custody, transfers, returns, signed paper references, filing locations, and printable handover forms.
- Location audits with an expected inventory snapshot, camera or manual tag lookup, serial confirmation, observed condition, and verifier history.
- Discrepancy ownership, due dates, resolution notes, and explicit confirmation before applying an observed location to the register.
- Repair tracking with service references, costs, and return to IT stock.
- Consumable receipts and issues, stock history, and reorder thresholds.
- Employee and location records, six printable/exportable reports, and activity history.
- Workspace defaults, IT account drafts, validated preview backup export/restore, and sample-data reset.

Documents are printed and stored in physical files. The app records their reference numbers and filing locations.

## Preview data and the next step

The frontend starts with fictional people, branches, and 24 assets. It saves changes in this browser’s local storage. Settings provides a sample reset and a JSON export/restore workflow. Data validation checks tags, serials, IDs, references, and active custody before accepting a backup.

Shared persistence, approved IT sign-in, MFA, enforced admin/officer permissions, account revocation, database transactions, and scheduled encrypted backups are pending the Supabase PostgreSQL integration. Account entries in Settings are local drafts. Browser data and activity history are editable by the device owner.

Camera scanning needs browser camera permission and a secure context such as HTTPS or localhost. Manual entry works through the same verification form. Hardware camera capture and physical printer output need checks on the department’s devices.

## Vercel deployment

The Vite build outputs to `dist`. `vercel.json` supplies the build configuration and frontend routing. The app can use a Vercel-provided URL and a custom subdomain when available.

Vercel’s Hobby plan is restricted to personal, non-commercial use. Choose an eligible plan for company deployment. [Vercel Hobby terms](https://vercel.com/docs/plans/hobby)

## Frontend sign-in preview

Use the demo email it@eimts.demo and password Inventory123! to enter the workspace. Signing out or refreshing returns to the dummy login. Inter typography and custom form/filter menus are bundled locally.

