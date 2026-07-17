/*
 * dashboard-core.js — shared, first-party render core for the Fainto web dashboard.
 *
 * Pure data-sanitizing, CSV import, formatting and section-builder logic lifted
 * out of dashboard.html's inline <script>. Loaded as a PLAIN script (no ES
 * module) by both dashboard.html and app.html, each of whose CSP allows
 * script-src 'self'. Attaches a single global:
 *
 *   window.FaintoDashboard = {
 *     sanitizeBundle, resolveFromFileText, parseCsvToBundle,   // data
 *     formatMoney, formatDate,                                 // formatters
 *     renderDashboard                                          // main entry
 *   };
 *
 * Page-specific glue (theme toggle, sign-out, session resolve, empty state,
 * import notices, boot) stays inline in each page.
 */
(function () {
  'use strict';

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function asArray(v) { return Array.isArray(v) ? v : []; }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function numOrNull(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function str(v, fallback) { return (typeof v === 'string' && v.length > 0) ? v : (fallback || ''); }

  function sanitizeTransaction(raw) {
    if (!isObj(raw)) return null;
    var ts = numOrNull(raw.timestampMillis);
    if (ts === null) return null;
    var type = (raw.type === 'INCOME' || raw.type === 'EXPENSE') ? raw.type : null;
    if (!type) return null;
    var tx = {
      timestampMillis: ts,
      category: str(raw.category, 'OTHER'),
      type: type,
      amount: num(raw.amount),
      note: typeof raw.note === 'string' ? raw.note : '',
      foreignAmount: numOrNull(raw.foreignAmount),
      foreignCurrency: typeof raw.foreignCurrency === 'string' ? raw.foreignCurrency : null,
      // Stable identity carried through so interactive callers can identify a row.
      // A missing id does NOT drop the transaction.
      id: str(raw.id, ''),
    };
    if (typeof raw.__docId === 'string' && raw.__docId.length > 0) {
      tx.__docId = str(raw.__docId, '');
    }
    return tx;
  }

  function sanitizeAsset(raw) {
    if (!isObj(raw)) return null;
    return {
      name: str(raw.name, 'Untitled'),
      category: str(raw.category, 'OTHER'),
      value: num(raw.value),
    };
  }

  function sanitizeBudget(raw) {
    if (!isObj(raw)) return null;
    var period = (raw.period === 'WEEKLY' || raw.period === 'MONTHLY') ? raw.period : 'MONTHLY';
    return {
      category: str(raw.category, 'OTHER'),
      limitAmount: num(raw.limitAmount),
      period: period,
      type: str(raw.type, 'STANDARD'),
    };
  }

  function sanitizeRecurring(raw) {
    if (!isObj(raw)) return null;
    if (raw.archived === true) return null;
    return {
      kind: 'recurring',
      name: str(raw.name, 'Untitled'),
      amount: num(raw.amount),
      cadence: str(raw.cadence, 'MONTHLY'),
      category: typeof raw.category === 'string' ? raw.category : null,
      anchorEpochDay: numOrNull(raw.anchorEpochDay),
      currency: typeof raw.currency === 'string' ? raw.currency : null,
    };
  }

  function sanitizeSubscription(raw) {
    if (!isObj(raw)) return null;
    var name = str(raw.name, '') || str(raw.merchant, 'Untitled');
    return {
      kind: 'subscription',
      name: name,
      amount: num(raw.amount),
      cadence: str(raw.cadence, 'MONTHLY'),
      category: typeof raw.category === 'string' ? raw.category : null,
      lastDateMillis: numOrNull(raw.lastDateMillis),
      monthlyEquivalent: numOrNull(raw.monthlyEquivalent),
      currency: typeof raw.currency === 'string' ? raw.currency : null,
    };
  }

  function sanitizeBundle(raw) {
    if (!isObj(raw)) return null;
    var fpRaw = isObj(raw.financialProfile) ? raw.financialProfile : {};
    var nwRaw = isObj(raw.netWorth) ? raw.netWorth : {};
    var financialProfile = {
      currency: str(fpRaw.currency, 'USD'),
      fullName: typeof fpRaw.fullName === 'string' ? fpRaw.fullName : '',
    };
    var transactions = asArray(raw.transactions).map(sanitizeTransaction).filter(Boolean);
    var assets = asArray(nwRaw.assets).map(sanitizeAsset).filter(Boolean);
    var liabilities = asArray(nwRaw.liabilities).map(sanitizeAsset).filter(Boolean);
    var budgets = asArray(raw.budgets).map(sanitizeBudget).filter(Boolean);
    var recurringPayments = asArray(raw.recurringPayments).map(sanitizeRecurring).filter(Boolean);
    var subscriptions = asArray(raw.subscriptions).map(sanitizeSubscription).filter(Boolean);
    return {
      financialProfile: financialProfile,
      transactions: transactions,
      netWorth: { assets: assets, liabilities: liabilities },
      budgets: budgets,
      bills: recurringPayments.concat(subscriptions),
    };
  }

  function resolveFromFileText(text) {
    try {
      var parsed = JSON.parse(text);
      return sanitizeBundle(parsed);
    } catch (e) {
      return null;
    }
  }

  /* ---- CSV import (bank exports) — parsed locally, nothing leaves the browser ---- */

  function parseCsvRows(text, delim) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    while (i < text.length) {
      var c = text.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i += 1; continue;
        }
        field += c; i += 1; continue;
      }
      if (c === '"') { inQuotes = true; i += 1; continue; }
      if (c === delim) { row.push(field); field = ''; i += 1; continue; }
      if (c === '\r' || c === '\n') {
        if (c === '\r' && text.charAt(i + 1) === '\n') i += 1;
        row.push(field); field = '';
        rows.push(row); row = [];
        i += 1; continue;
      }
      field += c; i += 1;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter(function (r) {
      return r.some(function (cell) { return String(cell).trim().length > 0; });
    });
  }

  function detectCsvDelimiter(text) {
    var candidates = [',', ';', '\t'];
    var best = null;
    candidates.forEach(function (d) {
      var rows = parseCsvRows(text, d).slice(0, 10);
      if (rows.length === 0) return;
      var counts = {};
      rows.forEach(function (r) { counts[r.length] = (counts[r.length] || 0) + 1; });
      var modeCount = 0, modeCols = 1;
      Object.keys(counts).forEach(function (k) {
        var cols = Number(k);
        if (counts[k] > modeCount || (counts[k] === modeCount && cols > modeCols)) {
          modeCount = counts[k]; modeCols = cols;
        }
      });
      if (modeCols < 2) return;
      var score = (modeCount / rows.length) * 100 + modeCols;
      if (!best || score > best.score) best = { delim: d, score: score };
    });
    return best ? best.delim : ',';
  }

  function csvDateMs(y, mo, d) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
    if (!isFinite(dt.getTime())) return null;
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt.getTime();
  }

  function parseCsvDate(s, dayFirst) {
    var raw = String(s == null ? '' : s).trim();
    if (!raw) return null;
    var m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return csvDateMs(+m[1], +m[2], +m[3]);
    m = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return csvDateMs(+m[3], +m[2], +m[1]);
    m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (m) return csvDateMs(+m[1], +m[2], +m[3]);
    m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      var y = +m[3];
      if (y < 100) y += 2000;
      return dayFirst ? csvDateMs(y, +m[2], +m[1]) : csvDateMs(y, +m[1], +m[2]);
    }
    return null;
  }

  function parseCsvAmount(s) {
    var raw = String(s == null ? '' : s).trim();
    if (!raw) return null;
    var negative = /^\(.*\)$/.test(raw) || raw.indexOf('-') !== -1;
    var cleaned = raw.replace(/[^0-9.,]/g, '');
    if (!cleaned) return null;
    var lastComma = cleaned.lastIndexOf(',');
    var lastDot = cleaned.lastIndexOf('.');
    var normalized;
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) normalized = cleaned.replace(/\./g, '').replace(/,/g, '.');
      else normalized = cleaned.replace(/,/g, '');
    } else if (lastComma !== -1) {
      var afterComma = cleaned.length - lastComma - 1;
      if (cleaned.indexOf(',') === lastComma && afterComma > 0 && afterComma <= 2) normalized = cleaned.replace(/,/g, '.');
      else normalized = cleaned.replace(/,/g, '');
    } else if (lastDot !== -1) {
      var afterDot = cleaned.length - lastDot - 1;
      if (cleaned.indexOf('.') === lastDot && afterDot > 0 && afterDot <= 2) normalized = cleaned;
      else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) normalized = cleaned.replace(/\./g, '');
      else normalized = cleaned;
    } else {
      normalized = cleaned;
    }
    var v = parseFloat(normalized);
    if (!isFinite(v)) return null;
    return negative ? -v : v;
  }

  function parseCsvToBundle(text) {
    var clean = String(text || '').replace(/^\uFEFF/, '');
    var delim = detectCsvDelimiter(clean);
    var rows = parseCsvRows(clean, delim);
    if (rows.length < 2) {
      return { error: 'The CSV file needs a header row and at least one data row.' };
    }
    var headers = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
    function findCol(re, exclude) {
      for (var i = 0; i < headers.length; i += 1) {
        if (exclude && exclude.indexOf(i) !== -1) continue;
        if (re.test(headers[i])) return i;
      }
      return -1;
    }
    var dateRe = /(date|posted|booking|time|datum|tarih|data)/;
    var dateIdx = findCol(dateRe);
    var debitIdx = findCol(/(debit|withdrawal)/, [dateIdx]);
    var creditIdx = findCol(/(credit|deposit)/, [dateIdx, debitIdx]);
    var hasDebitCredit = debitIdx !== -1 && creditIdx !== -1;
    function findAmountCol(exclude) {
      var loose = -1;
      for (var i = 0; i < headers.length; i += 1) {
        if (exclude.indexOf(i) !== -1) continue;
        if (!/(amount|value|betrag|kwota|tutar)/.test(headers[i])) continue;
        if (dateRe.test(headers[i])) continue;
        if (/^(amount|value|betrag|kwota|tutar)$/.test(headers[i])) return i;
        if (loose === -1) loose = i;
      }
      return loose;
    }
    var amountIdx = findAmountCol([dateIdx, debitIdx, creditIdx]);
    var descIdx = findCol(/(description|merchant|payee|memo|name|title|opis|aciklama|açıklama)/, [dateIdx, debitIdx, creditIdx, amountIdx]);
    var catIdx = findCol(/(categor|kategori)/, [dateIdx, debitIdx, creditIdx, amountIdx, descIdx]);
    var curIdx = findCol(/(currenc|waluta|währung)/, [dateIdx, debitIdx, creditIdx, amountIdx, descIdx, catIdx]);
    if (dateIdx === -1 || (amountIdx === -1 && !hasDebitCredit)) {
      return { error: 'Could not find the needed CSV columns. Looked for a date column (date, posted, booking, time, datum, tarih, data) plus an amount column (amount, value, betrag, kwota, tutar) or separate debit + credit columns.' };
    }
    var dataRows = rows.slice(1);
    var dayFirst = false;
    for (var r = 0; r < dataRows.length; r += 1) {
      var dm = String(dataRows[r][dateIdx] == null ? '' : dataRows[r][dateIdx]).trim().match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}/);
      if (dm && +dm[1] > 12) { dayFirst = true; break; }
    }
    var currencyCounts = {};
    var transactions = [];
    var skipped = 0;
    dataRows.forEach(function (cells) {
      var ts = parseCsvDate(cells[dateIdx], dayFirst);
      var amount = null;
      var type = null;
      if (hasDebitCredit) {
        var debit = parseCsvAmount(cells[debitIdx]);
        var credit = parseCsvAmount(cells[creditIdx]);
        if (debit !== null && debit !== 0) { amount = Math.abs(debit); type = 'EXPENSE'; }
        else if (credit !== null && credit !== 0) { amount = Math.abs(credit); type = 'INCOME'; }
      } else {
        var v = parseCsvAmount(cells[amountIdx]);
        if (v !== null) { amount = Math.abs(v); type = v < 0 ? 'EXPENSE' : 'INCOME'; }
      }
      if (ts === null || amount === null || !type) { skipped += 1; return; }
      var catRaw = catIdx !== -1 ? String(cells[catIdx] == null ? '' : cells[catIdx]).trim() : '';
      var category = catRaw ? catRaw.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') : '';
      if (!category) category = 'OTHER';
      var note = descIdx !== -1 ? String(cells[descIdx] == null ? '' : cells[descIdx]).trim() : '';
      if (curIdx !== -1) {
        var code = String(cells[curIdx] == null ? '' : cells[curIdx]).trim().toUpperCase();
        if (/^[A-Z]{3}$/.test(code)) currencyCounts[code] = (currencyCounts[code] || 0) + 1;
      }
      transactions.push({
        timestampMillis: ts,
        type: type,
        amount: amount,
        category: category,
        note: note,
      });
    });
    if (transactions.length === 0) {
      return { error: 'No rows in the CSV could be read as transactions (' + skipped + ' rows skipped). Check the date and amount columns.' };
    }
    var currency = 'USD';
    var bestCount = 0;
    Object.keys(currencyCounts).forEach(function (code) {
      if (currencyCounts[code] > bestCount) { bestCount = currencyCounts[code]; currency = code; }
    });
    var bundle = sanitizeBundle({
      schemaVersion: 1,
      exportedAtMillis: Date.now(),
      financialProfile: { currency: currency },
      transactions: transactions,
      netWorth: { assets: [], liabilities: [] },
      budgets: [],
      recurringPayments: [],
      subscriptions: [],
      cryptoHoldings: [],
      trackedDebts: [],
      billReminders: [],
      chatHistory: [],
    });
    if (!bundle) return { error: 'Could not build a data bundle from the CSV.' };
    return { bundle: bundle, imported: bundle.transactions.length, skipped: skipped };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      switch (c) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        default: return '&#39;';
      }
    });
  }

  /* ---- formatting helpers ---- */

  function titleCase(s) {
    var str2 = String(s || 'Other');
    return str2.toLowerCase().split('_').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  function formatMoney(value, currency) {
    var v = num(value);
    try {
      return new Intl.NumberFormat(navigator.language || 'en-US', {
        style: 'currency', currency: currency, currencyDisplay: 'symbol',
      }).format(v);
    } catch (e) {
      return v.toFixed(2) + ' ' + (currency || '');
    }
  }

  function formatDate(ms, opts) {
    try {
      return new Intl.DateTimeFormat(navigator.language || 'en-US',
        opts || { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(ms));
    } catch (e) {
      return new Date(ms).toDateString();
    }
  }

  function cadenceKey(cadence) { return String(cadence || '').toUpperCase(); }

  function cadenceMonthlyFactor(cadence) {
    switch (cadenceKey(cadence)) {
      case 'DAILY': return 365 / 12;
      case 'WEEKLY': return 52 / 12;
      case 'BIWEEKLY': case 'FORTNIGHTLY': return 26 / 12;
      case 'QUARTERLY': return 1 / 3;
      case 'ANNUAL': case 'YEARLY': case 'ANNUALLY': return 1 / 12;
      case 'MONTHLY': default: return 1;
    }
  }

  function cadenceLabel(cadence) {
    switch (cadenceKey(cadence)) {
      case 'DAILY': return 'Daily';
      case 'WEEKLY': return 'Weekly';
      case 'BIWEEKLY': case 'FORTNIGHTLY': return 'Biweekly';
      case 'QUARTERLY': return 'Quarterly';
      case 'ANNUAL': case 'YEARLY': case 'ANNUALLY': return 'Yearly';
      case 'MONTHLY': return 'Monthly';
      default: return titleCase(cadence || 'Recurring');
    }
  }

  function addCadencePeriod(d, cadence) {
    var next = new Date(d.getTime());
    switch (cadenceKey(cadence)) {
      case 'DAILY': next.setDate(next.getDate() + 1); break;
      case 'WEEKLY': next.setDate(next.getDate() + 7); break;
      case 'BIWEEKLY': case 'FORTNIGHTLY': next.setDate(next.getDate() + 14); break;
      case 'QUARTERLY': next.setMonth(next.getMonth() + 3); break;
      case 'ANNUAL': case 'YEARLY': case 'ANNUALLY': next.setFullYear(next.getFullYear() + 1); break;
      case 'MONTHLY': default: next.setMonth(next.getMonth() + 1); break;
    }
    return next;
  }

  function nextDueDate(anchor, cadence, now) {
    if (!anchor || !isFinite(anchor.getTime())) return null;
    var d = anchor;
    var guard = 0;
    while (d.getTime() < now.getTime() && guard < 2000) {
      d = addCadencePeriod(d, cadence);
      guard += 1;
    }
    return d;
  }

  function monthWindow(now) {
    var start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    var end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start: start.getTime(), end: end.getTime() };
  }

  function weekWindow(now) {
    var day = now.getDay();
    var diffToMonday = (day === 0) ? -6 : (1 - day);
    var monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
    var end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7, 0, 0, 0, 0);
    return { start: monday.getTime(), end: end.getTime() };
  }

  function budgetWindow(period, now) {
    return period === 'WEEKLY' ? weekWindow(now) : monthWindow(now);
  }

  function computeCategorySpent(transactions, category, windowRange) {
    var sum = 0;
    for (var i = 0; i < transactions.length; i += 1) {
      var t = transactions[i];
      if (t.type === 'EXPENSE' && t.category === category &&
          t.timestampMillis >= windowRange.start && t.timestampMillis < windowRange.end) {
        sum += num(t.amount);
      }
    }
    return sum;
  }

  function buildSparkline(values, shades) {
    var total = values.reduce(function (a, b) { return a + Math.max(0, b); }, 0);
    if (total <= 0 || values.length === 0) {
      return '<div class="spark revealed"><span style="width:100%;background:var(--line)"></span></div>';
    }
    var html = '<div class="spark" data-reveal="spark">';
    values.forEach(function (v, i) {
      var pct = Math.max(0, v) / total * 100;
      if (pct <= 0) return;
      html += '<span style="width:' + pct.toFixed(4) + '%;background:' + shades[i % shades.length] + '"></span>';
    });
    html += '</div>';
    return html;
  }

  /* ---- section builders ---- */

  function buildOverviewSection(bundle, now) {
    var currency = bundle.financialProfile.currency;
    var assetsTotal = bundle.netWorth.assets.reduce(function (s, a) { return s + num(a.value); }, 0);
    var liabilitiesTotal = bundle.netWorth.liabilities.reduce(function (s, a) { return s + num(a.value); }, 0);
    var netWorth = assetsTotal - liabilitiesTotal;
    var maxTotal = Math.max(assetsTotal, liabilitiesTotal) || 1;
    var leftPct = (liabilitiesTotal / maxTotal * 100).toFixed(4);
    var rightPct = (assetsTotal / maxTotal * 100).toFixed(4);

    var mw = monthWindow(now);
    var income = 0, expense = 0;
    bundle.transactions.forEach(function (t) {
      if (t.timestampMillis >= mw.start && t.timestampMillis < mw.end) {
        if (t.type === 'INCOME') income += num(t.amount);
        else expense += num(t.amount);
      }
    });

    return '<section class="card stagger" id="sec-overview">' +
      '<h2 class="section-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 17 9 11 13 15 21 6"></polyline><polyline points="15 6 21 6 21 12"></polyline></svg>Overview</h2>' +
      '<p class="hero-amount">' + formatMoney(netWorth, currency) + '</p>' +
      '<div class="diverging">' +
        '<div class="half left"><div class="bar" style="width:' + leftPct + '%;background:var(--orange)"></div></div>' +
        '<div class="half right"><div class="bar" style="width:' + rightPct + '%;background:var(--green)"></div></div>' +
      '</div>' +
      '<p class="diverging-caption">Assets ' + formatMoney(assetsTotal, currency) + ' &middot; Liabilities ' + formatMoney(liabilitiesTotal, currency) + '</p>' +
      '<div class="cashflow-line">' +
        '<span class="dot" style="background:var(--green)"></span> This month <b class="tnum">' + formatMoney(income, currency) + '</b> in &middot; ' +
        '<span class="dot" style="background:var(--orange)"></span> <b class="tnum">' + formatMoney(expense, currency) + '</b> out' +
      '</div>' +
    '</section>';
  }

  function buildRow(opts) {
    return '<div class="row' + (opts.extra ? ' row-extra' : '') + '"' + (opts.extra ? ' style="display:none;"' : '') + '>' +
      '<span class="accent-bar" style="background:' + opts.color + '"></span>' +
      '<div class="row-main">' +
        '<div class="row-name">' + escapeHtml(opts.name) + '</div>' +
        (opts.descHtml ? '<div class="row-desc">' + opts.descHtml + '</div>' : '') +
        (opts.extraHtml || '') +
      '</div>' +
      '<div class="row-amount tnum">' + opts.amountHtml +
        ((typeof opts.actionsHtml === 'string' && opts.actionsHtml.length > 0) ? '<span class="row-actions">' + opts.actionsHtml + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  var TOP_ROWS = 3;

  function buildAccountsSection(bundle) {
    var currency = bundle.financialProfile.currency;
    var assets = bundle.netWorth.assets.slice().sort(function (a, b) { return b.value - a.value; });
    var total = assets.reduce(function (s, a) { return s + num(a.value); }, 0);
    var shades = ['var(--green)', 'var(--green-deep)', 'var(--green-deepest)'];
    var spark = buildSparkline(assets.map(function (a) { return num(a.value); }), shades);
    var rowsHtml = assets.length ? assets.map(function (a, i) {
      return buildRow({
        extra: i >= TOP_ROWS,
        color: shades[i % shades.length],
        name: a.name,
        descHtml: escapeHtml(titleCase(a.category)),
        amountHtml: formatMoney(a.value, currency),
      });
    }).join('') : '<div class="empty-row">No accounts yet.</div>';
    var showAll = assets.length > TOP_ROWS ?
      '<button class="show-all" type="button" data-toggle="sec-accounts-rows">Show all (' + assets.length + ')</button>' : '';
    return '<section class="card stagger" id="sec-accounts">' +
      '<h2 class="section-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h11v4"></path><rect x="3" y="9" width="18" height="11" rx="1.5"></rect><circle cx="16" cy="14.5" r="1.3" fill="currentColor" stroke="none"></circle></svg>Accounts</h2>' +
      '<p class="hero-amount">' + formatMoney(total, currency) + '</p>' +
      spark +
      '<div class="rows" id="sec-accounts-rows">' + rowsHtml + '</div>' +
      showAll +
    '</section>';
  }

  function buildBillsSection(bundle, now) {
    var currency = bundle.financialProfile.currency;
    var items = bundle.bills.map(function (b) {
      var monthly = (b.kind === 'subscription' && b.monthlyEquivalent !== null && b.monthlyEquivalent !== undefined)
        ? num(b.monthlyEquivalent) : num(b.amount) * cadenceMonthlyFactor(b.cadence);
      var anchorMs = null;
      if (b.kind === 'recurring' && b.anchorEpochDay !== null) anchorMs = b.anchorEpochDay * 86400000;
      else if (b.kind === 'subscription' && b.lastDateMillis !== null) anchorMs = b.lastDateMillis;
      var next = anchorMs !== null ? nextDueDate(new Date(anchorMs), b.cadence, now) : null;
      return { name: b.name, amount: b.amount, cadence: b.cadence, monthly: monthly, next: next };
    }).sort(function (a, b) { return b.monthly - a.monthly; });
    var total = items.reduce(function (s, b) { return s + b.monthly; }, 0);
    var shades = ['var(--orange)', 'var(--orange-deep)', 'var(--yellow)'];
    var spark = buildSparkline(items.map(function (b) { return b.monthly; }), shades);
    var rowsHtml = items.length ? items.map(function (b, i) {
      var desc = escapeHtml(cadenceLabel(b.cadence)) + (b.next ? ' &middot; next ' + formatDate(b.next.getTime(), { month: 'short', day: 'numeric' }) : '');
      return buildRow({
        extra: i >= TOP_ROWS,
        color: shades[i % shades.length],
        name: b.name,
        descHtml: desc,
        amountHtml: formatMoney(b.amount, currency),
      });
    }).join('') : '<div class="empty-row">No bills or subscriptions yet.</div>';
    var showAll = items.length > TOP_ROWS ?
      '<button class="show-all" type="button" data-toggle="sec-bills-rows">Show all (' + items.length + ')</button>' : '';
    return '<section class="card stagger" id="sec-bills">' +
      '<h2 class="section-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2h12v19l-3-2-2 2-2-2-2 2-3-2z"></path><path d="M9 8h6M9 12h6"></path></svg>Bills &amp; Recurring</h2>' +
      '<p class="hero-amount">' + formatMoney(total, currency) + '</p>' +
      '<p class="hero-caption">Monthly equivalent</p>' +
      spark +
      '<div class="rows" id="sec-bills-rows">' + rowsHtml + '</div>' +
      showAll +
    '</section>';
  }

  function buildBudgetsSection(bundle, now) {
    var currency = bundle.financialProfile.currency;
    var computed = bundle.budgets.map(function (b) {
      var windowRange = budgetWindow(b.period, now);
      var spent = computeCategorySpent(bundle.transactions, b.category, windowRange);
      var left = b.limitAmount - spent;
      var pct = b.limitAmount > 0 ? Math.min(1, spent / b.limitAmount) : (spent > 0 ? 1 : 0);
      var over = b.limitAmount > 0 && spent > b.limitAmount;
      return { category: b.category, period: b.period, limitAmount: b.limitAmount, spent: spent, left: left, pct: pct, over: over };
    }).sort(function (a, b) { return b.spent - a.spent; });
    var totalSpent = computed.reduce(function (s, b) { return s + b.spent; }, 0);
    var totalLimit = computed.reduce(function (s, b) { return s + b.limitAmount; }, 0);
    var shades = ['var(--purple)', 'var(--purple-deep)'];
    var spark = buildSparkline(computed.map(function (b) { return b.spent; }), shades);
    var rowsHtml = computed.length ? computed.map(function (b, i) {
      var barColor = b.over ? 'var(--orange)' : 'var(--purple)';
      var leftLabel = b.over ? formatMoney(Math.abs(b.left), currency) + ' over' : formatMoney(b.left, currency) + ' left';
      var progressHtml = '<div class="progress-track" data-reveal="progress"><div class="progress-fill" style="width:' +
        (b.pct * 100).toFixed(2) + '%;background:' + barColor + '"></div></div>';
      return buildRow({
        extra: i >= TOP_ROWS,
        color: barColor,
        name: titleCase(b.category),
        descHtml: formatMoney(b.spent, currency) + ' of ' + formatMoney(b.limitAmount, currency) + ' &middot; ' + titleCase(b.period),
        extraHtml: progressHtml,
        amountHtml: leftLabel,
      });
    }).join('') : '<div class="empty-row">No budgets set.</div>';
    var showAll = computed.length > TOP_ROWS ?
      '<button class="show-all" type="button" data-toggle="sec-budgets-rows">Show all (' + computed.length + ')</button>' : '';
    return '<section class="card stagger" id="sec-budgets">' +
      '<h2 class="section-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 12V3"></path><path d="M12 12l7-3.5"></path></svg>Budgets</h2>' +
      '<p class="hero-amount">' + formatMoney(totalSpent, currency) + '</p>' +
      '<p class="hero-caption">of ' + formatMoney(totalLimit, currency) + ' budgeted</p>' +
      spark +
      '<div class="rows" id="sec-budgets-rows">' + rowsHtml + '</div>' +
      showAll +
    '</section>';
  }

  var TX_PAGE_SIZE = 25;

  function txFilterSort(txns, txState) {
    var q = txState.query.trim().toLowerCase();
    var list = txns;
    if (q) {
      list = list.filter(function (t) {
        return (t.category && t.category.toLowerCase().indexOf(q) !== -1) ||
               (t.note && t.note.toLowerCase().indexOf(q) !== -1);
      });
    }
    list = list.slice();
    switch (txState.sort) {
      case 'oldest': list.sort(function (a, b) { return a.timestampMillis - b.timestampMillis; }); break;
      case 'amount-desc': list.sort(function (a, b) { return b.amount - a.amount; }); break;
      case 'amount-asc': list.sort(function (a, b) { return a.amount - b.amount; }); break;
      case 'newest': default: list.sort(function (a, b) { return b.timestampMillis - a.timestampMillis; }); break;
    }
    return list;
  }

  function txRowHtml(t, currency, interactive) {
    var isIncome = t.type === 'INCOME';
    var color = isIncome ? 'var(--green)' : 'var(--orange)';
    var sign = isIncome ? '+' : '−';
    var foreignBadge = (t.foreignAmount !== null && t.foreignCurrency) ?
      '<span class="badge">' + t.foreignAmount.toFixed(2) + ' ' + escapeHtml(t.foreignCurrency) + '</span>' : '';
    var opts = {
      color: color,
      name: titleCase(t.category),
      descHtml: formatDate(t.timestampMillis) + (t.note ? ' &middot; ' + escapeHtml(t.note) : ''),
      amountHtml: sign + formatMoney(Math.abs(t.amount), currency) + foreignBadge,
    };
    if (interactive) {
      var rowId = escapeHtml(t.__docId || t.id || '');
      opts.actionsHtml =
        '<button type="button" class="tx-act" data-act="edit" data-id="' + rowId + '">Edit</button>' +
        '<button type="button" class="tx-act tx-act-del" data-act="delete" data-id="' + rowId + '">Delete</button>';
    }
    return buildRow(opts);
  }

  function buildTransactionsSection(bundle) {
    return '<section class="card stagger" id="sec-transactions">' +
      '<h2 class="section-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h13l-3-3"></path><path d="M20 17H7l3 3"></path></svg>Transactions</h2>' +
      '<div class="tx-controls">' +
        '<input type="text" class="tx-search" id="txSearch" placeholder="Search category or note" aria-label="Search transactions">' +
        '<select class="tx-sort" id="txSort" aria-label="Sort transactions">' +
          '<option value="newest">Newest first</option>' +
          '<option value="oldest">Oldest first</option>' +
          '<option value="amount-desc">Amount: high to low</option>' +
          '<option value="amount-asc">Amount: low to high</option>' +
        '</select>' +
      '</div>' +
      '<div class="rows" id="txRows"></div>' +
      '<div class="tx-pagination">' +
        '<button type="button" id="txPrev">Previous</button>' +
        '<span id="txPageInfo"></span>' +
        '<button type="button" id="txNext">Next</button>' +
      '</div>' +
    '</section>';
  }

  function wireTransactionsSection(rootEl, bundle, txState, opts) {
    opts = opts || {};
    var currency = opts.currency;
    var rowsEl = rootEl.querySelector('#txRows');
    var pageInfoEl = rootEl.querySelector('#txPageInfo');
    var prevBtn = rootEl.querySelector('#txPrev');
    var nextBtn = rootEl.querySelector('#txNext');
    var searchEl = rootEl.querySelector('#txSearch');
    var sortEl = rootEl.querySelector('#txSort');
    if (!rowsEl) return;

    var currentFiltered = [];

    function refresh() {
      var filtered = txFilterSort(bundle.transactions, txState);
      currentFiltered = filtered;
      var totalPages = Math.max(1, Math.ceil(filtered.length / TX_PAGE_SIZE));
      if (txState.page >= totalPages) txState.page = totalPages - 1;
      if (txState.page < 0) txState.page = 0;
      var startIdx = txState.page * TX_PAGE_SIZE;
      var pageItems = filtered.slice(startIdx, startIdx + TX_PAGE_SIZE);
      rowsEl.innerHTML = pageItems.length ?
        pageItems.map(function (t) { return txRowHtml(t, currency, !!opts.interactive); }).join('') :
        '<div class="empty-row">No transactions match.</div>';
      pageInfoEl.textContent = filtered.length === 0 ? 'No results' :
        ('Showing ' + (startIdx + 1) + '–' + Math.min(startIdx + TX_PAGE_SIZE, filtered.length) + ' of ' + filtered.length);
      prevBtn.disabled = txState.page <= 0;
      nextBtn.disabled = txState.page >= totalPages - 1;
    }

    searchEl.addEventListener('input', function () { txState.query = searchEl.value; txState.page = 0; refresh(); });
    sortEl.addEventListener('change', function () { txState.sort = sortEl.value; txState.page = 0; refresh(); });
    prevBtn.addEventListener('click', function () { txState.page -= 1; refresh(); });
    nextBtn.addEventListener('click', function () { txState.page += 1; refresh(); });

    if (opts.interactive) {
      // One delegated listener on the container; it survives the innerHTML
      // swaps inside refresh() because it's bound to #txRows, not to each button.
      rowsEl.addEventListener('click', function (evt) {
        var el = evt.target;
        while (el && el !== rowsEl && !(el.getAttribute && el.getAttribute('data-act'))) {
          el = el.parentNode;
        }
        if (!el || el === rowsEl || !el.getAttribute) return;
        var act = el.getAttribute('data-act');
        if (!act) return;
        var id = el.getAttribute('data-id') || '';
        var tx = null;
        for (var i = 0; i < currentFiltered.length; i += 1) {
          var t = currentFiltered[i];
          if ((t.__docId || t.id || '') === id) { tx = t; break; }
        }
        if (!tx) return;
        if (act === 'edit' && typeof opts.onEditTx === 'function') opts.onEditTx(tx);
        else if (act === 'delete' && typeof opts.onDeleteTx === 'function') opts.onDeleteTx(tx);
      });
    }

    if (typeof opts.onAddTx === 'function') {
      var sectionEl = rootEl.querySelector('#sec-transactions');
      var header = sectionEl ? sectionEl.querySelector('.section-label') : null;
      if (header) {
        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'tx-add';
        addBtn.textContent = 'Add';
        addBtn.addEventListener('click', function () { opts.onAddTx(); });
        header.appendChild(addBtn);
      }
    }

    refresh();
  }

  function wireShowAllButtons(rootEl) {
    var buttons = rootEl.querySelectorAll('.show-all[data-toggle]');
    Array.prototype.forEach.call(buttons, function (button) {
      var targetId = button.getAttribute('data-toggle');
      var container = rootEl.querySelector('#' + targetId);
      if (!container) return;
      var extras = container.querySelectorAll('.row-extra');
      var originalLabel = button.textContent;
      var expanded = false;
      button.addEventListener('click', function () {
        expanded = !expanded;
        Array.prototype.forEach.call(extras, function (el) { el.style.display = expanded ? '' : 'none'; });
        button.textContent = expanded ? 'Show less' : originalLabel;
      });
    });
  }

  function revealMotion(root) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cards = root.querySelectorAll('.card.stagger');
    Array.prototype.forEach.call(cards, function (card, i) {
      if (reduce) {
        card.classList.add('in');
      } else {
        setTimeout(function () { card.classList.add('in'); }, 400 + i * 100);
      }
    });
    function revealAll() {
      Array.prototype.forEach.call(root.querySelectorAll('.spark[data-reveal="spark"]'), function (el) { el.classList.add('revealed'); });
      Array.prototype.forEach.call(root.querySelectorAll('.diverging'), function (el) { el.classList.add('revealed'); });
      Array.prototype.forEach.call(root.querySelectorAll('.progress-track[data-reveal="progress"]'), function (el) { el.classList.add('revealed'); });
    }
    if (reduce) revealAll();
    else setTimeout(revealAll, 450);
  }

  function renderDashboard(rootEl, bundle, opts) {
    opts = opts || {};
    var interactive = !!opts.interactive;
    var currency = opts && opts.currency || (bundle.financialProfile && bundle.financialProfile.currency) || 'USD';
    var now = new Date();
    var txState = { query: '', sort: 'newest', page: 0 };
    var html = buildOverviewSection(bundle, now) +
      buildAccountsSection(bundle) +
      buildBillsSection(bundle, now) +
      buildBudgetsSection(bundle, now) +
      buildTransactionsSection(bundle);
    rootEl.innerHTML = html;
    wireShowAllButtons(rootEl);
    wireTransactionsSection(rootEl, bundle, txState, {
      currency: currency,
      interactive: interactive,
      onEditTx: opts.onEditTx,
      onDeleteTx: opts.onDeleteTx,
      onAddTx: opts.onAddTx,
    });
    revealMotion(rootEl);
  }

  window.FaintoDashboard = {
    sanitizeBundle: sanitizeBundle,
    resolveFromFileText: resolveFromFileText,
    parseCsvToBundle: parseCsvToBundle,
    formatMoney: formatMoney,
    formatDate: formatDate,
    renderDashboard: renderDashboard,
  };
}());
