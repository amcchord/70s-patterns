# 70sPatterns workbook

**Goal:** a small public site that generates 1970s, Bauhaus, op-art and abstract patterns on demand, with PNG export up to 8K. Clean execution and refined colour matter more than style count.

- Live: https://mcchord.net/patterns/
- Repo: https://github.com/amcchord/70s-patterns (public, MIT, branch `main`)
- History: [docs/progress/JOURNAL.md](docs/progress/JOURNAL.md)

## Map

```text
site/                 the deployable static site
  index.html          page shell (scripts/bump.py moves ?v=N on css/js)
  js/app.js           UI: state <-> URL hash, preview, variations, thumbnails, palettes, shelf, export
  js/core.js          PRNG/hash, palettes + palette rules, inventPalette(), renderPattern(), exportPNG()
  js/patterns.js      the 33 pattern generators, drawing helpers and ABOUT descriptions
  css/style.css       70s theme, light and dark
  sheet.html          dev contact sheet (not deployed)
  og.png, favicon.svg social preview and icon
scripts/deploy.sh     rsync site/ -> mcchord.net:/var/www/mcchord.net/patterns/ + HTTP checks
scripts/serve.py      no-cache local preview server
scripts/bump.py       bump every ?v=N cache buster together
scripts/check.mjs     palette rules, inventor, vintage and registry checks (node)
```

## Commands

```bash
python3 scripts/serve.py                                        # no-cache preview on :8771 (also .claude/launch.json "patterns")
node scripts/check.mjs                                          # palette rules, inventor, vintage, style registry
python3 scripts/bump.py                                         # bump ?v=N cache busters after CSS/JS changes
./scripts/deploy.sh                                             # publish (only when asked)
```

Contact sheet for visual QA: `http://127.0.0.1:8771/sheet.html?styles=waves,ogee&seeds=a,b,c&palette=harvest,disco&w=480&h=320&rot=0`.

## Palette rules

Palettes live in `site/js/core.js` with the rules written above them. When adding or editing one, check it in OKLab: inks at least ~10 ΔE apart, ~12 from the ground, with a dark anchor, mid tones and a light accent. Ground each palette in a real reference (a period, a material or an artist's pigments) and avoid brand names.

## Hosting

The site is static and lives on the shared mcchord.net server (`ssh mcchord.net`). Access details are in `~/Development/McChordFiles/docs/operations/RUNBOOK.md`. Apache serves `/var/www/mcchord.net`; this project owns only the `patterns/` subdirectory. It needs no server config.

## Known limits

- Exports need `CompressionStream`, which is in all current browsers. Older browsers fall back to `canvas.toBlob`, which is limited by their maximum canvas size.
- 8K UHD export times on a laptop (2026-11-03, measured on the first 27 styles; Parquet and Halftone are under 1 s at default settings, Halftone about 2 s at its finest): 0.6–1.8 s for most; Composition, Floating Circles, Op Bulge and Op Lines take 2.5–3 s; Liquid Groove takes 4.2 s. Strips yield with a MessageChannel, not setTimeout, so exports don't slow down in background tabs.
- Export strips use a software-rasterised canvas (`willReadFrequently`), so every strip is drawn the same way.
- Saved patterns ("Your shelf") live in the viewer's localStorage only; they are not synced anywhere.
- Sizes are capped at 16:1 (`fitSize` in app.js). Patterns scale to the shorter side, so an 8192 × 16 strip would hold hundreds of thousands of sub-pixel cells and take 20 s or more. At 8192 × 512, the smallest scale and maximum detail, every style exports in under 4 s.
