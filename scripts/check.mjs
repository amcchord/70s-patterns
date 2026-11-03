#!/usr/bin/env node
// Fast, dependency-free checks for the parts of the site that do not need a canvas:
// the palette rules, the palette inventor, vintage ageing and the style registry.
//
//     node scripts/check.mjs
//
// Rendering itself is checked by eye with site/sheet.html; see WORKBOOK.md.

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const core = await import(path.join(root, 'site/js/core.js'));
const { PALETTES, PATTERNS, inventPalette, ageColors, deltaE, mulberry32, paletteFromPixels, separateColors } = core;

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};
const HEX = /^#[0-9a-f]{6}$/;

// OKLab lightness, 0 (black) to 1 (white).
function lightness(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

console.log('Palettes');
const ids = new Set();
for (const p of PALETTES) {
  if (ids.has(p.id)) fail(`${p.id}: duplicate id`);
  ids.add(p.id);
  if (!p.colors.every((c) => HEX.test(c))) fail(`${p.id}: colours must be lower-case #rrggbb`);
  if (p.colors.length < 2 || p.colors.length > 8) fail(`${p.id}: needs 2 to 8 colours`);
  const [bg, ...inks] = p.colors;
  // Inks must stay apart from each other and from the ground. Morandi is tonal by design.
  const inkGap = p.id === 'morandi' ? 7 : 9;
  for (let i = 0; i < inks.length; i++) {
    if (deltaE(inks[i], bg) < 10) fail(`${p.id}: ${inks[i]} is too close to the ground ${bg}`);
    for (let j = i + 1; j < inks.length; j++) {
      const d = deltaE(inks[i], inks[j]);
      if (d < inkGap) fail(`${p.id}: ${inks[i]} and ${inks[j]} are only ${d.toFixed(1)} ΔE apart`);
    }
  }
  // A value structure: some spread between the darkest and lightest ink.
  if (inks.length >= 3) {
    const Ls = inks.map(lightness);
    if (Math.max(...Ls) - Math.min(...Ls) < 0.2) fail(`${p.id}: inks have almost no lightness range`);
  }
  // Grounds are paper or ink, never pure white or black.
  if (bg === '#ffffff' || bg === '#000000') fail(`${p.id}: ground should be paper or ink, not pure ${bg}`);
}
console.log(`  ${PALETTES.length} palettes checked`);

console.log('Invent palette');
for (let s = 0; s < 500; s++) {
  const pal = inventPalette(mulberry32(s));
  if (!pal.every((c) => HEX.test(c))) fail(`seed ${s}: invalid colour in ${pal.join(' ')}`);
  if (pal.length < 4) fail(`seed ${s}: only ${pal.length} colours`);
}
const again = inventPalette(mulberry32(42)).join();
if (again !== inventPalette(mulberry32(42)).join()) fail('inventPalette is not deterministic for a seeded source');
console.log('  500 seeded palettes checked');

console.log('Vintage');
const sample = PALETTES[0].colors;
if (ageColors(sample, 0) !== sample) fail('age 0 should return the palette unchanged');
for (const p of PALETTES) {
  for (const t of [0.35, 1]) {
    const aged = ageColors(p.colors, t);
    if (!aged.every((c) => HEX.test(c))) fail(`${p.id}: ageing to ${t} produced an invalid colour`);
  }
}
console.log('  every palette aged at 35% and 100%');

console.log('Separate colours');
{
  const close = ['#f4e4c1', '#4a2511', '#a0451a', '#e07b24', '#f2b33d', '#e3b440'];
  const out = separateColors(close);
  if (out[0] !== close[0]) fail('separateColors must never move the ground');
  let min = Infinity;
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) min = Math.min(min, deltaE(out[i], out[j]));
  if (min < 10) fail(`separateColors left two colours only ${min.toFixed(1)} ΔE apart`);
  if (separateColors(PALETTES[0].colors).join() !== PALETTES[0].colors.join()) fail('separateColors changed an already distinct palette');
}
console.log('  near-duplicate golds pulled apart');

console.log('Palette from image');
{
  // Cream ground with orange, teal and brown areas.
  const W = 64, H = 64;
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = x < 20 ? [224, 110, 40] : x < 34 ? [40, 130, 130] : y > 54 ? [70, 40, 25] : [240, 228, 200];
      px.set([...c, 255], (y * W + x) * 4);
    }
  }
  const pal = paletteFromPixels(px, mulberry32(1));
  if (!pal || pal.length < 3) fail(`expected a palette, got ${pal}`);
  else if (deltaE(pal[0], '#f0e4c8') > 8) fail(`ground should be the cream, got ${pal[0]}`);
}
console.log('  synthetic image checked');

console.log('Styles');
const families = new Set(['70s', 'geo', 'art']);
const sids = new Set();
for (const p of PATTERNS) {
  if (sids.has(p.id)) fail(`${p.id}: duplicate id`);
  sids.add(p.id);
  if (!families.has(p.family)) fail(`${p.id}: unknown family ${p.family}`);
  if (!p.about) fail(`${p.id}: missing ABOUT description`);
  if (!p.draw && !p.pixels) fail(`${p.id}: needs draw() or pixels()`);
}
console.log(`  ${PATTERNS.length} styles checked`);

if (failures) {
  console.log(`\n${failures} problem${failures === 1 ? '' : 's'} found`);
  process.exit(1);
}
console.log('\nAll checks passed');
