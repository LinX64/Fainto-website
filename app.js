!(function () {
  "use strict";
  var e,
    t = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    n = "IntersectionObserver" in window;
  !t && n && document.documentElement.classList.add("js-motion"),
    (function () {
      var e = document.querySelector("[data-nav]");
      if (e) {
        var t = !1;
        window.addEventListener(
          "scroll",
          function () {
            t || ((t = !0), requestAnimationFrame(n));
          },
          { passive: !0 },
        ),
          n();
      }
      function n() {
        e.classList.toggle("is-scrolled", window.scrollY > 8), (t = !1);
      }
    })(),
    (function () {
      if (document.documentElement.classList.contains("js-motion")) {
        var e = [].slice.call(document.querySelectorAll(".reveal"));
        if (e.length) {
          var t = new IntersectionObserver(
            function (e) {
              e.forEach(function (e) {
                e.isIntersecting && (e.target.classList.add("in"), t.unobserve(e.target));
              });
            },
            { threshold: 0.15 },
          );
          e.forEach(function (e) {
            t.observe(e);
          });
        }
      }
    })(),
    (function () {
      var e = document.querySelector("[data-shots]");
      if (e) {
        var n = [].slice.call(e.querySelectorAll(".shot-slide"));
        if (!(n.length < 2)) {
          var i = e.closest(".hero-stage") || e.parentNode,
            o = t ? "auto" : "smooth",
            a = 0,
            r = !1,
            s = null,
            c = document.createElement("div");
          c.className = "shot-nav";
          var l = document.createElement("div");
          l.className = "shot-dots";
          var d = n.map(function (e, t) {
            var i = document.createElement("button");
            return (
              (i.type = "button"),
              (i.className = "shot-dot"),
              i.setAttribute("aria-label", "Show screenshot " + (t + 1) + " of " + n.length),
              i.addEventListener("click", function () {
                v(t), E(), p();
              }),
              l.appendChild(i),
              i
            );
          });
          c.appendChild(l), i.appendChild(c);
          var u = !1;
          e.addEventListener(
            "scroll",
            function () {
              u ||
                ((u = !0),
                requestAnimationFrame(function () {
                  var t;
                  (t = Math.round(e.scrollLeft / e.clientWidth)), r ? t === a && (r = !1) : f(t), (u = !1);
                }));
            },
            { passive: !0 },
          ),
            window.addEventListener(
              "resize",
              function () {
                e.scrollLeft = e.clientWidth * a;
              },
              { passive: !0 },
            ),
            i.addEventListener("pointerenter", E),
            i.addEventListener("pointerleave", p),
            i.addEventListener("focusin", E),
            i.addEventListener("focusout", p),
            document.addEventListener("visibilitychange", function () {
              document.hidden ? E() : p();
            }),
            f(0),
            p();
        }
      }
      function m(e) {
        return Math.max(0, Math.min(n.length - 1, e));
      }
      function f(e) {
        (a = m(e)),
          d.forEach(function (e, t) {
            var n = t === a;
            e.classList.toggle("is-on", n),
              n ? e.setAttribute("aria-current", "true") : e.removeAttribute("aria-current");
          });
      }
      function v(t) {
        var n = m(t);
        Math.round(e.scrollLeft / e.clientWidth) !== n && (r = !0),
          e.scrollTo({ left: e.clientWidth * n, behavior: o }),
          f(n);
      }
      function h() {
        v((a + 1) % n.length);
      }
      function p() {
        t || null !== s || (s = setInterval(h, 4e3));
      }
      function E() {
        null !== s && (clearInterval(s), (s = null));
      }
    })(),
    (e = document.querySelector("[data-contact-form]")) &&
      e.addEventListener("submit", function (t) {
        if ((t.preventDefault(), "function" != typeof e.checkValidity || e.checkValidity())) {
          var n = u("name"),
            i = u("email"),
            o = u("message"),
            a = n ? (i ? (o ? null : "message") : "email") : "name";
          if (a) {
            var r = d(a);
            r && (r.setCustomValidity("Please fill this in."), r.reportValidity(), r.setCustomValidity(""));
          } else {
            var s = "Fainto — message from " + n,
              c = o + "\n\n— " + n + " <" + i + ">",
              l = e.querySelector("[data-form-note]");
            l && (l.hidden = !1),
              (window.location.href =
                "mailto:support@fainto.app?subject=" + encodeURIComponent(s) + "&body=" + encodeURIComponent(c));
          }
        } else e.reportValidity();
        function d(t) {
          return e.elements[t];
        }
        function u(e) {
          var t = d(e);
          return t && t.value ? t.value.trim() : "";
        }
      });
})();
