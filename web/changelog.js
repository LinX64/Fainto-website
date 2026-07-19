/* Fainto web companion — "What's new" dialog.
 *
 * Mirrors the Android release-notes dialog (feature/dashboard ReleaseNotesDialog.kt +
 * ReleaseNotes.kt): a titled sheet of emoji-led highlights for the newest version, shown
 * once per version and dismissed with "Got it".
 *
 * Android gates on a DataStore int `release_notes_seen_version_code`; the web has no
 * DataStore, so we persist the newest seen version STRING in localStorage under
 * `fainto_web_release_notes_seen`. Same contract: seen < newest -> show.
 *
 * Vanilla, zero-dependency, first-party only — loaded by app.html and dashboard.html.
 */
(function () {
  'use strict';

  var SEEN_KEY = 'fainto_web_release_notes_seen';

  /* Newest FIRST. Every line here must describe something actually shipped on the web
   * companion — this dialog is a changelog, not a marketing surface. */
  var RELEASES = [
    {
      version: '1.2.0',
      date: '2026-07-18',
      highlights: [
        '🖥️ Dashboard now uses the full width of a desktop screen',
        '📅 Transaction dates read correctly again — no more "Nov 13, 36"',
        '🏷️ The duplicate foreign-currency badge is gone',
        '🔌 Header buttons match your real state — no "Disconnect" when signed out',
      ],
    },
    {
      version: '1.1.0',
      date: '2026-07-17',
      highlights: [
        '🎨 Visual category picker with per-transaction icon overrides',
        '✏️ Add, edit and delete transactions straight from the browser',
        '📊 CSV bank import, synced back to your phone',
        '🔒 Stay signed in — no sign-in card flash on return visits',
        '🌓 Light/dark theme toggle on every page',
      ],
    },
    {
      version: '1.0.0',
      date: '2026-07-16',
      highlights: [
        '🔗 Connect to Web — stream your data to a browser over Wi-Fi',
        '📱 Pair by QR code — the transferred snapshot is checked with a SHA-256 hash',
        '👤 Sign in with a Fainto account to sync across devices',
        '📂 Offline viewer — open an export or bank CSV, read entirely in this browser',
      ],
    },
  ];

  var STYLE_ID = 'fainto-changelog-style';
  var CSS = [
    '.cl-dialog{border:1px solid var(--line);border-radius:28px;background:var(--surface);color:var(--text);',
    'padding:0;width:min(92vw,440px);max-height:min(80vh,640px);box-shadow:0 24px 64px rgba(0,0,0,0.28);font:inherit;',
    /* The dialog itself must never scroll — only .cl-body does. Without this both scroll
     * and the sheet shows two stacked scrollbars. */
    'overflow:hidden}',
    '.cl-dialog::backdrop{background:rgba(0,0,0,0.5)}',
    '.cl-inner{display:flex;flex-direction:column;max-height:min(80vh,640px)}',
    '.cl-head{padding:var(--sp-4) var(--sp-4) var(--sp-2);flex:0 0 auto}',
    '.cl-title{margin:0;font-size:22px;font-weight:600;letter-spacing:-0.01em}',
    '.cl-ver{margin:var(--sp-1) 0 0;font-size:13px;font-weight:600;color:var(--muted);letter-spacing:0.02em}',
    '.cl-body{padding:0 var(--sp-4);overflow-y:auto;flex:1 1 auto}',
    '.cl-list{list-style:none;margin:0;padding:0}',
    '.cl-item{display:flex;gap:var(--sp-2);align-items:flex-start;padding:var(--sp-2) 0;',
    'border-bottom:1px solid var(--line);font-size:15px;line-height:1.5}',
    '.cl-item:last-child{border-bottom:0}',
    '.cl-emoji{flex:0 0 auto;font-size:18px;line-height:1.4}',
    '.cl-past{margin:var(--sp-3) 0 0;padding:0;border:0}',
    '.cl-past-sum{cursor:pointer;font-size:13px;font-weight:600;color:var(--muted);padding:var(--sp-1) 0;list-style:none}',
    '.cl-past-sum::-webkit-details-marker{display:none}',
    '.cl-past-sum::before{content:"▸";display:inline-block;width:14px;font-size:11px}',
    '.cl-past[open] .cl-past-sum::before{content:"▾"}',
    '.cl-past-sum:hover{color:var(--text)}',
    '.cl-past-ver{margin:var(--sp-2) 0 var(--sp-1);font-size:13px;font-weight:600;color:var(--muted)}',
    '.cl-foot{padding:var(--sp-2) var(--sp-4) var(--sp-4);flex:0 0 auto}',
    '.cl-got{width:100%;min-height:48px;border:0;border-radius:999px;background:var(--chrome);color:var(--on-chrome);',
    'font:inherit;font-size:15px;font-weight:600;cursor:pointer;transition:opacity 150ms var(--ease-std)}',
    '.cl-got:hover{opacity:0.88}',
    '.cl-got:focus-visible,.cl-past-sum:focus-visible{outline:2px solid var(--acc-brand);outline-offset:2px}',
    '@keyframes cl-enter{from{opacity:0;transform:translateY(8px) scale(.98)}}',
    '@media (prefers-reduced-motion:no-preference){.cl-dialog[open]{animation:cl-enter 220ms var(--ease-std)}}',
    '@media (prefers-reduced-motion:reduce){.cl-dialog{animation:none}}',
  ].join('');

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function readSeen() {
    try { return localStorage.getItem(SEEN_KEY); } catch (e) { return null; }
  }

  function writeSeen(version) {
    try { localStorage.setItem(SEEN_KEY, version); } catch (e) { /* storage unavailable */ }
  }

  /* Numeric-segment compare so '1.10.0' sorts above '1.9.0' (a plain string compare would not). */
  function compareVersions(a, b) {
    var pa = String(a).split('.');
    var pb = String(b).split('.');
    var len = Math.max(pa.length, pb.length);
    for (var i = 0; i < len; i++) {
      var na = parseInt(pa[i], 10) || 0;
      var nb = parseInt(pb[i], 10) || 0;
      if (na !== nb) return na - nb;
    }
    return 0;
  }

  /* The highlight strings are authored in THIS file, never user input, but they still go
   * through textContent (never innerHTML) so the dialog can never become an XSS surface. */
  function highlightItem(text) {
    var li = document.createElement('li');
    li.className = 'cl-item';
    var chars = Array.from(text);
    var split = 0;
    while (split < chars.length && chars[split] !== ' ') split++;
    var emoji = document.createElement('span');
    emoji.className = 'cl-emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = chars.slice(0, split).join('');
    var label = document.createElement('span');
    label.textContent = chars.slice(split + 1).join('');
    li.appendChild(emoji);
    li.appendChild(label);
    return li;
  }

  function formatDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    try {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  function buildDialog() {
    var latest = RELEASES[0];
    var dlg = document.createElement('dialog');
    dlg.className = 'cl-dialog';
    dlg.setAttribute('aria-labelledby', 'clTitle');

    var inner = document.createElement('div');
    inner.className = 'cl-inner';

    var head = document.createElement('div');
    head.className = 'cl-head';
    var h2 = document.createElement('h2');
    h2.className = 'cl-title';
    h2.id = 'clTitle';
    h2.textContent = "What's new in Fainto";
    var ver = document.createElement('p');
    ver.className = 'cl-ver';
    ver.textContent = 'Version ' + latest.version + ' · ' + formatDate(latest.date);
    head.appendChild(h2);
    head.appendChild(ver);

    var body = document.createElement('div');
    body.className = 'cl-body';
    var list = document.createElement('ul');
    list.className = 'cl-list';
    latest.highlights.forEach(function (h) { list.appendChild(highlightItem(h)); });
    body.appendChild(list);

    if (RELEASES.length > 1) {
      var past = document.createElement('details');
      past.className = 'cl-past';
      var sum = document.createElement('summary');
      sum.className = 'cl-past-sum';
      sum.textContent = 'Earlier versions';
      past.appendChild(sum);
      RELEASES.slice(1).forEach(function (rel) {
        var label = document.createElement('p');
        label.className = 'cl-past-ver';
        label.textContent = 'Version ' + rel.version + ' · ' + formatDate(rel.date);
        var ul = document.createElement('ul');
        ul.className = 'cl-list';
        rel.highlights.forEach(function (h) { ul.appendChild(highlightItem(h)); });
        past.appendChild(label);
        past.appendChild(ul);
      });
      body.appendChild(past);
    }

    var foot = document.createElement('div');
    foot.className = 'cl-foot';
    var got = document.createElement('button');
    got.className = 'cl-got';
    got.type = 'button';
    got.textContent = 'Got it';
    foot.appendChild(got);

    inner.appendChild(head);
    inner.appendChild(body);
    inner.appendChild(foot);
    dlg.appendChild(inner);

    function dismiss() {
      writeSeen(latest.version);
      // Without <dialog> support this is an HTMLUnknownElement: no .open, no .close(). Hide
      // it directly so "Got it" still works instead of silently doing nothing.
      if (typeof dlg.close === 'function') {
        if (dlg.open) dlg.close();
      } else {
        dlg.removeAttribute('open');
        dlg.style.display = 'none';
      }
    }
    got.addEventListener('click', dismiss);
    // Esc closes natively; mark it seen so it does not reappear on the next load.
    dlg.addEventListener('close', function () { writeSeen(latest.version); });
    // Click on the backdrop (the dialog element itself, outside .cl-inner) closes.
    dlg.addEventListener('click', function (evt) { if (evt.target === dlg) dismiss(); });

    return dlg;
  }

  var dialogEl = null;

  function ensureDialog() {
    if (dialogEl && dialogEl.isConnected) return dialogEl;
    injectStyle();
    dialogEl = buildDialog();
    document.body.appendChild(dialogEl);
    return dialogEl;
  }

  function open() {
    var dlg = ensureDialog();
    if (dlg.open) return;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', ''); // no <dialog> support: still readable, still dismissible
    var got = dlg.querySelector('.cl-got');
    if (got) got.focus();
  }

  /* Show only when the newest version has not been seen. A brand-new visitor has no
   * stored version, which mirrors Android's `seen = 0` default: they see it once. */
  function maybeShow() {
    if (!RELEASES.length) return false;
    var seen = readSeen();
    if (seen && compareVersions(seen, RELEASES[0].version) >= 0) return false;
    open();
    return true;
  }

  window.FaintoChangelog = {
    RELEASES: RELEASES,
    open: open,
    maybeShow: maybeShow,
    latestVersion: RELEASES.length ? RELEASES[0].version : null,
    __compareVersions: compareVersions,
  };
}());
