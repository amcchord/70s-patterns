# Groovy Pattern Machine

![Groovy Pattern Machine](site/og.png)

Generate 1970s, Bauhaus and geometric patterns on demand, then download them as PNGs up to 8K (8192 × 8192).

**Live:** https://mcchord.net/patterns/

Everything runs in the browser. There is no server-side code, no build step and no dependencies. It is three ES modules and a stylesheet.

## Features

- **14 pattern styles**
  - *1970s:* Groovy Waves, Rainbow Scales, Petal Drops, Loop Chain, Ogee Onions, Diamond Nest, Liquid Groove, Flower Power, Supergraphic, Mod Targets
  - *Bauhaus & geometric:* Bauhaus Blocks, Kaleido Quilt, Chevron Op, Truchet Rings
- **14 curated palettes:** Harvest Gold, Avocado Kitchen, Disco Inferno, Bauhaus Primary and others. You can edit any colour, add or remove colours, or shuffle their order. The first colour is the background.
- **Scale, Detail and Rotate** sliders.
- **Seeded and shareable.** The URL hash holds the full state (style, colours, seed, sliders, size), so a link reproduces the exact pattern. *Copy link* puts it on the clipboard.
- **PNG export up to 8192 px per side:** 8K UHD, 8K portrait, 8K square, 5K, 4K, phone and tablet wallpapers, your own screen, or a custom size.
- Keyboard shortcuts: <kbd>Space</kbd> for a new pattern, <kbd>←</kbd> to go back, <kbd>S</kbd> for "surprise me".

## How it works

- **Resolution independent.** Each pattern draws in a logical space whose shorter side is 1000 units. The same spec therefore looks identical in the preview and in an 8K export.
- **Deterministic.** Global choices come from a seeded PRNG (`mulberry32`), drawn in a fixed order. Per-cell choices come from an integer hash of `(seed, i, j, k)`, so nothing depends on draw order or output size.
- **Big exports without big canvases.** `exportPNG` renders the image in horizontal strips of about 4 megapixels. It applies the PNG "Sub" filter, then streams the rows through the browser's native zlib (`CompressionStream('deflate')`). It then writes the IHDR/IDAT/IEND chunks itself. Memory stays small and per-canvas size limits never apply, so 8K works on phones too. An 8K UHD export takes about 0.3 to 2 seconds on a laptop.
- **Clean bands.** Most 70s styles stroke a single path several times, widest first, so the colour bands are truly parallel offset curves. Inset bands use the same trick inside a clip. Liquid Groove is computed per pixel from a domain-warped field, anti-aliased using the field's gradient.

## Run locally

```bash
python3 -m http.server 8771 --directory site
```

Then open http://localhost:8771/. Opening `index.html` straight from disk won't work, because browsers block ES modules on `file://` URLs.

`site/sheet.html` is a development contact sheet that renders many styles, seeds and palettes at once, for example `sheet.html?styles=waves,ogee&seeds=a,b,c&palette=harvest,disco&rot=20`. It is not deployed.

## Add a pattern

Add a `def(id, name, family, draw)` call in [`site/js/patterns.js`](site/js/patterns.js). `family` is `'70s'` or `'geo'`. `draw(ctx, o)` receives:

| field | meaning |
| --- | --- |
| `o.W`, `o.H` | logical size (shorter side = 1000, or a covering square when rotated) |
| `o.rng()`, `o.rand(a, b)`, `o.pick(arr)` | seeded randomness; call in a fixed order |
| `o.hash(i, j, k)` | order-independent per-cell randomness in `[0, 1)` |
| `o.colors`, `o.bg`, `o.ink` | palette (all), background, inks |
| `o.scale`, `o.detail` | slider values (0.4–2.5, 1–10) |
| `o.px` | one output pixel in logical units, for seam overlaps |

The background is already filled when `draw` runs. Draw past the edges freely; the canvas clips.

## Deploy

```bash
./scripts/deploy.sh
```

This rsyncs `site/` (minus `sheet.html`) to `/var/www/mcchord.net/patterns/` and checks each asset over HTTPS. Set `DEPLOY_HOST`, `DEPLOY_PATH` and `DEPLOY_URL` to publish elsewhere. The site uses relative paths, so it works under any directory, including GitHub Pages. When you change CSS or JS, bump the `?v=N` query strings in `index.html` and `app.js`.

## License

MIT. See [LICENSE](LICENSE).
