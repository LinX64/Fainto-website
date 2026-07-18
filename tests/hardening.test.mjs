// Regression tests for the 2026-07-18 hardening pass on web/dashboard-core.js.
//
// Each test here pins a defect that was found by auditing the signed-in web journey and
// confirmed against the real code before it was fixed. They are deliberately narrow: they
// assert the specific bad output the old code produced can no longer be produced.
//
// Runner: `node --test` — zero npm dependencies, same loader as the other suites.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, fakeRoot } from './helpers/load-core.mjs';

const F = loadCore();
const T = F.__test;

// --- currency is the one bundle field that reaches innerHTML unescaped -------------------
// formatMoney() falls back to `value + ' ' + currency` whenever Intl rejects the code, and
// every caller injects that string straight into innerHTML. An export carrying markup in
// `currency` therefore used to become live HTML on a page whose CSP allows unsafe-inline.

test('sanitizeBundle rejects a non-ISO-4217 currency instead of passing it through', () => {
  const evil = '"><img src=x onerror=alert(1)>';
  const bundle = F.sanitizeBundle({ financialProfile: { currency: evil }, transactions: [] });
  assert.equal(bundle.financialProfile.currency, 'PLN', 'hostile currency must fall back to PLN');
});

test('sanitizeBundle normalises a lowercase currency and keeps a real one', () => {
  assert.equal(F.sanitizeBundle({ financialProfile: { currency: 'eur' } }).financialProfile.currency, 'EUR');
  assert.equal(F.sanitizeBundle({ financialProfile: { currency: 'USD' } }).financialProfile.currency, 'USD');
  // Too long / too short are not currency codes either.
  assert.equal(F.sanitizeBundle({ financialProfile: { currency: 'EUROS' } }).financialProfile.currency, 'PLN');
  assert.equal(F.sanitizeBundle({ financialProfile: { currency: 'E' } }).financialProfile.currency, 'PLN');
});

test('a hostile currency cannot reach the rendered dashboard as raw markup', () => {
  const root = fakeRoot();
  F.renderDashboard(root, F.sanitizeBundle({
    financialProfile: { currency: '<script>alert(1)</script>' },
    netWorth: { assets: [{ name: 'Cash', category: 'CASH', value: 10 }] },
  }), { interactive: false });
  assert.ok(!root.innerHTML.includes('<script>alert(1)</script>'), 'no unescaped script tag');
});

// --- prototype-chain lookups ------------------------------------------------------------
// `CATS[category]` also resolves inherited Object.prototype members, so a category of
// 'constructor' returned a function instead of falling back to OTHER — which rendered
// style="background:undefined" and dropped the icon.

test('a category that collides with Object.prototype falls back to OTHER, not a function', () => {
  for (const poison of ['constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
    const html = T.txRowHtml(
      T.sanitizeTransaction({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 5, category: poison }),
      'PLN', false,
    );
    assert.ok(!html.includes('undefined'), `category '${poison}' must not emit undefined`);
  }
});

test('an iconKey that collides with Object.prototype does not resolve to a function', () => {
  const html = T.txRowHtml(
    T.sanitizeTransaction({
      timestampMillis: 1780000000000, type: 'EXPENSE', amount: 5, category: 'FOOD', iconKey: 'constructor',
    }),
    'PLN', false,
  );
  assert.ok(!html.includes('undefined'), 'poisoned iconKey must fall back, not print undefined');
});

// --- search matched the raw enum token, not the label the row prints --------------------

test('transaction search matches the visible category label, not just the raw token', () => {
  const txns = [
    T.sanitizeTransaction({ timestampMillis: 1780000000000, type: 'EXPENSE', amount: 5, category: 'EATING_OUT' }),
    T.sanitizeTransaction({ timestampMillis: 1780000001000, type: 'EXPENSE', amount: 6, category: 'TRANSPORT' }),
  ];
  const hits = T.txFilterSort(txns, { query: 'eating out', sort: 'newest' });
  assert.equal(hits.length, 1, 'the label a user can actually read must be searchable');
  assert.equal(hits[0].category, 'EATING_OUT');

  // The raw token must keep working too.
  assert.equal(T.txFilterSort(txns, { query: 'eating_out', sort: 'newest' }).length, 1);
});
