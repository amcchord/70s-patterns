# Journal

## 2026-11-02 — initial build, repo and deploy

**Scope:** new project. Built the Groovy Pattern Machine static site, created the public repo `amcchord/70s-patterns`, and published to https://mcchord.net/patterns/.

**Built**
- 14 generators: 10 in the 1970s family, 4 Bauhaus/geometric. Inspired by the reference sheets Austin supplied, but original designs.
- 14 palettes, editable colours, sliders, seeded URL state, history, keyboard shortcuts.
- Strip-based PNG encoder (CompressionStream + hand-written chunks), up to 8192 px per side.

**Verified**
- Contact sheets across seeds, palettes and a 20° rotation for all 14 styles.
- Kaleido Quilt had anti-aliasing hairlines between same-coloured triangles. Fixed by filling one path per colour.
- 8K UHD exports decode as valid 7680 × 4320 RGB PNGs in 0.3–1.9 s; 8192 × 8192 Liquid Groove takes 3.8 s.
- Rows at strip boundaries change no more than the same rows in a single-canvas render, so there are no seams. Inspected 100% crops.
- UI checked at desktop width, at 375 px mobile (no horizontal overflow), and in dark mode.
- Every control was exercised: new, back, style, palette, detail, shuffle, custom size clamping to 8192, seed entry, reload from hash, and the download path. No console errors.

**Production actions:** created `/var/www/mcchord.net/patterns/` and rsynced the site into it. Nothing else on the server was touched.

**Next:** none required. Possible extras: seamless-tile export, SVG export, more styles.

## 2026-11-03 — palettes, twelve new styles, refinement loop

**Scope:** Austin asked for more palettes, then a two-hour improvement loop aimed at a "masterpiece" with clean execution. Kandinsky-style abstracts were welcome. Mid-session he asked for refined, non-generic palettes.

**Built** (all on `main`, pushed and deployed in four checkpoints)
- Styles, 14 → 26:
  - *1970s:* Rainbow Tiles, Sunrise.
  - *Geometric & op:* Tumbling Blocks, Op Squares, Op Bulge (per pixel, lens-warped), Op Lines.
  - *Art & abstract:* Composition, Floating Circles and Color Study (after Kandinsky), De Stijl Grid, Cut-Outs (after Matisse), Atomic Age.
- Palettes, 14 → 43, in four tabbed groups. After an OKLab audit they were rebuilt from real references; the rules are written above `PALETTES`.
- Invent palette:
  - It either remixes a curated palette by turning its hues in OKLCH, or composes one from pigment rules.
  - Chroma is capped by hue, so greens and cyans don't go neon.
  - Results whose colours sit too close together are rejected.
- UI additions:
  - Flip ground, Variations row (six alternative seeds), Your shelf (localStorage), and a style description under the preview.
  - `[` `]` and `P` shortcuts.
  - Palette tabs stay on one line on phones.
- New social image.

**Fixed**
- Op Lines strokes folded at tight crests and left pinholes. Lines are now filled ribbons; a crack scan of the 8K output finds 0.
- Export strips now render in software (`willReadFrequently`), so every strip is rasterised the same way.
- Starburst hubs had anti-aliasing specks; the spikes now start at the centre.
- Op Bulge lenses could fold the grid where they overlapped; they now apply one after another.

**Verified**
- Labelled QA grids of all styles across many palettes: dark, three-colour, pastel and invented.
- Palette boards rendered per group, plus 20 invented palettes.
- 8K exports decode at full size; 100% crops inspected.
- Strip renders match a single-canvas render apart from anti-aliasing jitter.
- Mobile at 375 px has no overflow; dark mode checked.
- Save, load and remove on the shelf, and variation swapping, were exercised. No console errors.

**Production actions:** rsynced `site/` to `/var/www/mcchord.net/patterns/` four times with `scripts/deploy.sh`. Nothing else on the server was touched.

**Later the same session**
- Colour roles: tile and scatter styles weight colours 60-30-10, with the ground and one seed-chosen lead ink, so palettes read as designed rather than evenly spread.
- Palette from image (button or drag and drop): k-means in OKLab over a 160 px local copy, then the same palette rules. Nothing is uploaded.
- New style, Kaleidoscope: a mirrored mandala, alone or as 4-fold mirrored tiles with grout.
- Smaller changes:
  - Copy hex.
  - A featured pairing on first visit, and a Surprise me that picks palettes suited to the style.
  - Compositions rotate at frame size.
  - Grids fit the frame exactly.
  - Palette names fit at phone width.
- Tooling: `scripts/serve.py`, a no-cache preview server, after a stale cached module hid a change during QA; and `scripts/bump.py` for cache busters.

**Next:** possible extras are seamless-tile export and SVG export for the vector styles.
