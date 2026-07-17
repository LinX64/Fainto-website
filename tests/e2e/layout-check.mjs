// tests/e2e/layout-check.mjs — browser layout/overflow regression check for the signed-in
// web dashboard. Zero npm deps: a tiny built-in static server + the system Chrome in headless
// --dump-dom mode. Renders the REAL app.html <style> + the REAL web/dashboard-core.js over HTTP
// (so Lexend metrics are correct) with a representative sample bundle, then asserts nothing
// overflows its card or the viewport at desktop widths.
//
//   node tests/e2e/layout-check.mjs
//
// Exits 0 on pass / when Chrome is absent (skips gracefully), non-zero on a real overflow.
// Guards the 2026-07-17 regression: transaction rows spilling past the card + the amount
// colliding with Edit/Delete in the two-column list, and the widened desktop shell.

import { readFile } from 'node:fs/promises';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WIDTHS = [768, 1024, 1280, 1440]; // desktop only — headless clamps < ~500px; the <760 stack is CSS-trivial
const PROBE_PATH = join(ROOT, 'web', '__probe.html'); // gitignored name; created + removed by this script

function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

// A representative signed-in bundle: many "Other" PLN expenses (the reported screenshot),
// a few accounts + bills, so every card and the two-column transaction list render.
function sampleBundle() {
  const JAN = 1767225600000; // 2026-01-01
  const day = (d) => JAN + Math.round((181 + d) * 86400000);
  const amts = [8518.15, 50, 2996.01, 77.70, 12.99, 35.80, 23.50, 39.99, 11, 8, 17.56, 8, 3, 50, 120, 4200, 62.40, 9.99];
  const transactions = amts.map((a, i) => ({
    timestampMillis: day(16 - i), type: 'EXPENSE', amount: a, category: 'OTHER',
    note: i === 0 ? '03-01-2026' : '',
  }));
  return {
    financialProfile: { currency: 'PLN', fullName: 'Alex Kowalski' },
    netWorth: {
      assets: [
        { name: 'mBank Personal', category: 'CASH', value: 42180.55 },
        { name: 'Revolut', category: 'CASH', value: 8900 },
        { name: 'IKZE Brokerage', category: 'INVESTMENT', value: 56320.10 },
        { name: 'Emergency Fund', category: 'SAVINGS', value: 15000 },
      ],
      liabilities: [
        { name: 'Visa Credit', category: 'DEBT', value: 6240 },
        { name: 'Car Loan', category: 'DEBT', value: 18900 },
      ],
    },
    recurringPayments: [
      { name: 'Rent', amount: 4200, cadence: 'MONTHLY', anchorEpochDay: 20640 },
      { name: 'Gym', amount: 129, cadence: 'MONTHLY', anchorEpochDay: 20645 },
      { name: 'Electricity', amount: 210, cadence: 'MONTHLY', anchorEpochDay: 20650 },
    ],
    subscriptions: [
      { name: 'Netflix', amount: 43, cadence: 'MONTHLY', monthlyEquivalent: 43, lastDateMillis: day(1) },
    ],
    transactions,
  };
}

async function buildProbe() {
  const app = await readFile(join(ROOT, 'web', 'app.html'), 'utf8');
  const styles = [...app.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const bundle = JSON.stringify(sampleBundle());
  const html = `<!DOCTYPE html><html lang="en" data-theme="dark" data-view="account"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>probe</title>
<style>${styles}\nbody{background:var(--bg)}</style></head><body>
<div class="page"><section class="gate-card account-panel" id="panel-account" tabindex="-1">
<div class="account-head"><h2>Your account</h2><p class="account-sub">Signed in</p></div>
<div id="accountDash" class="account-dash" aria-live="polite"></div>
<form id="expenseForm" novalidate><div class="field"><label>Note</label><input type="text"></div>
<button type="submit" class="btn btn-primary">Add &amp; sync</button></form>
</section></div>
<script src="/web/dashboard-core.js"></script>
<script>
  var de = document.documentElement;
  try {
  var clean = window.FaintoDashboard.sanitizeBundle(${bundle});
  window.FaintoDashboard.renderDashboard(document.getElementById('accountDash'), clean,
    { interactive: true, animate: false, omitSections: ['budgets'], currency: 'PLN' });
  var fails = [];
  if (de.scrollWidth > de.clientWidth + 1) fails.push('page-hscroll ' + de.scrollWidth + '>' + de.clientWidth);
  document.querySelectorAll('.card').forEach(function (c) {
    if (c.scrollWidth > c.clientWidth + 1) fails.push((c.id || 'card') + '-scroll ' + c.scrollWidth + '>' + c.clientWidth);
    var cb = c.getBoundingClientRect();
    c.querySelectorAll('.row').forEach(function (r) {
      if (r.offsetParent === null) return;                       // display:none .row-extra
      var rb = r.getBoundingClientRect();
      if (rb.width === 0 && rb.height === 0) return;
      if (rb.right > cb.right + 1) fails.push((c.id || 'card') + '-row-right');
      if (rb.left < cb.left - 1) fails.push((c.id || 'card') + '-row-left');
    });
  });
  de.setAttribute('data-probe', fails.length ? ('FAIL ' + fails.join(' | ')) : 'OK');
  } catch (e) { de.setAttribute('data-probe', 'ERR ' + (e && e.message || e)); }
<\/script></body></html>`;
  writeFileSync(PROBE_PATH, html);
}

// Serve the repo with python3's http.server (already a project dependency; a hand-rolled node
// server proved flaky under headless Chrome's load-wait). Returns { proc, port }.
async function startServer() {
  const port = 8100 + Math.floor((Date.now() % 800));
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
    { cwd: ROOT, stdio: 'ignore' });
  // wait until it answers
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/web/dashboard-core.js`, { method: 'HEAD' });
      if (r.ok) return { proc, port };
    } catch {}
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error('python http.server did not come up on port ' + port);
}

function probeAt(chrome, url, w) {
  // Unique --user-data-dir per launch: without it, concurrent Chrome instances (e.g. another
  // headless run) deadlock on the default-profile singleton lock and time out.
  const profile = mkdtempSync(join(tmpdir(), 'fainto-e2e-'));
  try {
    const r = spawnSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      `--user-data-dir=${profile}`, '--force-device-scale-factor=1', '--virtual-time-budget=4000',
      `--window-size=${w},1400`, '--dump-dom', url,
    ], { encoding: 'utf8', timeout: 40000 });
    const dom = (r.stdout || '') + (r.stderr || '');
    const m = dom.match(/data-probe="([^"]*)"/);
    return m ? m[1] : 'MISSING (dashboard did not render / probe attr absent)';
  } finally {
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  const chrome = findChrome();
  if (!chrome) { console.log('SKIP layout-check: no Chrome binary found (set CHROME=/path to enable).'); process.exit(0); }
  await buildProbe();
  const { proc, port } = await startServer();
  const url = `http://127.0.0.1:${port}/web/__probe.html`;
  let failed = 0;
  try {
    for (const w of WIDTHS) {
      const result = probeAt(chrome, url, w);
      const ok = result === 'OK';
      if (!ok) failed++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(w).padStart(4)}px  ${result}`);
    }
  } finally {
    try { proc.kill('SIGKILL'); } catch {}
    try { unlinkSync(PROBE_PATH); } catch {}
  }
  if (failed) { console.error(`\nlayout-check: ${failed}/${WIDTHS.length} widths overflowed.`); process.exit(1); }
  console.log(`\nlayout-check: all ${WIDTHS.length} desktop widths clean — no overflow.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
