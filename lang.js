(function () {
  "use strict";
  var root = document.documentElement;
  var LANGS = ["en", "de", "pl", "fa", "tr"];
  var META = {
    en: { flag: "🇬🇧", name: "English" },
    de: { flag: "🇩🇪", name: "Deutsch" },
    pl: { flag: "🇵🇱", name: "Polski" },
    tr: { flag: "🇹🇷", name: "Türkçe" },
    fa: { flag: "", name: "فارسی" },
  };
  var OG_LOCALE = { en: "en_US", de: "de_DE", pl: "pl_PL", tr: "tr_TR", fa: "fa_IR" };
  // English needs no file — the DOM's authored text is the English copy, restored via the
  // data-i18n-en snapshot below. Non-English dictionaries load on demand, one file per
  // language, so a visitor only ever downloads the language they actually see.
  var SELF_SRC = (document.currentScript && document.currentScript.src) || "";
  var BASE = SELF_SRC.replace(/lang\.js(\?.*)?$/, "");

  function ensureLang(lang, cb) {
    if (lang === "en" || (window.FAINTO_I18N && window.FAINTO_I18N[lang])) {
      cb();
      return;
    }
    var s = document.createElement("script");
    s.src = BASE + "i18n." + lang + ".js?v=20260719";
    s.onload = cb;
    s.onerror = cb; // fail open — apply() falls back to the English snapshot
    document.head.appendChild(s);
  }

  function apply(lang) {
    if (LANGS.indexOf(lang) < 0) lang = "en";
    var d = lang === "en" ? null : window.FAINTO_I18N && window.FAINTO_I18N[lang];

    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-i18n");
      var rich = el.hasAttribute("data-i18n-html");
      if (!el.hasAttribute("data-i18n-en")) el.setAttribute("data-i18n-en", rich ? el.innerHTML : el.textContent);
      var val = d && d[key] != null ? d[key] : el.getAttribute("data-i18n-en");
      if (rich) el.innerHTML = val;
      else el.textContent = val;
    }

    var anodes = document.querySelectorAll("[data-i18n-attr]");
    for (var j = 0; j < anodes.length; j++) {
      var ael = anodes[j];
      var spec = ael.getAttribute("data-i18n-attr").split(";");
      for (var k = 0; k < spec.length; k++) {
        var pair = spec[k].split(":");
        var an = pair[0],
          ak = pair[1];
        if (!an || !ak) continue;
        var save = "data-i18n-en-" + an;
        if (!ael.hasAttribute(save)) ael.setAttribute(save, ael.getAttribute(an) || "");
        ael.setAttribute(an, d && d[ak] != null ? d[ak] : ael.getAttribute(save));
      }
    }

    root.setAttribute("lang", lang);
    root.setAttribute("dir", lang === "fa" ? "rtl" : "ltr");

    var ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.setAttribute("content", OG_LOCALE[lang] || "en_US");

    var fl = document.querySelector("[data-lang-flag]");
    var nm = document.querySelector("[data-lang-name]");
    var src = document.querySelector('[data-lang-opt="' + lang + '"] .lang-flag');
    if (fl) fl.innerHTML = src ? src.innerHTML : META[lang].flag;
    if (nm) nm.textContent = META[lang].name;
  }

  var cur = "en";
  try {
    var s = localStorage.getItem("fainto-lang");
    if (LANGS.indexOf(s) >= 0) {
      cur = s;
    } else {
      // No saved choice — follow the browser's language (no IP/geo lookup; the site
      // makes zero third-party requests). Explicit picks below still override + persist.
      var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
      var primary = String(nav).toLowerCase().split("-")[0];
      if (LANGS.indexOf(primary) >= 0) cur = primary;
    }
  } catch (e) {}
  ensureLang(cur, function () {
    apply(cur);
  });

  var wrap = document.querySelector("[data-lang]");
  if (!wrap) return;
  var btn = wrap.querySelector("[data-lang-btn]");
  var menu = wrap.querySelector("[data-lang-menu]");

  function open() {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }
  function close() {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (menu.hidden) open();
    else close();
  });
  wrap.querySelectorAll("[data-lang-opt]").forEach(function (opt) {
    opt.addEventListener("click", function () {
      cur = opt.getAttribute("data-lang-opt");
      try {
        localStorage.setItem("fainto-lang", cur);
      } catch (e) {}
      ensureLang(cur, function () {
        apply(cur);
      });
      close();
      btn.focus();
    });
  });
  document.addEventListener("click", function (e) {
    if (!wrap.contains(e.target)) close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
})();
