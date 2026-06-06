# VaultAI — Marketing Website

A unique, single-page marketing site for **VaultAI**, the offline-first personal-finance app
with an on-device AI coach. Built to mirror the app's **Aurora** design system.

> _Private AI for your money — a real language model that runs entirely on your phone._

## ✨ Highlights

- **Signature AI animation** — a hand-written `<canvas>` "neural aurora field" with a breathing
  on-device core and a financial-insight **typewriter** that streams advice token-by-token, exactly
  like the app's on-device LLM (`generating on-device · running gemma2-2b · 0 bytes uploaded`).
- **Aurora design system** — cosmic-void `#08080F`, Aurora Violet `#7B61FF`, Teal `#00D4C8`,
  Rose `#FF5FA0`, Amber `#FFB347`; Plus Jakarta Sans + DM Mono (numbers), straight from
  `core/designsystem/theme/Theme.kt`.
- **Real app screenshots** framed in CSS phone mockups (dark-theme captures from the app's
  snapshot tests), including an auto-scrolling hero device.
- **Google Play + App Store** download badges (custom, brand-accurate SVGs).
- 100% vanilla **HTML/CSS/JS** — no framework, no build step, no dependencies.
- Responsive (360px → desktop), accessible (semantic landmarks, focus rings, alt text), and fully
  honors `prefers-reduced-motion`.

## 🗂 Structure

```
index.html              # markup — 9 sections (hero → footer)
styles.css              # Aurora tokens + all styling
app.js                  # canvas neural field, insight stream, reveals, count-up, gallery drag
assets/
  logo.svg              # brand mark (white "V" + amber star, cosmic squircle)
  favicon.svg
  og-image.svg / .png   # 1200×630 social share card
  badge-google-play.svg
  badge-app-store.svg
  screenshots/          # real dark-theme app captures
    dashboard.png  insights.png  chat.png  premium.png  settings.png  onboarding.png
```

## 🚀 Preview

Just open `index.html` in a browser (works over `file://`), or serve it:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## 🌐 Deploy (GitHub Pages)

It's a static site — push to a repo and enable Pages on the `master` branch (root).
A `.nojekyll` file is included so the assets are served as-is.

## 📝 Notes

- **Store links** point at `com.vaultai.app` on Google Play; the App Store URL is a placeholder
  (iOS is "coming soon") — swap in the real listing IDs when published.
- Screenshots are the app's dark-theme UI; they already carry the cosmic background, so they blend
  into the phone mockups seamlessly.
- This content is marketing copy, grounded in the app's real features (on-device LLM, 9-country tax
  engine, scenario planning, opt-in cloud deep-analysis). It is not financial advice.
