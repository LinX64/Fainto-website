(function () {
  try {
    var SUP = ["en", "de", "pl", "fa", "tr"];
    var l = localStorage.getItem("fainto-lang");
    if (SUP.indexOf(l) < 0) {
      // No saved choice — default to the visitor's own browser language (privacy-safe:
      // no IP lookup, no third-party geo request). A Polish browser gets Polish, etc.
      var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
      var primary = String(nav).toLowerCase().split("-")[0];
      l = SUP.indexOf(primary) >= 0 ? primary : "en";
    }
    var el = document.documentElement;
    el.setAttribute("lang", l);
    el.setAttribute("dir", l === "fa" ? "rtl" : "ltr");
  } catch (e) {}
})();
