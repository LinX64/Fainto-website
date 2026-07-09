# Fainto — marketing site

Single-page marketing website for **Fainto**, an offline-first personal-finance app that runs real language models entirely on the phone.

- **Stack:** vanilla HTML + CSS + JS. No framework, no build step, no dependencies.
- **Design:** the app's own Material 3 "Rally" dark system (mirrored from the app's `core/designsystem` tokens), set in Lexend.
- **Signature pieces:** a CSS-drawn Rally ring with a working segmented control, a draggable reel of eight real app screenshots, and a live outbound-traffic ledger measured in the visitor's own browser.

## Structure

```
index.html          # one page: hero → spec ledger → reel → specimen → privacy → tax → engine → premium → CTA
styles.css          # Rally M3 tokens (:root) + all styling
app.js              # ring control, reel, live egress ledger, reveals — all motion JS-added and RM-gated
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

Honors `prefers-reduced-motion` end-to-end: static-visible content is the default; JavaScript only ever *adds* motion. The screenshot reel never auto-advances. All figures are sample data from the app's demo profile; Fainto provides educational information, not financial advice.
