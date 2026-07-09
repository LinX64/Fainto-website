# Fainto — marketing site

Single-page marketing website for **Fainto**, an offline-first personal-finance app that runs real language models entirely on the phone.

- **Stack:** vanilla HTML + CSS + JS. No framework, no build step, no dependencies.
- **Design:** the app's own Material 3 "Rally" dark system (mirrored from the app's `core/designsystem` tokens), set in Lexend.
- **Signature piece:** a CSS-drawn Rally ring with a working Income / Expenses / Savings segmented control.
- **Shape:** minimalist two-section cut — hero (ring) → closing CTA.

## Structure

```
index.html          # one page: hero (ring) → closing CTA
styles.css          # Rally M3 tokens (:root) + all styling
app.js              # header state, ring + seg control, scroll reveals — all motion JS-added and RM-gated
assets/
  logo.svg  favicon.svg  og-image.png
  screens/          # current app captures (1080×2090), reel/ holds 640px copies
```

## Develop

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Also works over `file://`.

## Deploy

GitHub Pages serves the `master` branch root (`.nojekyll` included).

## Accessibility & motion

Honors `prefers-reduced-motion` end-to-end: static-visible content is the default; JavaScript only ever *adds* motion. Nothing auto-advances or auto-plays. The ring figures are sample data from the app's demo profile; Fainto provides educational information, not financial advice.
