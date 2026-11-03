# 70sPatterns — agent notes

Single-repository project. This folder is the primary (control) checkout of
the public repo `amcchord/70s-patterns`. Workspace-wide rules live in
`~/Development/AGENTS.md`; this file only adds project specifics.

- The deliverable is the static site in `site/`. Keep it dependency-free and
  build-free: plain ES modules, no bundler, no npm.
- Patterns must stay deterministic and resolution independent. Use `o.rng()`
  in a fixed order for global choices and `o.hash(i, j, k)` per cell. Never let
  randomness depend on output size, the strip being drawn, or culling.
- Run `node scripts/check.mjs` after touching palettes or the registry; it
  enforces the palette rules documented above `PALETTES` in `core.js`.
- Never stack several shapes under an anti-aliased clip edge that has to meet
  another clip (mirrors, tiles). Each layer blends at partial coverage and the
  colour beneath leaks through as a hairline. Fill same-coloured neighbours as
  one Path2D instead, keep shapes clear of the edge, or cover the edge with
  deliberate grout.
- Verify visually with `site/sheet.html` (contact sheet). Check 8K export with
  `exportPNG` from `site/js/core.js`. See `WORKBOOK.md` for commands.
- Production is a static directory on the shared mcchord.net web server.
  Deploy only with `scripts/deploy.sh`, only when the user asks, and never
  touch anything outside `/var/www/mcchord.net/patterns/`.
- This repository is public. Never commit credentials, host keys, server
  config, or personal data.
- Record material sessions in `docs/progress/JOURNAL.md`.
