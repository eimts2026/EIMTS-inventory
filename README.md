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
- Workspace defaults, IT account drafts, and validated preview backup export/restore.

Documents are printed and stored in physical files. The app records their reference numbers and filing locations.

## Preview data and the next step

The preview opens on a dummy IT sign-in screen. Use `it@eimts.demo` and `Inventory123!`. Signing out or reloading returns to this screen. These are public demo credentials for the frontend walkthrough.

Typography uses locally bundled Inter with larger table and supporting text. Form and filter menus use custom keyboard-accessible selects. Card, button, menu, and dialog motion respects reduced-motion preferences.

The frontend starts empty and saves changes in this browser’s local storage. The previous demo cache remains untouched under `eimts-inventory-preview-v1` for recovery of manually entered preview records. It is never loaded into the new workspace or uploaded. Settings provides a JSON export/restore workflow. Data validation checks tags, serials, IDs, references, and active custody before accepting a backup.

Supabase project `kmfuzygltjwhjwmwebbd` now has the first backend milestone for IT authorization, directory records, assets, transactional custody, paper references, and database activity history. See [backend implementation](supabase/README.md) for SQL, commands, verification, and remaining work.

The frontend still uses local browser persistence and the dummy login. Real Auth, frontend database integration, physical verification SQL, maintenance, consumables, reports, and database backup operations remain pending. Account entries in Settings are local drafts. Browser data and activity history are editable by the device owner.

Camera scanning needs browser camera permission and a secure context such as HTTPS or localhost. Manual entry works through the same verification form. Hardware camera capture and physical printer output need checks on the department’s devices.

## Vercel deployment

The Vite build outputs to `dist`. `vercel.json` supplies the build configuration and frontend routing. The app can use a Vercel-provided URL and a custom subdomain when available.

Vercel’s Hobby plan is restricted to personal, non-commercial use. Choose an eligible plan for company deployment. [Vercel Hobby terms](https://vercel.com/docs/plans/hobby)
