# VaultAI — Promo Video Export Guide

The promo lives at `VaultAI Promo Video.dc.html` (1920×1080, ~29s, loops).
Google Play shows promo videos as a **YouTube link**, so the goal is: get a video
file → upload to YouTube (unlisted is fine) → paste that URL in Play Console
(*Store listing → Video*).

You can't upload an MP4 to Google Play directly — it must be a YouTube URL.

---

## Easiest: one-click recording  →  `vaultai-promo.webm`

Screen capture and `Export Promo Video.html` only work from a **secure origin**,
which means `http://localhost`. Two-minute setup:

1. Open a terminal **in this `promo/` folder** and start a tiny local server:

   ```bash
   python3 -m http.server 8000
   ```

2. In Chrome, go to:

   ```
   http://localhost:8000/Export%20Promo%20Video.html
   ```

3. **Maximize** the browser window (or click **⤢ Fullscreen**) so the frame is as
   large as possible — this sets the recording resolution.

4. Click **● Record .webm**. When Chrome asks what to share, pick
   **This Tab** and Share. The control bar hides, the promo plays once from the
   top, and a `vaultai-promo.webm` file downloads automatically when it finishes
   (~29s).

That `.webm` uploads straight to YouTube. Done.

> Tip: a maximized window on a 1080p+ display records at ~1080p. On a smaller
> screen, plug into / mirror to a larger display first for crisper output.

---

## Optional: convert / clean up with ffmpeg

YouTube accepts the `.webm` as-is, but if you want a standard MP4 (H.264):

```bash
ffmpeg -i vaultai-promo.webm -c:v libx264 -pix_fmt yuv420p -crf 18 vaultai-promo.mp4
```

If the recording has black bars and you want to crop to a clean 1920×1080
(adjust the crop offsets to taste):

```bash
ffmpeg -i vaultai-promo.webm -vf "crop=1920:1080,scale=1920:1080" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 vaultai-promo.mp4
```

---

## Alternative: any screen recorder

If you'd rather not use the exporter page, open the promo in record mode:

```
http://localhost:8000/VaultAI%20Promo%20Video.dc.html?record=1
```

`?record=1` hides the scrubber and plays it once cleanly. Capture it with
QuickTime (Mac: ⌘⇧5), the Xbox Game Bar (Windows: ⊞+G), OBS, or any recorder,
then trim to the loop and upload.

---

## Editing the video

All content is in `animations.jsx` (search for `VP_FEATURES`):
headlines, tag chips, subtitles, phone screenshots, and per-scene gradient
positions. Timing knobs are in the `PROMO` block — `SD` is seconds per feature
scene, `INTRO` / `OUTRO` are the bookend durations.
