/* Fainto — interactions. One IIFE, independent sub-modules.
   Doctrine: static is the default state; JS only ADDS motion, and only when
   prefers-reduced-motion allows. Figures are typeset, never tweened. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;

  /* .js unlocks JS-only controls (the seg control); .js-motion additionally
     unlocks pending/moving states — it requires IO because only the observer
     ever un-hides .reveal content. */
  document.documentElement.classList.add("js");
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

  /* ---------------- hero ring + segmented control ----------------
     Values are the app's own Overview sample data (see SAMPLE DATA tag). */
  (function () {
    var root = document.querySelector("[data-ring]");
    if (!root) return;
    var disc = root.querySelector("[data-ring-disc]");
    var num = root.querySelector("[data-ring-num]");
    var cap = root.querySelector("[data-ring-cap]");
    var seg = root.querySelector("[data-ring-seg]");

    var STATES = {
      income:  { sweep: 100, color: "var(--green)", num: "12.5K zł", cap: "Income this month" },
      spend:   { sweep: 8,   color: "var(--coral)", num: "1.0K zł",  cap: "Expenses this month" },
      savings: { sweep: 57,  color: "var(--amber)", num: "7.1K zł",  cap: "Savings this month" }
    };

    function apply(state) {
      disc.style.setProperty("--sweep", state.sweep);
      disc.style.setProperty("--ring-color", state.color);
      num.textContent = state.num;
      cap.textContent = state.cap;
    }

    /* browsers restore form state on back/reload — resync before first paint */
    var restored = seg.querySelector("input:checked");
    var initial = (restored && STATES[restored.value]) ? STATES[restored.value] : STATES.income;
    var drawIn = !reduceMotion && document.documentElement.classList.contains("js-motion");

    if (!drawIn) {
      apply(initial);
    } else {
      /* start collapsed (is-pending owns --sweep:0 via CSS), set label + colour now;
         the sweep is released on the next frame so it animates 0 -> target instead
         of being pinned by an inline --sweep written here */
      num.textContent = initial.num;
      cap.textContent = initial.cap;
      disc.style.setProperty("--ring-color", initial.color);
      disc.classList.add("is-pending");
    }

    var swapTimer = null;
    seg.addEventListener("change", function (e) {
      var state = STATES[e.target.value];
      if (!state) return;
      if (reduceMotion) { apply(state); return; }
      if (swapTimer) clearTimeout(swapTimer);
      disc.classList.add("is-swapping");
      swapTimer = setTimeout(function () {
        swapTimer = null;
        apply(state);
        disc.classList.remove("is-swapping");
      }, 180);
    });

    /* release the collapsed ring on the next frame so the sweep animates in */
    if (drawIn) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          disc.classList.remove("is-pending");
          disc.style.setProperty("--sweep", initial.sweep);
        });
      });
    }
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
