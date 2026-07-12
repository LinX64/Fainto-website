(function () {
  "use strict";
  var root = document.documentElement;
  var btn = document.querySelector("[data-theme-toggle]");
  if (!btn) return;
  var meta = document.querySelector('meta[name="theme-color"]');
  function sync() {
    var light = root.getAttribute("data-theme") === "light";
    btn.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
    if (meta) meta.setAttribute("content", light ? "#f5f5f7" : "#27272f");
  }
  sync();
  btn.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("fainto-theme", next);
    } catch (e) {}
    sync();
  });
})();
