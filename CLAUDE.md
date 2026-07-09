# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page marketing website for **Fainto**, an offline-first personal-finance Android app with an on-device AI coach. 100% vanilla HTML/CSS/JS — **no framework, no build step, no dependencies, no package.json**. The design direction is "Rally, Out Loud — The Audited Cut": the app's own Material 3 "Rally" dark system extended to the web, typeset entirely in **Lexend** (the app's typeface), with a proof-over-claims structure.

## Commands

Nothing to build. Preview locally:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Deployment is GitHub Pages from `master` root; `.nojekyll` is present.

## Design system source of truth

**Tokens are mirrored from the sibling Android app, not invented here.** Canonical sources in `/Users/mohsen/StudioProjects/VaultAI/core/designsystem/src/main/kotlin/com/vaultai/designsystem/theme/`:

- `Color.kt` — dark scheme container ladder: page `#27272F` (surfaceContainerLowest) stepping up `#2E2E37 / #373741 / #3F3F49 / #474751`; WHITE chrome primary (`#FFFFFF` on `#2A2931`); violet brand `#A78BFA`.
- `DataAccents.kt` — bright data accents: cyan `#72DEFF`, green `#36F0AB`, amber `#FFCF44`, purple `#B15DFF`, coral `#FF6859`.
- `Shape.kt` — Rally "architectural": data cards crisp **0dp**, panels/sheets 28dp, pills for CTAs/chips.
- `MotionTokens.kt` — M3 emphasized easings, 150/220/300ms tiers.
- `Type.kt` — **Lexend app-wide** (Eczar + Roboto Condensed were dropped in June 2026; do not reintroduce them).

When a color/shape/type question comes up, reconcile against those files — not against screenshots (PNGs shift hues).

## Architecture

Three top-level files:

- **`index.html`** — one page, **minimalist two-section cut (July 2026)**: sticky header → hero (CSS conic ring + working Income/Expenses/Savings segmented control) → closing CTA → footer colophon. Rebranded VaultAI→**Fainto** in the same pass — **visible brand text only**; the Play id stays `com.vaultai.app` and the Pages/og host stays `vaultai-website` (app package + repo were NOT renamed). JS hooks are `data-*` attributes only (`data-nav`, `data-ring*`) plus the `.reveal` class. The earlier proof-heavy sections below (spec ledger, reel, specimen, privacy/egress, tax, engine grid, premium) were removed at the user's request for a sparse page — their CSS/JS was pruned too.
- **`styles.css`** — all styling; every color/shape/space/motion value flows from the `:root` tokens (no raw hexes below `:root`). Flat single-class selectors, no IDs, no `!important`. Breakpoints: 920 / 720 / 560. The `prefers-reduced-motion` block is last.
- **`app.js`** — one strict IIFE with independent sub-modules: header scrolled state, hero ring + segmented control, the reel (drag, morph, IntersectionObserver dots, prev/next), live egress ledger (PerformanceObserver), reveal/stamp observers.

### Binding design laws (from the judged design brief — do not regress)

> Note: after the July 2026 two-section cut, laws referencing the reel, live egress ledger, spec-ledger gradient, and tax table describe **removed** sections — kept here for history. The still-active spirit: no auto-advance/auto-play, figures never tween (typeset), static-visible is the CSS default with JS-added motion gated on `prefers-reduced-motion`, corners/colors from tokens only, no glows.

1. **No auto-advancing** carousel or timers, ever (WCAG 2.2.2; a previous version auto-cycled — it was killed by a 3-judge panel).
2. **Figures never count up or tween** — numerals are typeset; the live ledger swaps text instantly.
3. **Exactly one gradient** on the page: the spec-ledger closing double rule (`--grad`). The tax double rule is solid green.
4. The website never claims zero traffic for **itself** — its egress figures are measured live via the Performance API (or replaced by honest static copy when the API is missing). The app's `0 requests · 0 B` row is framed "by default, by design".
5. Motion is **additive**: static-visible is the CSS default; JS adds the `js-motion` class (only when `prefers-reduced-motion` allows) and all pending/moving states are scoped under it. No-JS and reduced-motion render everything visible and functional.
6. Every sample figure matches a real app screenshot and sits near a "sample data" disclosure. Current values: net income 12 482,22 zł (+56.7%), income 12.5K / expenses 1.0K / savings 7.1K zł, accounts 107 400,00 zł, tax PLN 240,000 → 149,787 (Poland preset), IKZE insight quote verbatim.
7. Corner radii only from the shape tokens; no decorative shape alternation. No glows or colored shadows.

## Assets

- **`assets/screens/`** — the eight current app screenshots (1080×2090, status/nav bars cropped), captured 2026-07-01 from the live `com.vaultai.app.debug` build via adb; `assets/screens/reel/` holds 640px-wide copies used by the reel (after the two-section cut the page no longer references any of them — retained for future use). To refresh: connect the device, launch the app, `adb exec-out screencap -p`, crop top 100px / bottom 150px.
- `assets/logo.svg`, `favicon.svg`, `og-image.png` (og image still shows the older design — regenerate when convenient).
- **Deprecated, do not reference**: `assets/promo/` (June 2026 pre-Lexend screens) and `assets/screenshots/` (old Play-Store cards with baked headlines).

## Content notes

- Product truth (verified against the app build, July 2026): **5 on-device models** — SmolLM 135M, Qwen 2.5 0.5B (free) and Qwen 2.5 1.5B, DeepSeek R1 1.5B, Phi-4 Mini 3.8B (Premium) — plus optional **Cloud AI via OpenRouter (Premium, opt-in)**. 9-country tax engine. Accounts exist but are optional → say "no account required", never "no accounts exist". The old model list (Gemma 2 / Llama / Mistral) is obsolete.
- Positioning is **educational information, not financial advice** — that framing is contractual copy, as are the real Play id `com.vaultai.app` (kept — the app package did NOT rename), iOS "coming soon" (a note, not a fake store link), and the Free / No account required / Works offline trio.
