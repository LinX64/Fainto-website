(function () {
  "use strict";
  var root = document.documentElement;
  var LANGS = ["en", "de", "pl", "fa", "tr"];
  var META = {
    en: { flag: "🇬🇧", name: "English" },
    de: { flag: "🇩🇪", name: "Deutsch" },
    pl: { flag: "🇵🇱", name: "Polski" },
    tr: { flag: "🇹🇷", name: "Türkçe" },
    fa: { flag: "🇮🇷", name: "فارسی" },
  };
  var DICT = window.__I18N || {};

  function apply(lang) {
    if (LANGS.indexOf(lang) < 0) lang = "en";
    var d = lang === "en" ? null : DICT[lang];

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

    var fl = document.querySelector("[data-lang-flag]");
    var nm = document.querySelector("[data-lang-name]");
    if (fl) fl.textContent = META[lang].flag;
    if (nm) nm.textContent = META[lang].name;
  }

  var cur = "en";
  try {
    var s = localStorage.getItem("fainto-lang");
    if (LANGS.indexOf(s) >= 0) cur = s;
  } catch (e) {}
  apply(cur);

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
      apply(cur);
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
