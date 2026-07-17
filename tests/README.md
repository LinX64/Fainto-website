# Fainto web-companion tests

Zero-dependency test suite for the signed-in web companion (`web/`). No npm, no `package.json`,
no build — matching the repo's "no dependencies" law. The suite runs `web/dashboard-core.js`
(the single render + data core behind both `app.html` and `dashboard.html`) inside a `node:vm`
context with a tiny `window`/`navigator` shim, then asserts on its outputs.

## Run

```bash
node --test 'tests/**/*.test.mjs'
```

Requires Node ≥ 18 (the built-in `node:test` runner). Nothing to install.
`tests/` is excluded from the cPanel deploy mirror (`.github/workflows/deploy.yml`), so it never ships.

## What's covered (automated)

`dashboard-core.test.mjs` exercises every offline-testable journey of the logged-in dashboard:

- **Render bug regressions** (2026-07-17 screenshot): garbage-timestamp rows recover the real date
  trapped in the note instead of printing "Nov 13, 36"; a note that is only a date is dropped; the
  redundant foreign-currency badge no longer shows when the foreign currency equals the account currency.
- **Date parsing** — `parseCsvDate` (incl. the `DD-MM-YYYY` dash format that used to be silently
  skipped), `parseLooseDate` (anchored note→date recovery), `isSaneTs` range guard.
- **Transaction sanitize** — the sync/import contract: drops rows without a numeric timestamp or valid
  type, keeps `iconKey`/foreign fields, defaults category and currency.
- **Row render** — income/expense sign + colour, title-cased category, HTML-escaped notes (XSS),
  icon resolution (override → category default → OTHER circle), Edit/Delete buttons in interactive mode.
- **Search + sort** — `txFilterSort` across category/note and all four sort orders.
- **CSV import** — header/delimiter detection, signed amounts, European decimal commas, debit/credit
  columns, currency detection, skipped-row counting, friendly errors.
- **JSON import** — `resolveFromFileText`.
- **Full render pipeline** — `renderDashboard` runs headless and prints the correct net worth.

## Not automated (needs live infrastructure — manual checklist)

These journeys depend on a real Firebase project and/or a phone, so they can't run offline
(`web/firebase-config.js` ships `REPLACE_WITH_*` placeholders locally; real values are injected only
in CI). Verify by hand against a deployed build before a release:

- [ ] **Email/password sign-in** (`app.html?mode=signin`) — sign in, wrong-password error, forgot-password reset email.
- [ ] **Google sign-in** — popup completes, dashboard loads.
- [ ] **Signed-in flash gate** — a returning user sees the "Checking your session…" spinner, never a flash of the sign-in card.
- [ ] **QR / WebRTC pairing** (`app.html?mode=connect`) — scan from the phone, bundle transfers, SHA-256 verifies, redirect to `dashboard.html`.
- [ ] **Add / Edit / Delete transaction** with category + icon pickers — writes sync back to Firestore.
- [ ] **CSV bank import** into the signed-in account.
- [ ] **Sign out** — session cleared, back button does not re-expose the dashboard (bfcache).
- [ ] **Theme toggle** and **read-only file-open viewer** (`dashboard.html?open=1`) with a real export/CSV.
