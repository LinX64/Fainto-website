(function () {
  try {
    var l = localStorage.getItem("fainto-lang");
    if (l !== "de" && l !== "pl" && l !== "fa" && l !== "tr") l = "en";
    var el = document.documentElement;
    el.setAttribute("lang", l);
    el.setAttribute("dir", l === "fa" ? "rtl" : "ltr");
  } catch (e) {}
})();
