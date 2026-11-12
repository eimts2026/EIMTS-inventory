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
- Workspace defaults, enforced IT access, and inventory export.

Documents are printed and stored in physical files. The app records their reference numbers and filing locations.

## Connected inventory

Sign in with a confirmed Supabase Auth account that has active IT membership. The initial IT Admin is `admin@emeraldisle.lk`. Sessions restore after a page reload. Signing out clears the session on this device. The dummy credentials have been removed.

Typography uses locally bundled Inter with larger table and supporting text. Form and filter menus use custom keyboard-accessible selects. Card, button, menu, and dialog motion respects reduced-motion preferences.

Inventory reads and writes now use Supabase. Browser preview records are never loaded or uploaded automatically. The old cache remains recoverable under `eimts-inventory-preview-v1`. Settings exports the loaded inventory to JSON. Database restore operations remain a later milestone.

Supabase project `kmfuzygltjwhjwmwebbd` implements IT authorization, directory records, assets, transactional custody, physical audit snapshots, observations, discrepancies, paper references, and database activity history. See [backend implementation](supabase/README.md) for SQL, commands, verification, and remaining work.

Maintenance and consumable screens identify their pending database integration. Reports for the connected modules read the current server snapshot. Activity displays the most recent 1,000 database events. IT access and settings are enforced by database role checks.

## Supabase configuration

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. This workspace is configured with the project's publishable key. Add the same values to Vercel before deployment. Secret and service-role keys stay outside the frontend.

Password recovery uses Supabase email delivery. In Supabase Auth URL Configuration, allow `http://127.0.0.1:4173/**` for the local preview, `http://127.0.0.1:5173/**` for Vite development, and the eventual production URL. Validate recovery email delivery and redirects for the actual deployment. The site URL should become the production subdomain when available. [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

Camera scanning needs browser camera permission and a secure context such as HTTPS or localhost. Manual entry works through the same verification form. Hardware camera capture and physical printer output need checks on the department’s devices.

## Vercel deployment

The Vite build outputs to `dist`. `vercel.json` supplies the build configuration and frontend routing. The app can use a Vercel-provided URL and a custom subdomain when available.

Vercel’s Hobby plan is restricted to personal, non-commercial use. Choose an eligible plan for company deployment. [Vercel Hobby terms](https://vercel.com/docs/plans/hobby)
