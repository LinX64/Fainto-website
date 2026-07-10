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

  /* ------------------- screenshot slider (manual) -------------------
     Horizontal scroll-snap track + injected prev/next/dots. NO timer,
     NO auto-advance (design law 1 / WCAG 2.2.2) — user-driven only. Runs
     regardless of the .js-motion gate so navigation works for reduced-motion
     users too; only the scroll animation itself honours prefers-reduced-motion. */
  (function () {
    var track = document.querySelector("[data-shots]");
    if (!track) return;
    var slides = [].slice.call(track.querySelectorAll(".shot-slide"));
    if (slides.length < 2) return;

    var stage = track.closest(".hero-stage") || track.parentNode;
    var behavior = reduceMotion ? "auto" : "smooth";
    var idx = 0;

    var nav = document.createElement("div");
    nav.className = "shot-nav";
    var prev = arrowBtn("prev", "Previous screenshot", "M15 18l-6-6 6-6");
    var dotsWrap = document.createElement("div");
    dotsWrap.className = "shot-dots";
    var next = arrowBtn("next", "Next screenshot", "M9 18l6-6-6-6");

    var dots = slides.map(function (slide, i) {
      var d = document.createElement("button");
      d.type = "button";
      d.className = "shot-dot";
      d.setAttribute("aria-label", "Show screenshot " + (i + 1) + " of " + slides.length);
      d.addEventListener("click", function () { go(i); });
      dotsWrap.appendChild(d);
      return d;
    });

    nav.appendChild(prev);
    nav.appendChild(dotsWrap);
    nav.appendChild(next);
    stage.appendChild(nav);

    prev.addEventListener("click", function () { go(idx - 1); });
    next.addEventListener("click", function () { go(idx + 1); });

    var programmatic = false;

    function clamp(i) { return Math.max(0, Math.min(slides.length - 1, i)); }

    /* update dots + disabled state directly — never depend on the scroll event
       firing (button clicks must feel instant; swipes call this via sync). */
    function setActive(c) {
      idx = clamp(c);
      dots.forEach(function (d, i) {
        var on = i === idx;
        d.classList.toggle("is-on", on);
        if (on) { d.setAttribute("aria-current", "true"); } else { d.removeAttribute("aria-current"); }
      });
      /* aria-disabled (NOT the `disabled` property) so an end arrow keeps focus
         instead of dropping it to <body>; go() is clamped, so a click safely no-ops. */
      prev.setAttribute("aria-disabled", idx <= 0 ? "true" : "false");
      next.setAttribute("aria-disabled", idx >= slides.length - 1 ? "true" : "false");
    }

    function go(i) {
      var t = clamp(i);
      /* mark a button-driven scroll so its own mid-animation frames don't clobber idx;
         only when it will actually move, else the flag would never clear (no scroll event). */
      if (Math.round(track.scrollLeft / track.clientWidth) !== t) programmatic = true;
      track.scrollTo({ left: track.clientWidth * t, behavior: behavior });
      setActive(t);
    }

    /* swipe-driven updates; while a button scroll is in flight, ignore the
       mid-animation frames and clear the flag once we've arrived at the target. */
    function sync() {
      var c = Math.round(track.scrollLeft / track.clientWidth);
      if (programmatic) { if (c === idx) programmatic = false; return; }
      setActive(c);
    }

    var ticking = false;
    track.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { sync(); ticking = false; }); }
    }, { passive: true });
    window.addEventListener("resize", function () { track.scrollLeft = track.clientWidth * idx; }, { passive: true });

    sync();

    function arrowBtn(kind, label, d) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "shot-arrow shot-" + kind;
      b.setAttribute("aria-label", label);
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';
      return b;
    }
  })();

  /* ------------------- contact form (static, no backend) -------------------
     On submit, build a clean mailto: so the message opens in the user's OWN
     email app — nothing is sent to or stored on any server (matches the app's
     no-tracking stance). No-JS fallback: the form's action="mailto:" still opens
     the mail app. Native `required` validation runs first (no novalidate). */
  (function () {
    var form = document.querySelector("[data-contact-form]");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      function val(n) { var el = form.elements[n]; return el && el.value ? el.value.trim() : ""; }
      var name = val("name"), email = val("email"), message = val("message");
      var subject = "Fainto — message from " + (name || "someone");
      var body = message + "\n\n— " + name + " <" + email + ">";
      var note = form.querySelector("[data-form-note]");
      if (note) note.hidden = false;
      window.location.href = "mailto:support@fainto.app?subject=" +
        encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
  })();

})();
