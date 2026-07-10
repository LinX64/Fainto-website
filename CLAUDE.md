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

**Tokens are mirrored from the sibling Android app, not invented here.** The app was renamed VaultAI→Fainto (source now at `/Users/mohsen/StudioProjects/Fainto/`, package `com.fainto.*`). Canonical sources in `/Users/mohsen/StudioProjects/Fainto/core/designsystem/src/main/kotlin/com/fainto/core/designsystem/theme/`:

- `Color.kt` — dark scheme container ladder: page `#27272F` (surfaceContainerLowest) stepping up `#2E2E37 / #373741 / #3F3F49 / #474751`; WHITE chrome primary (`#FFFFFF` on `#2A2931`); violet brand `#A78BFA`.
- `DataAccents.kt` — bright data accents: cyan `#72DEFF`, green `#36F0AB`, amber `#FFCF44`, purple `#B15DFF`, coral `#FF6859`.
- `Shape.kt` — Rally "architectural": data cards crisp **0dp**, panels/sheets 28dp, pills for CTAs/chips.
- `MotionTokens.kt` — M3 emphasized easings, 150/220/300ms tiers.
- `Type.kt` — **Lexend app-wide** (Eczar + Roboto Condensed were dropped in June 2026; do not reintroduce them).

When a color/shape/type question comes up, reconcile against those files — not against screenshots (PNGs shift hues).

## Architecture

Three top-level files:

- **`index.html`** — one page, **sparse three-section cut (July 2026)**: sticky header → **hero** (app screenshot `.hero-shot` floating over a live **aurora**: `.hero-mesh` halo of four orbiting blobs + a full-bleed `.hero-wash`; copy left, device right) → **"What it is"** value strip (`.value` — eyebrow + heading + 3 hairline proof items, added 2026-07-10 to fix the cold-visitor gap) → **closing CTA** → footer colophon. Brand text is all **Fainto**. Store links keep the Play id `com.vaultai.app` (the immutable, live listing titled "Fainto: AI Finance Coach"; `com.fainto.app` 404s — do NOT change it). iOS is a matched-size but inert `.btn-soon` "coming soon" pill. JS hooks are `data-nav` + the `.reveal` class only (the old `data-ring*` ring/segmented control is gone). The earlier proof-heavy sections (spec ledger, reel, specimen, privacy/egress, tax, engine grid, premium) were removed for a sparse page — CSS/JS pruned too.
- **`styles.css`** — all styling; every color/shape/space/motion value flows from the `:root` tokens (no raw hexes below `:root`). Flat single-class selectors, no IDs, no `!important`. Breakpoints: 920 / 720 / 560. The `prefers-reduced-motion` block is last.
- **`app.js`** — one strict IIFE, now minimal: adds `.js-motion` to `<html>` only when `prefers-reduced-motion` allows AND `IntersectionObserver` exists (the additive-motion gate), a sticky-header scrolled state, and the `.reveal`-on-scroll IntersectionObserver. The mesh/aurora is **pure CSS** (seamless `rotate(360deg)` orbits + a `washdrift` translate loop) — no JS drives it.

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

- **`assets/screens/overview.png`** — the single hero product shot (640×1248, web-resized, phone status/nav bars cropped): the **Overview** dashboard — net income 12 482,22 zł/mo (+56.7%) with income/expenses/savings in the green/coral/amber data accents, above AI insights, accounts and bills. Sourced from the app repo `/Users/mohsen/StudioProjects/Fainto/build/run-shots/r03-overview-deep.png` (1080×2340) → `sips -c 2106 1080` to drop the system bars → `sips --resampleWidth 640`. The older `assets/screens/*` set + `reel/` were removed. To refresh: pick a frame from `build/run-shots/`, re-crop/resize the same way. (Decorative AI **sparkles** — `.spark`, the app's coach-sparkle motif in token colours — twinkle over the aurora margins around this shot; aria-hidden, js-motion-gated.)
- `assets/logo.svg`, `favicon.svg`, `og-image.png` (og image still shows the older design — regenerate when convenient).
- **Deprecated, do not reference**: `assets/promo/` (June 2026 pre-Lexend screens) and `assets/screenshots/` (old Play-Store cards with baked headlines).

## Content notes

- Product truth (verified against the app build, July 2026): **5 on-device models** — SmolLM 135M, Qwen 2.5 0.5B (free) and Qwen 2.5 1.5B, DeepSeek R1 1.5B, Phi-4 Mini 3.8B (Premium) — plus optional **Cloud AI via OpenRouter (Premium, opt-in)**. 9-country tax engine. Accounts exist but are optional → say "no account required", never "no accounts exist". The old model list (Gemma 2 / Llama / Mistral) is obsolete.
- Positioning is **educational information, not financial advice** — contractual framing. The store link uses Play id `com.vaultai.app`: verified live 2026-07-10 as the listing titled **"Fainto: AI Finance Coach"**, while `com.fainto.app` returns 404. The Android *source* package was renamed to `com.fainto`, but the *published store id* is immutable — **keep `com.vaultai.app` in every store link**; changing it breaks the live listing. iOS "coming soon" stays a note, not a real store link. Free / No account required / Works offline trio is also contractual.
