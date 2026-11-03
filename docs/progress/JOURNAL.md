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
