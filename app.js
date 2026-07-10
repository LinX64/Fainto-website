/* Fainto — interactions. One IIFE, independent sub-modules.
   Doctrine: static is the default state; JS only ADDS motion, and only when
   prefers-reduced-motion allows. Figures are typeset, never tweened. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;

  /* .js-motion unlocks additive motion (reveals, mesh drift) — it requires IO
     because only the observer ever un-hides .reveal content. Static is default. */
  if (!reduceMotion && hasIO) {
    document.documentElement.classList.add("js-motion");
  }

  /* ---------------- sticky header scrolled state ---------------- */
  (function () {
    var nav = document.querySelector("[data-nav]");
    if (!nav) return;
    var ticking = false;
    function update() {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* --------------------- reveals on scroll ---------------------
     Motion mode only: the .js-motion class scopes the pending state,
     so no-JS and reduced-motion render everything visible by default. */
  (function () {
    if (!document.documentElement.classList.contains("js-motion")) return;

    var reveals = [].slice.call(document.querySelectorAll(".reveal"));
    if (!reveals.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    reveals.forEach(function (el) { io.observe(el); });
  })();

})();
