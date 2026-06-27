# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page marketing website for **VaultAI**, an offline-first personal-finance app with an on-device AI coach. 100% vanilla HTML/CSS/JS — **no framework, no build step, no dependencies, no package.json**. The site deliberately mirrors the app's **Material 3 "Rally" dark** design system (neutral blue-grey surfaces, WHITE chrome primary, violet brand accent, with cyan/green/amber/coral/purple data accents and Rally "architectural" crisp 0 dp cards).

## Commands

There is nothing to build or compile. To preview locally:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

The site also works opened directly over `file://`. Deployment is GitHub Pages from the `master` branch root; `.nojekyll` is present so assets serve as-is

## Architecture

Three top-level files do all the work:

- **`index.html`** — all markup, one page, ~9 `<section>` blocks in order: hero → trust strip → features → privacy band → screens (gallery) → how-it-works → download CTA → footer. Elements are wired to JS purely through `data-*` attributes (`data-aurora`, `data-insight`, `data-nav`, `data-gallery`, `data-count`/`data-suffix`) and the `.reveal` class — there are no IDs used as JS hooks. Section accent colors are passed via inline `style="--accent:#..."`.
- **`styles.css`** — all styling. The Material 3 "Rally" design system lives in `:root` as CSS custom properties: neutral blue-grey surfaces `--bg:#27272F` (page) stepping up through `--surface:#2E2E37` / `--surface-2:#373741` (cards) / `--surface-3:#3F3F49` / `--surface-4:#474751`; WHITE chrome `--primary:#FFFFFF` (with `--on-primary:#2A2931` / `--primary-container:#373741` / `--on-primary-container:#FFFFFF`) drives filled buttons, focus ring, caret and check marks; brand color comes from the VIOLET `--secondary:#A78BFA` (seed `#7C3AED`, used for eyebrows/accents/step chips via `--secondary-container:#2E2640` / `--on-secondary-container:#E9DDFF`) plus the data accents `--teal:#72DEFF` (brand cyan), `--positive:#36F0AB` (income green), `--amber`/`--tertiary:#FFCF44` (savings), `--alert:#B15DFF` (purple) and `--error`/`--spend:#FF6859` (coral); text `--text:#FFFFFF` / `--muted:#AEAEB1` / `--muted-2:#8F8F99`; the hairline `--line:rgba(174,174,177,0.20)` with `--outline:#8F8F99`; the `--grad` brand gradient (purple→cyan→green); Rally "architectural" shapes `--r-lg:28` (big panels) and crisp `--r-md:0` / `--r-sm:0` (cards, steps, stream, tiles), with pills reserved for CTAs/chips. Components follow M3: filled tonal cards, state-layer hovers (the white primary darkens toward `--on-primary` on hover), tonal violet chips (`.eyebrow`/`.step-n`), restrained elevation shadows (no neon glows). **Change colors and spacing through these tokens, not by hardcoding values in rules.** Responsive breakpoints are at the bottom (920 / 720 / 560px) followed by a `prefers-reduced-motion` block.
- **`app.js`** — all interaction, one IIFE in strict mode, organized as independent sub-IIFEs: the Aurora "neural field" canvas, the streaming-insight typewriter, scroll reveals, stat count-up, navbar scrolled-state, and gallery drag-to-scroll. No modules, no imports.

### Conventions that matter

- **`prefers-reduced-motion` is honored everywhere.** `app.js` reads it once into `reduceMotion` at the top; every animated feature has a static fallback (canvas draws one frame, typewriter shows full text, reveals/counts jump to final). When adding any animation, add the reduced-motion path too — both in JS and in the CSS media block.
- **The canvas color palette is duplicated**: `COLORS` in `app.js` (as `"r,g,b"` strings — currently `["114,222,255","167,139,250","177,93,255"]`, i.e. cyan/violet/purple) must stay in sync with the `--teal`/`--secondary`/`--alert` brand data-accent tokens in `styles.css`.
- **`data-aurora` canvases self-configure**: the CTA canvas is detected via `classList.contains("cta-canvas")` to run a denser, centered field. Any new aurora canvas just needs the `data-aurora` attribute.
- Performance patterns are intentional: scroll/resize handlers are throttled via `requestAnimationFrame` or debounce timers, the render loop pauses on `visibilitychange`, and DPR is capped at 2.
- **The design tokens are mirrored from the app, not invented here.** The canonical Rally M3 values are the sibling VaultAI Android app's `core/designsystem` theme — when a color or shape needs to change, reconcile against that source, not against the screenshots (PNGs compress/shift the hues).

### Assets

`assets/` holds brand SVGs (`logo.svg`, `favicon.svg`, custom store badges, `og-image.svg`/`.png`) and `assets/screenshots/` holds the five self-contained Play-Store marketing cards (`overview`, `accounts`, `transactions`, `bills`, `explore` `.png`) — each bakes in its own headline, device frame and dark Rally M3 background. They're shown directly (no CSS phone mockup): the hero uses `overview.png` in a cropped `.hero-shot` and the Screens gallery renders all five as `.shot` cards.

## Content notes

- Marketing copy is grounded in the app's real features (on-device LLMs — Gemma 2, Qwen 2.5, Phi, Llama, Mistral; a 9-country tax engine; scenario planning; opt-in cloud deep-analysis). It is positioned as educational information, **not financial advice** — keep that framing.
- The Google Play link uses real id `com.vaultai.app`; the **App Store URL is a placeholder** (iOS "coming soon") — swap in the real listing id when published.
