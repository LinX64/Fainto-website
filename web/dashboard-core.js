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

  /* ---- Category + icon visuals (mirrored from the app: TransactionHelpers + SelectableIcons) ----
     Only the iconKey STRING syncs to the phone; these inline Lucide (MIT) SVGs are just how the web
     draws it. Unknown keys fall back to the category's default icon. */
  var ICON_PATHS = {
    'beer': '<path d="M17 11h1a3 3 0 0 1 0 6h-1" /><path d="M9 12v6" /><path d="M13 12v6" /><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z" /><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />',
    'book': '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />',
    'briefcase': '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" />',
    'bus': '<path d="M8 6v6" /><path d="M15 6v6" /><path d="M2 12h19.6" /><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" /><circle cx="7" cy="18" r="2" /><path d="M9 18h5" /><circle cx="16" cy="18" r="2" />',
    'car': '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />',
    'circle': '<circle cx="12" cy="12" r="10" />',
    'coffee': '<path d="M10 2v2" /><path d="M14 2v2" /><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" /><path d="M6 2v2" />',
    'credit-card': '<rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />',
    'dog': '<path d="M11.25 16.25h1.5L12 17z" /><path d="M16 14v.5" /><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309" /><path d="M8 14v.5" /><path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" />',
    'dumbbell': '<path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z" /><path d="m2.5 21.5 1.4-1.4" /><path d="m20.1 3.9 1.4-1.4" /><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" /><path d="m9.6 14.4 4.8-4.8" />',
    'film': '<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18" /><path d="M3 7.5h4" /><path d="M3 12h18" /><path d="M3 16.5h4" /><path d="M17 3v18" /><path d="M17 7.5h4" /><path d="M17 16.5h4" />',
    'fuel': '<path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5" /><path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16" /><path d="M2 21h13" /><path d="M3 9h11" />',
    'gamepad-2': '<line x1="6" x2="10" y1="11" y2="11" /><line x1="8" x2="8" y1="9" y2="13" /><line x1="15" x2="15.01" y1="12" y2="12" /><line x1="18" x2="18.01" y1="10" y2="10" /><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />',
    'gift': '<path d="M12 7v14" /><path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" /><path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" /><rect x="3" y="7" width="18" height="4" rx="1" />',
    'graduation-cap': '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" /><path d="M22 10v6" /><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />',
    'heart': '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />',
    'heart-pulse': '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /><path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />',
    'house': '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
    'music': '<path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />',
    'piggy-bank': '<path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z" /><path d="M16 10h.01" /><path d="M2 8v1a2 2 0 0 0 2 2h1" />',
    'pill': '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" />',
    'pizza': '<path d="m12 14-1 1" /><path d="m13.75 18.25-1.25 1.42" /><path d="M17.775 5.654a15.68 15.68 0 0 0-12.121 12.12" /><path d="M18.8 9.3a1 1 0 0 0 2.1 7.7" /><path d="M21.964 20.732a1 1 0 0 1-1.232 1.232l-18-5a1 1 0 0 1-.695-1.232A19.68 19.68 0 0 1 15.732 2.037a1 1 0 0 1 1.232.695z" />',
    'plane': '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />',
    'shirt': '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />',
    'shopping-cart': '<circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />',
    'smartphone': '<rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />',
    'star': '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />',
    'trending-down': '<path d="M16 17h6v-6" /><path d="m22 17-8.5-8.5-5 5L2 7" />',
    'trending-up': '<path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" />',
    'utensils': '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />',
    'wallet': '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />',
    'wifi': '<path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" />',
    'zap': '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />'
  };
  // app iconKey -> ICON_PATHS name (the subset offered in the web picker; the phone has all 54)
  var ICONKEY_SVG = {
    car: 'car', bus: 'bus', plane: 'plane', fuel: 'fuel', house: 'house', savings: 'piggy-bank',
    wallet: 'wallet', card: 'credit-card', food: 'utensils', pizza: 'pizza', coffee: 'coffee',
    beer: 'beer', shopping: 'shopping-cart', clothing: 'shirt', health: 'heart-pulse', pill: 'pill',
    fitness: 'dumbbell', utilities: 'zap', internet: 'wifi', gaming: 'gamepad-2', music: 'music',
    movies: 'film', book: 'book', work: 'briefcase', education: 'graduation-cap', phone: 'smartphone',
    pet: 'dog', gift: 'gift', heart: 'heart', star: 'star'
  };
  // category -> { label, color token, default icon } — mirrors the app's TransactionCategory.icon()
  var CATS = {
    FOOD:          { label: 'Food',          color: 'var(--orange)',      icon: 'utensils' },
    HOUSING:       { label: 'Housing',       color: 'var(--blue-deep)',   icon: 'house' },
    TRANSPORT:     { label: 'Transport',     color: 'var(--acc-brand)',   icon: 'car' },
    UTILITIES:     { label: 'Utilities',     color: 'var(--yellow)',      icon: 'zap' },
    ENTERTAINMENT: { label: 'Entertainment', color: 'var(--purple-deep)', icon: 'gamepad-2' },
    HEALTH:        { label: 'Health',        color: 'var(--acc-spend)',   icon: 'heart-pulse' },
    SHOPPING:      { label: 'Shopping',      color: 'var(--orange-deep)', icon: 'shopping-cart' },
    SAVINGS:       { label: 'Savings',       color: 'var(--green)',       icon: 'trending-up' },
    SALARY:        { label: 'Salary',        color: 'var(--green-deep)',  icon: 'trending-down' },
    EDUCATION:     { label: 'Education',     color: 'var(--yellow-deep)', icon: 'graduation-cap' },
    OTHER:         { label: 'Other',         color: 'var(--muted)',       icon: 'circle' }
  };
  var CATEGORY_ORDER = ['FOOD', 'HOUSING', 'TRANSPORT', 'UTILITIES', 'ENTERTAINMENT', 'HEALTH', 'SHOPPING', 'SAVINGS', 'SALARY', 'EDUCATION', 'OTHER'];
  // app iconKeys offered in the optional override picker
  var PICK_ICON_KEYS = ['food', 'coffee', 'pizza', 'beer', 'shopping', 'clothing', 'car', 'bus', 'plane', 'fuel', 'house', 'wallet', 'card', 'savings', 'gift', 'health', 'pill', 'fitness', 'utilities', 'internet', 'gaming', 'music', 'movies', 'book', 'work', 'education', 'phone', 'pet', 'heart', 'star'];

  function iconSvg(name) {
    var p = ICON_PATHS[name];
    if (!p) return '';
    return '<svg class="fic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  function catMeta(category) { return CATS[category] || CATS.OTHER; }
  function txIconName(iconKey, category) {
    if (iconKey && ICONKEY_SVG[iconKey]) return ICONKEY_SVG[iconKey];
    return catMeta(category).icon;
  }
  function iconKeySvg(iconKey) { return iconSvg(ICONKEY_SVG[iconKey] || 'circle'); }

  function sanitizeTransaction(raw) {
    if (!isObj(raw)) return null;
    var ts = numOrNull(raw.timestampMillis);
    if (ts === null) return null;
    var type = (raw.type === 'INCOME' || raw.type === 'EXPENSE') ? raw.type : null;
    if (!type) return null;
    // Repair rows from a bad CSV backfill: the real date can land in the note ("29-05-2026")
    // while timestampMillis holds a garbage value that renders as "Nov 13, 36".
    var note = typeof raw.note === 'string' ? raw.note.trim() : '';
    if (!isSaneTs(ts) && note) {
      var noteDate = parseLooseDate(note);
      if (noteDate !== null) { ts = noteDate; note = ''; }   // move the date out of the note into the timestamp
    }
    var tx = {
      timestampMillis: ts,
      category: str(raw.category, 'OTHER'),
      type: type,
      amount: num(raw.amount),
      note: note,
      foreignAmount: numOrNull(raw.foreignAmount),
      foreignCurrency: typeof raw.foreignCurrency === 'string' ? raw.foreignCurrency : null,
      // Per-transaction icon override (syncs to the phone); null → use the category's default icon.
      iconKey: (typeof raw.iconKey === 'string' && raw.iconKey.length > 0) ? raw.iconKey : null,
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
      currency: str(fpRaw.currency, 'PLN'),
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
    m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/);        // DD-MM-YYYY (dashes) — not just the ISO YYYY-MM-DD above
    if (m) {
      var yd = +m[3];
      if (yd < 100) yd += 2000;
      return dayFirst ? csvDateMs(yd, +m[2], +m[1]) : csvDateMs(yd, +m[1], +m[2]);
    }
    return null;
  }

  // Sane epoch-millis window: reject values that would render as a nonsense year
  // (e.g. a bad backfill leaving seconds or an epoch-day count → "Nov 13, 36").
  var TS_MIN = Date.UTC(2000, 0, 1);
  var TS_MAX = Date.UTC(2100, 0, 1);
  function isSaneTs(ms) { return typeof ms === 'number' && isFinite(ms) && ms >= TS_MIN && ms < TS_MAX; }

  // Parse a note that is ENTIRELY a single date token (anchored) → epoch millis, else null.
  // Used to recover a real date that a bad CSV backfill dumped into the note field.
  function parseLooseDate(s) {
    var raw = String(s == null ? '' : s).trim();
    if (!raw) return null;
    var m = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);   // ISO YYYY-MM-DD or YYYY/MM/DD
    if (m) return csvDateMs(+m[1], +m[2], +m[3]);
    m = raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);   // DD-MM-YYYY / DD.MM.YYYY / DD/MM/YYYY
    if (m) {
      var a = +m[1], b = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      if (a > 12 && b <= 12) return csvDateMs(y, b, a);           // first field clearly a day
      if (b > 12 && a <= 12) return csvDateMs(y, a, b);           // second field clearly a day → month-first
      return csvDateMs(y, b, a);                                  // ambiguous → day-first (app locale)
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
      var dm = String(dataRows[r][dateIdx] == null ? '' : dataRows[r][dateIdx]).trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-]\d{2,4}/);
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
    var currency = 'PLN';
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
      (opts.iconHtml
        ? '<span class="row-icon" style="color:' + opts.color + '">' + opts.iconHtml + '</span>'
        : '<span class="accent-bar" style="background:' + opts.color + '"></span>') +
      '<div class="row-main">' +
        '<div class="row-name">' + escapeHtml(opts.name) + '</div>' +
        (opts.descHtml ? '<div class="row-desc">' + opts.descHtml + '</div>' : '') +
        (opts.extraHtml || '') +
      '</div>' +
      '<div class="row-amount tnum">' + opts.amountHtml + '</div>' +
      // actions are a sibling of .row-amount (not nested) so the flex:none amount cell can't push
      // the row-main category/date to 0px on phones — the 560px rule wraps them to their own line.
      ((typeof opts.actionsHtml === 'string' && opts.actionsHtml.length > 0) ? '<span class="row-actions">' + opts.actionsHtml + '</span>' : '') +
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
        descHtml: formatMoney(b.spent, currency) + ' / ' + formatMoney(b.limitAmount, currency) +
          (b.period && String(b.period).toUpperCase() !== 'MONTHLY' ? ' &middot; ' + titleCase(b.period) : ''),
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
    var cat = catMeta(t.category);
    var sign = isIncome ? '+' : '−';
    // Only show the foreign badge when it adds information: a real amount in a DIFFERENT currency.
    var showForeign = t.foreignAmount !== null && t.foreignAmount !== 0 && t.foreignCurrency &&
      t.foreignCurrency.toUpperCase() !== String(currency || '').toUpperCase();
    var foreignBadge = showForeign ?
      '<span class="badge">' + t.foreignAmount.toFixed(2) + ' ' + escapeHtml(t.foreignCurrency) + '</span>' : '';
    // Never print a nonsense date from a garbage timestamp; fall back to note-only.
    var datePart = isSaneTs(t.timestampMillis) ? formatDate(t.timestampMillis) : '';
    var desc = [datePart, t.note ? escapeHtml(t.note) : ''].filter(Boolean).join(' &middot; ');
    var opts = {
      color: cat.color,                                         // icon badge tinted by category
      iconHtml: iconSvg(txIconName(t.iconKey, t.category)),     // override icon, else category default
      name: titleCase(t.category),
      descHtml: desc,
      amountHtml: '<span style="color:' + (isIncome ? 'var(--green)' : 'var(--acc-spend)') + '">' +
        sign + formatMoney(Math.abs(t.amount), currency) + '</span>' + foreignBadge,
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
        '<span id="txPageInfo" aria-live="polite" aria-atomic="true"></span>' +
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

  function revealMotion(root, animate) {
    if (animate === undefined) animate = true;
    // animate:false (a mutation re-render) reveals everything synchronously — same end state as
    // reduced-motion — so the dashboard doesn't replay its full entrance after every edit.
    var reduce = !animate || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
    var animate = opts.animate !== false;   // default true; false skips the entrance on re-render
    var omit = opts.omitSections || [];      // names to skip (e.g. 'budgets' — phone-only in the cloud bundle)
    function want(name) { return omit.indexOf(name) === -1; }
    var currency = opts && opts.currency || (bundle.financialProfile && bundle.financialProfile.currency) || 'PLN';
    var now = new Date();
    var txState = { query: '', sort: 'newest', page: 0 };
    var html = (want('overview') ? buildOverviewSection(bundle, now) : '') +
      (want('accounts') ? buildAccountsSection(bundle) : '') +
      (want('bills') ? buildBillsSection(bundle, now) : '') +
      (want('budgets') ? buildBudgetsSection(bundle, now) : '') +
      (want('transactions') ? buildTransactionsSection(bundle) : '');
    rootEl.innerHTML = html;
    wireShowAllButtons(rootEl);
    wireTransactionsSection(rootEl, bundle, txState, {
      currency: currency,
      interactive: interactive,
      onEditTx: opts.onEditTx,
      onDeleteTx: opts.onDeleteTx,
      onAddTx: opts.onAddTx,
    });
    revealMotion(rootEl, animate);
  }

  window.FaintoDashboard = {
    sanitizeBundle: sanitizeBundle,
    resolveFromFileText: resolveFromFileText,
    parseCsvToBundle: parseCsvToBundle,
    formatMoney: formatMoney,
    formatDate: formatDate,
    renderDashboard: renderDashboard,
    // Category + icon catalog for the interactive add/edit pickers in app.html.
    categories: CATS,
    categoryOrder: CATEGORY_ORDER,
    pickIconKeys: PICK_ICON_KEYS,
    iconSvg: iconSvg,
    iconKeySvg: iconKeySvg,
    catMeta: catMeta,
    // Pure internals exposed for the zero-dependency test suite (tests/dashboard-core.test.js).
    // No DOM, no side effects — safe to ship; the render pages never touch this key.
    __test: {
      txRowHtml: txRowHtml,
      sanitizeTransaction: sanitizeTransaction,
      parseCsvDate: parseCsvDate,
      parseLooseDate: parseLooseDate,
      isSaneTs: isSaneTs,
      txFilterSort: txFilterSort,
      buildRow: buildRow,
    },
  };
}());
