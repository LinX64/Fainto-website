// Zero-dependency loader for web/dashboard-core.js.
//
// dashboard-core.js is a browser IIFE that attaches window.FaintoDashboard. We run it inside a
// node:vm context with a tiny window/navigator shim so its pure logic (sanitize, CSV import,
// formatting, row HTML) can be exercised from `node --test` with NO npm packages, no jsdom,
// no build step — matching the repo's "no dependencies" law (see CLAUDE.md).

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CORE_PATH = path.resolve(here, '../../web/dashboard-core.js');

// Load a fresh, isolated instance of the render core.
export function loadCore({ language = 'en-US' } = {}) {
  const src = fs.readFileSync(CORE_PATH, 'utf8');
  const sandbox = {
    // matchMedia(matches:true) forces revealMotion's reduced-motion branch → fully synchronous,
    // so no timers are scheduled during a headless render.
    window: { matchMedia: () => ({ matches: true }) },
    navigator: { language },
    Intl, Date, console,
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0; },
    clearTimeout: () => {},
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  if (!sandbox.window.FaintoDashboard) {
    throw new Error('dashboard-core.js did not attach window.FaintoDashboard');
  }
  return sandbox.window.FaintoDashboard;
}

// Minimal element good enough for renderDashboard() to run headless and capture its markup.
// renderDashboard sets rootEl.innerHTML then wires via querySelector*, which we no-op — the
// section markup we assert on is already in innerHTML at that point.
export function fakeRoot() {
  return {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
}

// Pull the .row-desc subtitle text out of a txRowHtml() string.
export function rowDesc(html) {
  const m = html.match(/class="row-desc">([^<]*)</);
  return m ? m[1] : null;
}
