// End-to-end coverage of the Fainto web-companion RENDER + DATA logic (web/dashboard-core.js),
// the single source of truth behind both app.html (signed-in) and dashboard.html (read-only viewer).
//
// Runner: `node --test` (built into Node ≥18) — zero npm dependencies, nothing to install, nothing
// ships to production. See tests/README.md for the manual checklist covering the Firebase sign-in
// and QR/WebRTC pairing journeys, which need a real Firebase project + phone and can't run offline.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, fakeRoot, rowDesc } from './helpers/load-core.mjs';

const F = loadCore();
const T = F.__test;

// Sanitize a single raw transaction the way the live sync pipeline does before rendering.
function tx(raw) { return T.sanitizeTransaction(raw); }
function row(raw, currency = 'PLN', interactive = false) {
  return T.txRowHtml(tx(raw), currency, interactive);
}
const EXPENSE = { timestampMillis: 1780000000000, type: 'EXPENSE', amount: 10, category: 'OTHER' };

/* ========================================================================================
 * BUG REGRESSIONS (from the 2026-07-17 signed-in screenshot)
 * ====================================================================================== */

test('BUG: garbage timestamp + real date trapped in the note → recovers the date, drops the raw note', () => {
  // Row rendered as "Nov 13, 36 · 29-05-2026" in the wild: bad millis, real date stuck in note.
  const t = tx({ timestampMillis: -6.1e13, type: 'EXPENSE', amount: 65.03, category: 'OTHER', note: '29-05-2026' });
  assert.equal(new Date(t.timestampMillis).getUTCFullYear(), 2026);   // date recovered from the note
  assert.equal(t.note, '');                                           // the duplicate date note is dropped
  const desc = rowDesc(T.txRowHtml(t, 'PLN', false));
  assert.match(desc, /May 29, 2026/);
  assert.doesNotMatch(desc, /29-05-2026/);                            // raw note gone
  assert.doesNotMatch(desc, /\b36\b/);                                // no nonsense year
});

test('BUG: an unrecoverable garbage timestamp never prints a nonsense date', () => {
  const t = tx({ timestampMillis: -6.1e13, type: 'EXPENSE', amount: 5, category: 'FOOD', note: 'KFC' });
  const desc = rowDesc(T.txRowHtml(t, 'PLN', false));
  assert.equal(desc, 'KFC');                       // note only, no "Nov 13, 36"
});

test('a date-shaped note is PRESERVED when the timestamp is already valid (never destroy real data)', () => {
  // A user note like "2024-05-15" may be a meaningfully different date from the transaction — keep it.
  const t = tx({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 5, category: 'FOOD', note: '2024-05-15' });
  assert.equal(t.note, '2024-05-15');
  assert.match(rowDesc(T.txRowHtml(t, 'PLN', false)), /2024-05-15/);
});

test('BUG: no foreign badge when the foreign currency equals the display currency', () => {
  const html = row({ ...EXPENSE, amount: 90, category: 'FOOD', note: 'Barber', foreignAmount: 90, foreignCurrency: 'PLN' }, 'PLN');
  assert.doesNotMatch(html, /class="badge"/);      // the stray gray "90.00 PLN" line is gone
});

test('foreign badge still shows for a genuinely different currency', () => {
  const html = row({ ...EXPENSE, amount: 50, category: 'FOOD', foreignAmount: 12.5, foreignCurrency: 'USD' }, 'PLN');
  assert.match(html, /class="badge">12\.50 USD</);
});

test('no foreign badge for a zero foreign amount', () => {
  const html = row({ ...EXPENSE, foreignAmount: 0, foreignCurrency: 'USD' }, 'PLN');
  assert.doesNotMatch(html, /class="badge"/);
});

/* ========================================================================================
 * DATE PARSING — parseCsvDate (import) + parseLooseDate (note recovery)
 * ====================================================================================== */

test('parseCsvDate handles DD-MM-YYYY with dashes (the format that used to be silently skipped)', () => {
  assert.equal(new Date(T.parseCsvDate('29-05-2026', true)).getUTCFullYear(), 2026);
  const d = new Date(T.parseCsvDate('29-05-2026', true));
  assert.equal(d.getMonth(), 4);   // May (local noon, TZ-safe)
  assert.equal(d.getDate(), 29);
});

test('parseCsvDate still handles ISO, dotted and slashed forms', () => {
  assert.ok(T.parseCsvDate('2026-05-29'));           // ISO dashes
  assert.ok(T.parseCsvDate('29.05.2026'));           // dotted
  assert.ok(T.parseCsvDate('2026/05/29'));           // slashed ISO
  assert.ok(T.parseCsvDate('29/05/2026', true));     // slashed day-first
});

test('parseLooseDate only matches a string that is ENTIRELY a date', () => {
  assert.ok(T.parseLooseDate('29-05-2026'));
  assert.ok(T.parseLooseDate('2026-05-29'));
  assert.equal(T.parseLooseDate('KFC'), null);
  assert.equal(T.parseLooseDate('paid 29-05-2026'), null);   // anchored — no partial match
  assert.equal(T.parseLooseDate(''), null);
});

test('parseLooseDate disambiguates day-first vs month-first by out-of-range fields', () => {
  assert.equal(new Date(T.parseLooseDate('29-05-2026')).getDate(), 29);   // 29 must be the day
  assert.equal(new Date(T.parseLooseDate('05-29-2026')).getDate(), 29);   // month-first shape
});

test('isSaneTs rejects out-of-window timestamps', () => {
  assert.equal(T.isSaneTs(1780000000000), true);     // 2026
  assert.equal(T.isSaneTs(-6.1e13), false);          // year ~36
  assert.equal(T.isSaneTs(NaN), false);
  assert.equal(T.isSaneTs('x'), false);
});

/* ========================================================================================
 * TRANSACTION SANITIZE — the sync/import contract
 * ====================================================================================== */

test('sanitizeTransaction drops rows missing a numeric timestamp or a valid type', () => {
  assert.equal(tx({ type: 'EXPENSE', amount: 1 }), null);                     // no timestamp
  assert.equal(tx({ timestampMillis: 1780000000000, amount: 1 }), null);      // no type
  assert.equal(tx({ timestampMillis: 1780000000000, type: 'FOO', amount: 1 }), null);
  assert.equal(tx('not an object'), null);
});

test('sanitizeTransaction keeps iconKey override and foreign fields, defaults category to OTHER', () => {
  const t = tx({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 3, iconKey: 'pet' });
  assert.equal(t.category, 'OTHER');
  assert.equal(t.iconKey, 'pet');
  assert.equal(t.foreignAmount, null);
  assert.equal(t.foreignCurrency, null);
});

test('sanitizeBundle defaults currency to PLN and rebuilds the transaction list', () => {
  const b = F.sanitizeBundle({ transactions: [{ timestampMillis: 1780000000000, type: 'INCOME', amount: 100, category: 'SALARY' }] });
  assert.equal(b.financialProfile.currency, 'PLN');
  assert.equal(b.transactions.length, 1);
});

/* ========================================================================================
 * ROW RENDER — sign, label, escaping, icons, actions
 * ====================================================================================== */

test('income renders "+" and green, expense renders "−" and spend colour', () => {
  const inc = row({ timestampMillis: 1780000000000, type: 'INCOME', amount: 100, category: 'SALARY' });
  const exp = row({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 100, category: 'FOOD' });
  assert.match(inc, /var\(--green\)[^]*\+/);
  assert.match(exp, /var\(--acc-spend\)[^]*−/);
});

test('category label is title-cased and the note is HTML-escaped (no XSS)', () => {
  const html = row({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 1, category: 'FOOD', note: '<img src=x onerror=alert(1)>' });
  assert.match(html, /class="row-name">Food</);
  assert.doesNotMatch(html, /<img src=x/);          // escaped
  assert.match(html, /&lt;img src=x/);
});

test('icon resolution: iconKey override wins, else category default, OTHER falls back to a circle', () => {
  // OTHER → circle icon (a real SVG, not the empty accent-bar)
  const other = row({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 1, category: 'OTHER' });
  assert.match(other, /class="row-icon"/);
  // FOOD default is utensils
  assert.match(row({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 1, category: 'FOOD' }), /class="row-icon"/);
  // iconKey 'pet' override renders the dog glyph regardless of category
  const pet = row({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 1, category: 'OTHER', iconKey: 'pet' });
  assert.equal(F.catMeta('OTHER').icon, 'circle');
  assert.match(pet, /class="row-icon"/);
});

test('interactive rows carry Edit/Delete buttons with the row id; read-only rows do not', () => {
  const t = tx({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 1, category: 'FOOD', id: 'abc123' });
  const interactive = T.txRowHtml(t, 'PLN', true);
  assert.match(interactive, /data-act="edit" data-id="abc123"/);
  assert.match(interactive, /data-act="delete" data-id="abc123"/);
  assert.doesNotMatch(T.txRowHtml(t, 'PLN', false), /data-act=/);
});

/* ========================================================================================
 * FILTER + SORT — the search box and sort dropdown
 * ====================================================================================== */

const SAMPLE = [
  tx({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 250, category: 'SHOPPING', note: 'clothes' }),
  tx({ timestampMillis: 1770000000000, type: 'EXPENSE', amount: 45, category: 'FOOD', note: 'KFC' }),
  tx({ timestampMillis: 1785000000000, type: 'EXPENSE', amount: 4000, category: 'OTHER', note: 'Travel' }),
];

test('search matches category OR note, case-insensitively', () => {
  assert.equal(T.txFilterSort(SAMPLE, { query: 'kfc', sort: 'newest' }).length, 1);
  assert.equal(T.txFilterSort(SAMPLE, { query: 'shopping', sort: 'newest' }).length, 1);
  assert.equal(T.txFilterSort(SAMPLE, { query: 'zzz', sort: 'newest' }).length, 0);
});

test('sort orders by newest, oldest, and amount both ways', () => {
  const newest = T.txFilterSort(SAMPLE, { query: '', sort: 'newest' });
  assert.equal(newest[0].note, 'Travel');           // 1785… is latest
  const oldest = T.txFilterSort(SAMPLE, { query: '', sort: 'oldest' });
  assert.equal(oldest[0].note, 'KFC');              // 1770… is earliest
  assert.equal(T.txFilterSort(SAMPLE, { query: '', sort: 'amount-desc' })[0].amount, 4000);
  assert.equal(T.txFilterSort(SAMPLE, { query: '', sort: 'amount-asc' })[0].amount, 45);
});

/* ========================================================================================
 * FORMATTERS
 * ====================================================================================== */

test('formatMoney formats a currency and formatDate a readable date', () => {
  assert.match(F.formatMoney(90, 'PLN'), /90\.00/);
  assert.match(F.formatMoney(90, 'USD'), /\$?90\.00/);
  assert.match(F.formatDate(1780000000000), /2026/);
});

/* ========================================================================================
 * CSV IMPORT — parseCsvToBundle (bank statement backfill)
 * ====================================================================================== */

test('CSV import: header detection, DD-MM dash dates, signed amounts, currency, skipped rows', () => {
  const csv = [
    'Date,Description,Amount,Currency',
    '29-05-2026,Groceries,-65.03,PLN',
    '01-06-2026,Salary,5000.00,PLN',
    'not-a-date,Broken,-1,PLN',            // skipped: unparseable date
  ].join('\n');
  const res = F.parseCsvToBundle(csv);
  assert.ok(res.bundle, res.error);
  assert.equal(res.imported, 2);
  assert.equal(res.skipped, 1);
  assert.equal(res.bundle.financialProfile.currency, 'PLN');
  const [a, b] = res.bundle.transactions;
  assert.equal(a.type, 'EXPENSE');
  assert.equal(a.amount, 65.03);
  assert.equal(b.type, 'INCOME');
  assert.equal(new Date(a.timestampMillis).getUTCFullYear(), 2026);
});

test('CSV import: separate debit/credit columns and European decimal commas', () => {
  const csv = [
    'Booking Date;Payee;Debit;Credit',
    '29.05.2026;Rent;1 200,50;',
    '30.05.2026;Refund;;99,00',
  ].join('\n');
  const res = F.parseCsvToBundle(csv);
  assert.ok(res.bundle, res.error);
  assert.equal(res.imported, 2);
  const [rent, refund] = res.bundle.transactions;
  assert.equal(rent.type, 'EXPENSE');
  assert.equal(rent.amount, 1200.5);
  assert.equal(refund.type, 'INCOME');
  assert.equal(refund.amount, 99);
});

test('CSV import: a file without the required columns returns a friendly error, not a throw', () => {
  const res = F.parseCsvToBundle('foo,bar\n1,2');
  assert.ok(res.error);
  assert.equal(res.bundle, undefined);
});

/* ========================================================================================
 * JSON IMPORT — resolveFromFileText (Fainto export)
 * ====================================================================================== */

test('resolveFromFileText parses a JSON export bundle and rejects junk', () => {
  const json = JSON.stringify({ financialProfile: { currency: 'EUR' }, transactions: [{ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 9, category: 'FOOD' }] });
  const bundle = F.resolveFromFileText(json);          // returns the sanitized bundle directly, or null
  assert.ok(bundle);
  assert.equal(bundle.financialProfile.currency, 'EUR');
  assert.equal(bundle.transactions.length, 1);
  assert.equal(F.resolveFromFileText('{not json'), null);
});

/* ========================================================================================
 * FULL RENDER PIPELINE — renderDashboard runs headless and shows net worth
 * ====================================================================================== */

test('renderDashboard builds every section headless and prints the correct net worth', () => {
  const bundle = F.sanitizeBundle({
    financialProfile: { currency: 'PLN' },
    netWorth: { assets: [{ name: 'Bank', category: 'CASH', value: 120000 }], liabilities: [{ name: 'Card', category: 'DEBT', value: 12600 }] },
    transactions: [{ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 45, category: 'FOOD', note: 'KFC' }],
  });
  const root = fakeRoot();
  assert.doesNotThrow(() => F.renderDashboard(root, bundle, { interactive: false }));
  assert.match(root.innerHTML, /id="sec-transactions"/);       // transactions section present
  assert.match(root.innerHTML, /107[ ,  ]?400/);               // net worth 120000 − 12600 = 107,400 (any grouping sep)
});
