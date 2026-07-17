// Extended journey + edge-case coverage for the Fainto web-companion RENDER + DATA core
// (web/dashboard-core.js). Companion to tests/dashboard-core.test.mjs — this file deliberately
// covers ground the base suite does NOT: empty-bundle rendering, pagination boundaries + the page
// clamp, foreign-badge null/case edges, ambiguous & out-of-range date recovery, money-format
// extremes, XSS escaping of every user-supplied string, icon precedence/fallbacks, more CSV edge
// cases, and sort stability under ties.
//
// Runner: `node --test` — zero npm dependencies, same loader/harness as the base suite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, fakeRoot, rowDesc } from './helpers/load-core.mjs';

const F = loadCore();
const T = F.__test;

function tx(raw) { return T.sanitizeTransaction(raw); }
function row(raw, currency = 'PLN', interactive = false) {
  return T.txRowHtml(tx(raw), currency, interactive);
}
const EXPENSE = { timestampMillis: 1780000000000, type: 'EXPENSE', amount: 10, category: 'FOOD' };

// Unique path signatures from ICON_PATHS, to prove which glyph a row actually rendered.
const CIRCLE_SIG = '<circle cx="12" cy="12" r="10" />';   // the OTHER fallback
const DOG_SIG = 'M11.25 16.25';                           // iconKey 'pet'
const UTENSILS_SIG = 'M3 2v7c0 1.1';                      // category FOOD default

// TX_PAGE_SIZE is not exported from the core; mirror the constant (also fixed in CLAUDE.md) and the
// exact page-clamp arithmetic from wireTransactionsSection.refresh(). That refresh() is DOM-bound
// (it queries #txRows/#txPrev/… which the headless fakeRoot returns null for, so it early-returns),
// so we verify the pure page-slice + clamp contract it depends on.
const TX_PAGE_SIZE = 25;
function pageOf(list, page, size = TX_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(list.length / size));
  let p = page;
  if (p >= totalPages) p = totalPages - 1;   // clamp down when the current page fell off the end
  if (p < 0) p = 0;
  const start = p * size;
  return { page: p, totalPages, items: list.slice(start, start + size) };
}

/* ========================================================================================
 * EMPTY BUNDLE — every section renders its empty state, nothing throws
 * ====================================================================================== */

test('sanitizeBundle({}) yields a well-formed, fully-empty bundle', () => {
  const b = F.sanitizeBundle({});
  assert.equal(b.transactions.length, 0);
  assert.equal(b.netWorth.assets.length, 0);
  assert.equal(b.netWorth.liabilities.length, 0);
  assert.equal(b.bills.length, 0);
  assert.equal(b.budgets.length, 0);
  assert.equal(b.financialProfile.currency, 'PLN');   // default currency still applied
});

test('empty bundle: renderDashboard builds every section headless and shows the empty state, no throw', () => {
  // NB: isBundleEmpty() itself lives in app.html's inline glue, not the core, so it is exercised
  // through renderDashboard here rather than called directly.
  const root = fakeRoot();
  const empty = F.sanitizeBundle({});
  assert.doesNotThrow(() => F.renderDashboard(root, empty, { interactive: false }));
  assert.match(root.innerHTML, /No accounts yet\./);
  assert.match(root.innerHTML, /No bills or subscriptions yet\./);
  assert.match(root.innerHTML, /No budgets set\./);
  assert.match(root.innerHTML, /id="sec-transactions"/);   // section shell present even with 0 rows
  assert.match(root.innerHTML, /PLN\s*0\.00/);             // net worth renders as zero, not NaN
});

/* ========================================================================================
 * PAGINATION — TX_PAGE_SIZE boundary + the "shrink below current page" clamp
 * ====================================================================================== */

function manyTxns(n) {
  const list = [];
  for (let i = 0; i < n; i += 1) {
    list.push(tx({ timestampMillis: 1780000000000 + i * 1000, type: 'EXPENSE', amount: i + 1, category: 'FOOD', note: 'n' + i }));
  }
  return list;
}

test('pagination: 26 transactions split into a full page of 25 + a page of 1', () => {
  const sorted = T.txFilterSort(manyTxns(26), { query: '', sort: 'newest', page: 0 });
  assert.equal(sorted.length, 26);
  const p0 = pageOf(sorted, 0);
  const p1 = pageOf(sorted, 1);
  assert.equal(p0.totalPages, 2);
  assert.equal(p0.items.length, 25);
  assert.equal(p1.items.length, 1);
  // The two pages together are the whole list, in order, with no overlap.
  assert.deepEqual(p0.items.concat(p1.items).map((t) => t.note), sorted.map((t) => t.note));
  // Asking for a page past the end clamps to the last page.
  assert.equal(pageOf(sorted, 5).page, 1);
});

test('pagination: exactly 25 transactions is a single page (boundary, no phantom 2nd page)', () => {
  const sorted = T.txFilterSort(manyTxns(25), { query: '', sort: 'newest' });
  assert.equal(pageOf(sorted, 0).totalPages, 1);
  assert.equal(pageOf(sorted, 0).items.length, 25);
  assert.equal(pageOf(sorted, 1).page, 0);   // no 2nd page to move to
});

test('pagination: a filter that shrinks results below the current page clamps the page index down', () => {
  const all = manyTxns(30);
  // On page 1 (the second page) of 30 rows, then the user types a query that leaves only a handful.
  const filtered = T.txFilterSort(all, { query: 'n2', sort: 'newest' });   // n2, n20..n29 → 11 rows
  assert.equal(filtered.length, 11);
  assert.ok(filtered.length < TX_PAGE_SIZE);
  const p = pageOf(filtered, 1);           // caller was on page index 1
  assert.equal(p.totalPages, 1);
  assert.equal(p.page, 0);                 // clamped back to the only page
  assert.equal(p.items.length, 11);        // and shows all matches, none dropped
});

/* ========================================================================================
 * SINGLE-TRANSACTION DELETE GUARD (dashTxCount <= 1)
 * ====================================================================================== */

// The "can't delete your only synced transaction" guard is page glue in web/app.html
// (isBundleEmpty + the `dashTxCount <= 1` check in the delete handler), NOT part of the exported
// render core, so there is no core-level surface to assert against here. Skipped intentionally.
test('single-transaction delete guard (dashTxCount<=1) is app.html glue, not exposed by the core',
  { skip: 'guard lives in web/app.html inline script; nothing on window.FaintoDashboard to test' },
  () => {});

/* ========================================================================================
 * FOREIGN-CURRENCY BADGE — null amount + case-insensitive currency compare
 * ====================================================================================== */

test('no foreign badge when foreignAmount is null (no foreign leg at all)', () => {
  const html = row({ ...EXPENSE, foreignCurrency: 'USD' }, 'PLN');   // foreignAmount defaults to null
  assert.doesNotMatch(html, /class="badge"/);
});

test('foreign badge compare is case-insensitive: a lowercase code equal to the display currency stays hidden', () => {
  const html = row({ ...EXPENSE, foreignAmount: 12.5, foreignCurrency: 'pln' }, 'PLN');
  assert.doesNotMatch(html, /class="badge"/);
});

test('foreign badge shows for a case-differing foreign code and prints the code verbatim', () => {
  const html = row({ ...EXPENSE, foreignAmount: 12.5, foreignCurrency: 'eur' }, 'PLN');
  assert.match(html, /class="badge">12\.50 eur</);   // display keeps the original case; only the compare is folded
});

/* ========================================================================================
 * DATE RECOVERY FROM NOTE — ambiguous dates, other separators, out-of-range years
 * ====================================================================================== */

test('garbage timestamp + a fully-ambiguous DD-MM note recovers day-first and drops the note', () => {
  // 05-06-2026: both fields ≤ 12, so nothing disambiguates → app-locale day-first (day 5, month June).
  const t = tx({ timestampMillis: -6.1e13, type: 'EXPENSE', amount: 5, category: 'FOOD', note: '05-06-2026' });
  const d = new Date(t.timestampMillis);            // csvDateMs builds at local noon → local getters are TZ-safe
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 5);                    // June
  assert.equal(d.getDate(), 5);                     // day-first
  assert.equal(t.note, '');                         // the date note was consumed, not duplicated
  assert.match(rowDesc(T.txRowHtml(t, 'PLN', false)), /2026/);
});

test('garbage timestamp + dotted and slashed note dates are recovered too', () => {
  const dotted = tx({ timestampMillis: -6.1e13, type: 'EXPENSE', amount: 5, category: 'FOOD', note: '29.05.2026' });
  assert.equal(new Date(dotted.timestampMillis).getFullYear(), 2026);
  assert.equal(dotted.note, '');
  const slashed = tx({ timestampMillis: -6.1e13, type: 'EXPENSE', amount: 5, category: 'FOOD', note: '2026/05/29' });
  assert.equal(new Date(slashed.timestampMillis).getFullYear(), 2026);
  assert.equal(slashed.note, '');
});

test('EDGE: an out-of-range-year note is kept as the note, not silently lost', () => {
  // parseLooseDate accepts any 4-digit year (csvDateMs range-checks only month/day), so 1850 parses.
  // But 1850 is outside the sane window (isSaneTs 2000..2100): the guard refuses to move an insane
  // recovered date into the timestamp, so the note is preserved and still renders — no data loss.
  const t = tx({ timestampMillis: -6.1e13, type: 'EXPENSE', amount: 5, category: 'FOOD', note: '29-05-1850' });
  assert.equal(T.isSaneTs(t.timestampMillis), false);              // timestamp left untouched (still insane)
  assert.equal(t.note, '29-05-1850');                             // note preserved, not consumed
  assert.match(rowDesc(T.txRowHtml(t, 'PLN', false)), /1850/);     // it still renders in the row
});

test('parseLooseDate on a fully-ambiguous DD-MM-YYYY resolves day-first (both fields in range)', () => {
  const d = new Date(T.parseLooseDate('05-06-2026'));
  assert.equal(d.getDate(), 5);      // first field is the day
  assert.equal(d.getMonth(), 5);     // second field is the month (June)
});

/* ========================================================================================
 * MONEY FORMATTING — zero, negative, millions grouping, non-integer, EUR/USD/PLN
 * ====================================================================================== */

test('formatMoney: zero, negative, millions grouping and non-integer cents (en-US locale)', () => {
  assert.match(F.formatMoney(0, 'PLN'), /0\.00/);
  assert.match(F.formatMoney(-1234.5, 'USD'), /-\$1,234\.50/);       // standard minus sign, grouped
  assert.match(F.formatMoney(1234567.89, 'PLN'), /1,234,567\.89/);   // thousands grouped both times
  assert.match(F.formatMoney(1234.5, 'PLN'), /1,234\.50/);           // trailing cents padded
});

test('formatMoney: € and $ symbols, PLN as a currency-code prefix (no symbol in en-US)', () => {
  assert.match(F.formatMoney(90, 'EUR'), /€90\.00/);
  assert.match(F.formatMoney(90, 'USD'), /\$90\.00/);
  const pln = F.formatMoney(90, 'PLN');
  assert.match(pln, /PLN/);
  assert.match(pln, /90\.00/);
});

/* ========================================================================================
 * XSS — every user-supplied string is HTML-escaped in the rendered markup
 * ====================================================================================== */

test('buildRow escapes a malicious row name (row-name is never raw HTML)', () => {
  const html = T.buildRow({ name: '<img src=x onerror=alert(1)>', color: 'var(--green)', amountHtml: '0' });
  assert.match(html, /class="row-name">&lt;img src=x/);
  assert.doesNotMatch(html, /<img src=x/);
});

test('txRowHtml escapes a malicious category label', () => {
  const html = row({ ...EXPENSE, category: '<b>x</b>' }, 'PLN');
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
});

test('renderDashboard escapes a malicious account name end-to-end', () => {
  const bundle = F.sanitizeBundle({ netWorth: { assets: [{ name: '<script>alert(1)</script>', category: 'CASH', value: 100 }], liabilities: [] } });
  const root = fakeRoot();
  F.renderDashboard(root, bundle, {});
  assert.match(root.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(root.innerHTML, /<script>alert\(1\)/);
});

/* ========================================================================================
 * ICON RESOLUTION — override precedence, unknown-key fallback, unknown-category OTHER
 * ====================================================================================== */

test('icon precedence: a valid iconKey overrides the category default glyph', () => {
  const html = row({ ...EXPENSE, category: 'FOOD', iconKey: 'pet' }, 'PLN');
  assert.ok(html.includes(DOG_SIG));            // rendered the dog, not the food utensils
  assert.ok(!html.includes(UTENSILS_SIG));
});

test('icon fallback: an unknown iconKey falls back to the category default icon', () => {
  const html = row({ ...EXPENSE, category: 'FOOD', iconKey: 'not-a-real-key' }, 'PLN');
  assert.ok(html.includes(UTENSILS_SIG));       // back to FOOD's default
  assert.ok(!html.includes(DOG_SIG));
});

test('icon fallback: an unknown category resolves to OTHER and renders the circle glyph', () => {
  assert.equal(F.catMeta('NOT_A_CATEGORY').icon, 'circle');
  assert.equal(F.catMeta('NOT_A_CATEGORY').label, 'Other');
  const html = row({ ...EXPENSE, category: 'NOT_A_CATEGORY' }, 'PLN');
  assert.ok(html.includes(CIRCLE_SIG));
});

test('iconKeySvg: a known key returns its glyph, an unknown key returns the circle', () => {
  assert.ok(F.iconKeySvg('pet').includes(DOG_SIG));
  assert.ok(F.iconKeySvg('totally-unknown').includes(CIRCLE_SIG));
});

/* ========================================================================================
 * CSV IMPORT — empty/header-only, mixed valid+invalid counts, thousands separators
 * ====================================================================================== */

test('CSV import: an empty file and a header-only file both return a friendly error, never a throw', () => {
  const empty = F.parseCsvToBundle('');
  assert.ok(empty.error);
  assert.equal(empty.bundle, undefined);
  const headerOnly = F.parseCsvToBundle('Date,Amount');
  assert.ok(headerOnly.error);
  assert.equal(headerOnly.bundle, undefined);
  const headerNewline = F.parseCsvToBundle('Date,Amount\n');   // blank data line is filtered out
  assert.ok(headerNewline.error);
});

test('CSV import: mixed valid/invalid rows report exact imported and skipped counts', () => {
  const csv = [
    'Date,Description,Amount',
    '01-06-2026,A,-10',
    '02-06-2026,B,20',
    'garbage,C,-5',      // unparseable date → skipped
    '03-06-2026,D,-30',
    '04-06-2026,E,40',
    ',F,',               // empty date + amount → skipped
  ].join('\n');
  const res = F.parseCsvToBundle(csv);
  assert.ok(res.bundle, res.error);
  assert.equal(res.imported, 4);
  assert.equal(res.skipped, 2);
  assert.equal(res.bundle.transactions.length, 4);
});

test('CSV import: quoted thousands separators parse in both US (1,234,567.89) and EU (1.234.567,89) form', () => {
  const csv = [
    'Date,Description,Amount,Currency',
    '01-06-2026,US,"1,234,567.89",USD',
    '02-06-2026,EU,"1.234.567,89",EUR',
  ].join('\n');
  const res = F.parseCsvToBundle(csv);
  assert.ok(res.bundle, res.error);
  assert.equal(res.imported, 2);
  const [us, eu] = res.bundle.transactions;
  assert.equal(us.amount, 1234567.89);
  assert.equal(eu.amount, 1234567.89);
});

/* ========================================================================================
 * SORT STABILITY — ties keep original insertion order across all four sort orders
 * ====================================================================================== */

test('sort is stable across all four orders when the sort key ties', () => {
  // Equal amounts but DELIBERATELY non-monotonic timestamps, so a stable amount-sort must keep
  // insertion order A,B,C — not silently fall back to a timestamp tiebreak.
  const ties = [
    tx({ timestampMillis: 1780000009000, type: 'EXPENSE', amount: 50, category: 'FOOD', note: 'A' }),
    tx({ timestampMillis: 1780000001000, type: 'EXPENSE', amount: 50, category: 'FOOD', note: 'B' }),
    tx({ timestampMillis: 1780000005000, type: 'EXPENSE', amount: 50, category: 'FOOD', note: 'C' }),
  ];
  assert.deepEqual(T.txFilterSort(ties, { query: '', sort: 'amount-desc' }).map((t) => t.note), ['A', 'B', 'C']);
  assert.deepEqual(T.txFilterSort(ties, { query: '', sort: 'amount-asc' }).map((t) => t.note), ['A', 'B', 'C']);

  // Equal timestamps, distinct amounts → the timestamp sorts (newest/oldest) tie and must keep order.
  const tsTies = [
    tx({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 3, category: 'FOOD', note: 'A' }),
    tx({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 1, category: 'FOOD', note: 'B' }),
    tx({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 2, category: 'FOOD', note: 'C' }),
  ];
  assert.deepEqual(T.txFilterSort(tsTies, { query: '', sort: 'newest' }).map((t) => t.note), ['A', 'B', 'C']);
  assert.deepEqual(T.txFilterSort(tsTies, { query: '', sort: 'oldest' }).map((t) => t.note), ['A', 'B', 'C']);
});
