/* =========================================================================
   VaultAI website — interactions
   - Aurora "neural field" canvas (the on-device AI thinking)
   - Streaming financial-insight typewriter
   - Scroll reveals, stat count-up, nav state, gallery drag
   Vanilla JS, no dependencies. Honors prefers-reduced-motion.
   ========================================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COLORS = ["114,222,255", "167,139,250", "177,93,255"]; // cyan, violet, purple

  /* shared pointer in viewport coordinates (updated passively) */
  var pointer = { x: -9999, y: -9999, nx: 0, ny: 0 };
  window.addEventListener(
    "pointermove",
    function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.nx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ny = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  /* ----------------------------------------------------------------------
     Aurora neural field
  ---------------------------------------------------------------------- */
  function createField(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;
    var dense = canvas.classList.contains("cta-canvas");
    var w = 0, h = 0, dpr = 1, nodes = [], maxDist = 130, rect = { left: 0, top: 0 };
    var core = { x: 0, y: 0 };

    function cacheRect() {
      var r = canvas.getBoundingClientRect();
      rect.left = r.left;
      rect.top = r.top;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var target = Math.floor((w * h) / 16000);
      var cap = dense ? 40 : 74;
      var count = Math.max(16, Math.min(cap, target));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          c: (Math.random() * COLORS.length) | 0,
          r: Math.random() * 1.5 + 0.7
        });
      }
      maxDist = Math.min(165, Math.max(110, Math.hypot(w, h) * 0.1));
      core.x = w * (dense ? 0.5 : 0.62);
      core.y = h * (dense ? 0.5 : 0.42);
      cacheRect();
    }

    function draw(time) {
      ctx.clearRect(0, 0, w, h);

      /* parallax + local pointer */
      var lpx = pointer.x - rect.left;
      var lpy = pointer.y - rect.top;
      var inView = lpx > -40 && lpx < w + 40 && lpy > -40 && lpy < h + 40;
      var par = reduceMotion ? 0 : 10;
      var ox = pointer.nx * par;
      var oy = pointer.ny * par;

      /* breathing AI core */
      var pulse = 0.5 + 0.5 * Math.sin(time * 0.0013);
      var cr = Math.min(w, h) * (0.45 + 0.06 * pulse);
      var g = ctx.createRadialGradient(core.x + ox, core.y + oy, 0, core.x + ox, core.y + oy, cr);
      g.addColorStop(0, "rgba(167,139,250," + (0.10 + 0.05 * pulse).toFixed(3) + ")");
      g.addColorStop(0.5, "rgba(114,222,255,0.035)");
      g.addColorStop(1, "rgba(39,39,47,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      /* pointer glow */
      if (inView && !reduceMotion) {
        var pg = ctx.createRadialGradient(lpx, lpy, 0, lpx, lpy, 120);
        pg.addColorStop(0, "rgba(114,222,255,0.10)");
        pg.addColorStop(1, "rgba(114,222,255,0)");
        ctx.fillStyle = pg;
        ctx.fillRect(0, 0, w, h);
      }

      /* move nodes */
      var i, j, n;
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        if (!reduceMotion) {
          n.x += n.vx;
          n.y += n.vy;
          if (inView) {
            var dxp = n.x - lpx, dyp = n.y - lpy;
            var dp2 = dxp * dxp + dyp * dyp;
            if (dp2 < 12000 && dp2 > 1) {
              var f = 0.4 / Math.sqrt(dp2);
              n.x += dxp * f;
              n.y += dyp * f;
            }
          }
        }
        if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10; else if (n.y > h + 10) n.y = -10;
      }

      /* connections */
      ctx.lineWidth = 1;
      for (i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        for (j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxDist) {
            var alpha = (1 - d / maxDist) * 0.42;
            ctx.strokeStyle = "rgba(" + COLORS[a.c] + "," + alpha.toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(a.x + ox, a.y + oy);
            ctx.lineTo(b.x + ox, b.y + oy);
            ctx.stroke();
          }
        }
      }

      /* nodes */
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + COLORS[n.c] + ",0.9)";
        ctx.arc(n.x + ox, n.y + oy, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return { resize: resize, draw: draw, cacheRect: cacheRect };
  }

  var canvases = Array.prototype.slice.call(document.querySelectorAll("[data-aurora]"));
  var fields = canvases.map(createField).filter(Boolean);

  function resizeAll() { fields.forEach(function (f) { f.resize(); }); }
  resizeAll();

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeAll, 150);
  });

  /* recache canvas positions on scroll (throttled via rAF) */
  var rectQueued = false;
  window.addEventListener(
    "scroll",
    function () {
      if (rectQueued) return;
      rectQueued = true;
      requestAnimationFrame(function () {
        fields.forEach(function (f) { f.cacheRect(); });
        rectQueued = false;
      });
    },
    { passive: true }
  );

  if (reduceMotion) {
    /* one elegant static frame, no loop */
    fields.forEach(function (f) { f.draw(0); });
  } else {
    var running = true;
    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
      if (running) requestAnimationFrame(loop);
    });
    function loop(time) {
      if (!running) return;
      for (var i = 0; i < fields.length; i++) fields[i].draw(time);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ----------------------------------------------------------------------
     Streaming financial-insight typewriter
  ---------------------------------------------------------------------- */
  (function () {
    var el = document.querySelector("[data-insight]");
    if (!el) return;
    var insights = [
      "Build an emergency fund covering 3–6 months of expenses before investing.",
      "Automate savings — schedule 20% of net income to transfer on payday.",
      "You're spending 34% on housing — under the 35% guardrail. Nice.",
      "Maxing IKZE could cut this year's tax bill by ~zł 2,400.",
      "Three subscriptions renewed this week — cancel the unused one to save zł 47/mo."
    ];

    if (reduceMotion) {
      el.textContent = insights[0];
      return;
    }

    var idx = 0, ch = 0, deleting = false;
    function tick() {
      if (document.hidden) {
        setTimeout(tick, 400);
        return;
      }
      var text = insights[idx];
      if (!deleting) {
        ch++;
        el.textContent = text.slice(0, ch);
        if (ch >= text.length) {
          deleting = true;
          setTimeout(tick, 2600);
          return;
        }
        setTimeout(tick, 26 + Math.random() * 34);
      } else {
        ch -= 2;
        if (ch <= 0) {
          ch = 0;
          deleting = false;
          idx = (idx + 1) % insights.length;
          setTimeout(tick, 320);
          return;
        }
        el.textContent = text.slice(0, ch);
        setTimeout(tick, 14);
      }
    }
    setTimeout(tick, 700);
  })();

  /* ----------------------------------------------------------------------
     Reveal on scroll
  ---------------------------------------------------------------------- */
  (function () {
    var items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!items.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach(function (el) { io.observe(el); });
  })();

  /* ----------------------------------------------------------------------
     Stat count-up
  ---------------------------------------------------------------------- */
  (function () {
    var nums = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
    if (!nums.length) return;
    function setFinal(el) {
      el.textContent = el.getAttribute("data-count") + (el.getAttribute("data-suffix") || "");
    }
    if (reduceMotion || !("IntersectionObserver" in window)) {
      nums.forEach(setFinal);
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          io.unobserve(el);
          var target = parseInt(el.getAttribute("data-count"), 10) || 0;
          var suffix = el.getAttribute("data-suffix") || "";
          if (target === 0) { el.textContent = "0" + suffix; return; }
          var start = null, dur = 1100;
          function frame(t) {
            if (start === null) start = t;
            var p = Math.min(1, (t - start) / dur);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(eased * target) + suffix;
            if (p < 1) requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        });
      },
      { threshold: 0.5 }
    );
    nums.forEach(function (el) { io.observe(el); });
  })();

  /* ----------------------------------------------------------------------
     Navbar scrolled state
  ---------------------------------------------------------------------- */
  (function () {
    var nav = document.querySelector("[data-nav]");
    if (!nav) return;
    var ticking = false;
    function update() {
      nav.classList.toggle("scrolled", window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      },
      { passive: true }
    );
    update();
  })();

  /* ----------------------------------------------------------------------
     Gallery drag-to-scroll (mouse); touch uses native scrolling
  ---------------------------------------------------------------------- */
  (function () {
    var gallery = document.querySelector("[data-gallery]");
    if (!gallery) return;
    var down = false, startX = 0, startScroll = 0, moved = false;
    gallery.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch") return;
      down = true;
      moved = false;
      startX = e.clientX;
      startScroll = gallery.scrollLeft;
    });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      gallery.scrollLeft = startScroll - dx;
      if (moved) gallery.classList.add("dragging");
    });
    window.addEventListener("pointerup", function () {
      down = false;
      gallery.classList.remove("dragging");
    });
    /* prevent accidental link/image drag selection while dragging */
    gallery.addEventListener("dragstart", function (e) { e.preventDefault(); });
  })();
})();
