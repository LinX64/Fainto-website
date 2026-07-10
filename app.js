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

  /* ------------------- screenshot slider (auto-advance + dots) -------------------
     Horizontal scroll-snap track + injected dots. Auto-advances every 1.5s, but
     ONLY when prefers-reduced-motion allows, and it PAUSES on hover / keyboard
     focus / hidden tab; clicking a dot takes over and restarts the timer. So the
     motion is always stoppable (WCAG 2.2.2), and reduced-motion users get a
     static, dot-navigable slider with no movement. */
  (function () {
    var track = document.querySelector("[data-shots]");
    if (!track) return;
    var slides = [].slice.call(track.querySelectorAll(".shot-slide"));
    if (slides.length < 2) return;

    var stage = track.closest(".hero-stage") || track.parentNode;
    var behavior = reduceMotion ? "auto" : "smooth";
    var DELAY = 4000;
    var idx = 0, programmatic = false, timer = null;

    var nav = document.createElement("div");
    nav.className = "shot-nav";
    var dotsWrap = document.createElement("div");
    dotsWrap.className = "shot-dots";
    var dots = slides.map(function (slide, i) {
      var d = document.createElement("button");
      d.type = "button";
      d.className = "shot-dot";
      d.setAttribute("aria-label", "Show screenshot " + (i + 1) + " of " + slides.length);
      d.addEventListener("click", function () { go(i); restart(); });
      dotsWrap.appendChild(d);
      return d;
    });
    nav.appendChild(dotsWrap);
    stage.appendChild(nav);

    function clamp(i) { return Math.max(0, Math.min(slides.length - 1, i)); }

    function setActive(c) {
      idx = clamp(c);
      dots.forEach(function (d, i) {
        var on = i === idx;
        d.classList.toggle("is-on", on);
        if (on) { d.setAttribute("aria-current", "true"); } else { d.removeAttribute("aria-current"); }
      });
    }

    function go(i) {
      var t = clamp(i);
      /* mark a programmatic scroll so its own mid-animation frames don't clobber idx;
         only when it will actually move, else the flag would never clear (no scroll event). */
      if (Math.round(track.scrollLeft / track.clientWidth) !== t) programmatic = true;
      track.scrollTo({ left: track.clientWidth * t, behavior: behavior });
      setActive(t);
    }

    /* swipe-driven updates; while a programmatic scroll is in flight, ignore the
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

    /* auto-advance — motion-gated + pausable (hover / focus / hidden tab) */
    function tick() { go((idx + 1) % slides.length); }
    function start() { if (!reduceMotion && timer === null) timer = setInterval(tick, DELAY); }
    function stop() { if (timer !== null) { clearInterval(timer); timer = null; } }
    function restart() { stop(); start(); }

    stage.addEventListener("pointerenter", stop);
    stage.addEventListener("pointerleave", start);
    stage.addEventListener("focusin", stop);
    stage.addEventListener("focusout", start);
    document.addEventListener("visibilitychange", function () { if (document.hidden) { stop(); } else { start(); } });

    setActive(0);
    start();
  })();

  /* ------------------- contact form (static, no backend) -------------------
     On submit, build a clean mailto: so the message opens in the user's OWN
     email app — nothing is sent to or stored on any server (matches the app's
     no-tracking stance). The form has NO mailto action on purpose: an insecure
     (non-https) form target trips Chrome's "not secure / autofill off" warning.
     The visible support@fainto.app link is the no-JS fallback. Native `required`
     validation runs first. */
  (function () {
    var form = document.querySelector("[data-contact-form]");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      /* run native constraint validation (required / type=email / minlength) and
         show the browser's messages if anything is invalid */
      if (typeof form.checkValidity === "function" && !form.checkValidity()) { form.reportValidity(); return; }
      function field(n) { return form.elements[n]; }
      function val(n) { var el = field(n); return el && el.value ? el.value.trim() : ""; }
      var name = val("name"), email = val("email"), message = val("message");
      /* catch whitespace-only that slips past required/minlength */
      var missing = !name ? "name" : !email ? "email" : !message ? "message" : null;
      if (missing) {
        var el = field(missing);
        if (el) { el.setCustomValidity("Please fill this in."); el.reportValidity(); el.setCustomValidity(""); }
        return;
      }
      var subject = "Fainto — message from " + name;
      var body = message + "\n\n— " + name + " <" + email + ">";
      var note = form.querySelector("[data-form-note]");
      if (note) note.hidden = false;
      window.location.href = "mailto:support@fainto.app?subject=" +
        encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
  })();

})();
