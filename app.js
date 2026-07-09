/* Fainto — interactions. One IIFE, independent sub-modules.
   Doctrine: static is the default state; JS only ADDS motion, and only when
   prefers-reduced-motion allows. Figures are typeset, never tweened. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;

  /* .js unlocks JS-only controls (reel arrows/dots, seg control, drag hint);
     .js-motion additionally unlocks pending/moving states — it requires IO
     because only the observers ever un-hide .reveal/.stamp-row content. */
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
      income:  { sweep: 100, color: "var(--green)", num: "12.5K zł", cap: "Income this month" },
      spend:   { sweep: 8,   color: "var(--coral)", num: "1.0K zł",  cap: "Expenses this month" },
      savings: { sweep: 57,  color: "var(--amber)", num: "7.1K zł",  cap: "Savings this month" }
    };

    function apply(state) {
      disc.style.setProperty("--sweep", state.sweep);
      disc.style.setProperty("--ring-color", state.color);
      num.textContent = state.num;
      cap.textContent = state.cap;
    }

    /* browsers restore form state on back/reload — resync before first paint */
    var restored = seg.querySelector("input:checked");
    if (restored && STATES[restored.value]) apply(STATES[restored.value]);

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

    /* draw the ring shut once on load (motion mode only) */
    if (!reduceMotion && document.documentElement.classList.contains("js-motion")) {
      disc.classList.add("is-pending");
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          disc.classList.remove("is-pending");
        });
      });
    }
  })();

  /* ------------------------- the reel -------------------------
     Draggable scroll-snap rail. No auto-advance, ever. The morph
     (crisp -> round toward center) runs only in motion mode and only
     touches the three cards nearest center per frame. */
  (function () {
    var section = document.querySelector("[data-reel]");
    if (!section) return;
    var track = section.querySelector("[data-reel-track]");
    var cards = [].slice.call(track.querySelectorAll(".reel-card"));
    var dots = [].slice.call(section.querySelectorAll("[data-reel-dots] button"));
    var prev = section.querySelector("[data-reel-prev]");
    var next = section.querySelector("[data-reel-next]");
    if (!cards.length) return;

    var scrollBehavior = reduceMotion ? "auto" : "smooth";

    function cardStep() {
      var rect = cards[0].getBoundingClientRect();
      return rect.width + 24;
    }
    prev.addEventListener("click", function () {
      track.scrollBy({ left: -cardStep(), behavior: scrollBehavior });
    });
    next.addEventListener("click", function () {
      track.scrollBy({ left: cardStep(), behavior: scrollBehavior });
    });
    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        var card = cards[i];
        var target = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
        track.scrollTo({ left: target, behavior: scrollBehavior });
      });
    });

    /* active indicator via IntersectionObserver — narrow center zone; when
       two cards straddle the zone in one batch, the one nearest center wins */
    if (hasIO) {
      var io = new IntersectionObserver(function (entries) {
        var mid = track.getBoundingClientRect();
        var center = mid.left + mid.width / 2;
        var best = null, bestD = Infinity;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var r = entry.boundingClientRect;
          var d = Math.abs(r.left + r.width / 2 - center);
          if (d < bestD) { bestD = d; best = entry.target; }
        });
        if (!best) return;
        var idx = cards.indexOf(best);
        dots.forEach(function (d, i) {
          d.setAttribute("aria-current", i === idx ? "true" : "false");
        });
      }, { root: track, rootMargin: "0px -45% 0px -45%", threshold: 0 });
      cards.forEach(function (c) { io.observe(c); });
    }

    if (reduceMotion) return;

    /* scroll-linked shape morph — bounded to the 3 nearest cards */
    var morphTicking = false;
    var touched = [];
    function morph() {
      morphTicking = false;
      var mid = track.getBoundingClientRect();
      var center = mid.left + mid.width / 2;
      var byDist = cards.map(function (card) {
        var r = card.getBoundingClientRect();
        return { card: card, d: Math.abs(r.left + r.width / 2 - center) / (r.width + 24) };
      }).sort(function (a, b) { return a.d - b.d; });

      touched.forEach(function (c) {
        c.style.removeProperty("--rc");
        c.style.removeProperty("--sc");
        c.style.removeProperty("--cap");
      });
      touched = [];

      byDist.slice(0, 3).forEach(function (item) {
        var t = Math.min(1, item.d);            /* 0 at center, 1 a card away */
        var radius = 24 - 14 * t;               /* 24px -> 10px */
        var scale = 1 - 0.06 * t;               /* 1 -> 0.94  */
        var img = item.card.querySelector("img");
        img.style.setProperty("--rc", radius.toFixed(1) + "px");
        img.style.setProperty("--sc", scale.toFixed(3));
        item.card.querySelector(".reel-cap-text").style.setProperty("--cap", (1 - t).toFixed(2));
        touched.push(img, item.card.querySelector(".reel-cap-text"));
      });
      /* cards outside the active trio rest at the crisp radius */
      byDist.slice(3).forEach(function (item) {
        var img = item.card.querySelector("img");
        img.style.setProperty("--rc", "10px");
        img.style.setProperty("--sc", "0.94");
        item.card.querySelector(".reel-cap-text").style.setProperty("--cap", "0");
        touched.push(img, item.card.querySelector(".reel-cap-text"));
      });
    }
    track.addEventListener("scroll", function () {
      if (!morphTicking) { morphTicking = true; requestAnimationFrame(morph); }
    }, { passive: true });
    window.addEventListener("resize", function () {
      if (!morphTicking) { morphTicking = true; requestAnimationFrame(morph); }
    });
    morph();

    /* 1:1 pointer drag for mouse users; touch scrolls natively.
       Native image drag-and-drop would hijack the gesture — suppress it. */
    track.addEventListener("dragstart", function (e) { e.preventDefault(); });
    var dragging = false, startX = 0, startLeft = 0, moved = false;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse") return;
      e.preventDefault();
      dragging = true; moved = false;
      startX = e.clientX;
      startLeft = track.scrollLeft;
      track.style.scrollSnapType = "none";
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startLeft - dx;
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      track.style.scrollSnapType = "";
      if (moved) {
        /* settle on the nearest snap point */
        var stepW = cardStep();
        var idx = Math.round(track.scrollLeft / stepW);
        track.scrollTo({ left: idx * stepW, behavior: "smooth" });
      }
    }
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("click", function (e) {
      if (moved) { e.preventDefault(); moved = false; }
    }, true);
  })();

  /* ------------------- live egress ledger -------------------
     Measured in the visitor's own browser. Figures swap instantly —
     measured numbers are typeset, not animated. */
  (function () {
    var out = document.querySelector("[data-egress-site]");
    if (!out) return;

    if (!("performance" in window) || !performance.getEntriesByType) {
      out.textContent = "This page loads fonts and images from a CDN.";
      return;
    }

    var scheduled = false;
    function render() {
      scheduled = false;
      var resources = performance.getEntriesByType("resource");
      var navs = performance.getEntriesByType("navigation");
      var count = resources.length + navs.length;
      var bytes = 0;
      resources.concat(navs).forEach(function (r) {
        bytes += r.transferSize || 0;   /* cross-origin w/o TAO reports 0 — hence "at least" */
      });
      /* cached revisits can measure 0 transferred bytes — then say only what
         was measured (never fabricate a floor) */
      out.textContent = bytes > 0
        ? count + " requests · at least " + Math.round(bytes / 1024) + " KB"
        : count + " requests";
    }
    function schedule() {
      if (!scheduled) { scheduled = true; requestAnimationFrame(render); }
    }
    schedule();

    if ("PerformanceObserver" in window) {
      try {
        new PerformanceObserver(schedule).observe({ type: "resource", buffered: true });
      } catch (e) { /* older observer signatures — the initial render stands */ }
    }
    window.addEventListener("load", schedule);
  })();

  /* --------------- reveals + ledger/table stamp-ins ---------------
     Motion mode only: the .js-motion class scopes all pending states,
     so no-JS and reduced-motion render everything visible by default. */
  (function () {
    if (!document.documentElement.classList.contains("js-motion")) return;

    var reveals = [].slice.call(document.querySelectorAll(".reveal"));
    var stamps = [].slice.call(document.querySelectorAll("[data-stamp]"));

    stamps.forEach(function (block) {
      [].slice.call(block.querySelectorAll(".stamp-row")).forEach(function (row, i) {
        row.style.transitionDelay = (i * 70) + "ms";
        row.style.transitionDuration = "1ms";
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (entry.target.hasAttribute("data-stamp")) {
          entry.target.classList.add("stamped");
        } else {
          entry.target.classList.add("in");
        }
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    reveals.forEach(function (el) { io.observe(el); });
    stamps.forEach(function (el) { io.observe(el); });
  })();

})();
