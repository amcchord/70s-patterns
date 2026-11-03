// Seeded randomness, palettes, the render pipeline and the strip-based PNG exporter.
import { PATTERNS } from './patterns.js?v=16';

export const MAX_SIDE = 8192;

// ---------------------------------------------------------------- randomness

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Order-independent per-cell randomness: the same (a, b, c) always gives the same value.
export function hash3(seed, a, b = 0, c = 0) {
  let h = seed ^ Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const SEED_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
export function randomSeed() {
  let s = '';
  for (let i = 0; i < 6; i++) s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
  return s;
}

// ---------------------------------------------------------------- palettes
// The first colour is the background; the rest are inks, in the order banded
// styles cycle through them. Rules every palette follows:
//  - Grounds are paper or ink: warm off-whites or deep inks, never pure white or black.
//  - A value structure: a dark anchor, mid tones and a light accent, so the
//    pattern still reads in greyscale.
//  - Pigment-true hues, drawn from the period or artist each palette names,
//    rather than screen primaries.
//  - Neighbours separate: at least ~10 OKLab ΔE between inks and ~12 to the ground.
// Seventies palettes run as gradients, the way 70s bands were printed; modern
// palettes alternate warm and cool so neighbouring shapes pop.

export const PALETTE_GROUPS = [
  ['70s', 'Seventies'],
  ['art', 'Modern art'],
  ['pop', 'Pop & op'],
  ['soft', 'Soft'],
];

const P = (group, id, name, colors) => ({ group, id, name, colors });

export const PALETTES = [
  // Seventies: appliance enamels, shag carpet, sunset posters and instant film.
  P('70s', 'harvest', 'Harvest Gold', ['#f4e4c1', '#4a2511', '#a0451a', '#e07b24', '#f2b33d']),
  P('70s', 'rainbow73', "Rainbow '73", ['#f4e8cf', '#4f2a14', '#b0361f', '#df6a2a', '#e99a2f', '#ecd36a', '#6e8a35']),
  P('70s', 'tangerine', 'Tangerine Dream', ['#f8e6c8', '#5e1a0e', '#cf4320', '#ec7d22', '#f5ad3a']),
  P('70s', 'avocado', "Kitchen '74", ['#efe4c9', '#3d4719', '#7b8933', '#d5a131', '#a6592a']),
  P('70s', 'rustteal', 'Rust & Teal', ['#f2e2c4', '#33231a', '#b8501e', '#e2952f', '#2e8a84']),
  P('70s', 'sunset', 'Sunset Strip', ['#f3e2c6', '#1d4e5f', '#2e7a8c', '#b8321f', '#e8763f', '#eea37a']),
  P('70s', 'mustardplum', 'Mustard & Plum', ['#f5ead5', '#341429', '#74294f', '#bb5437', '#dca02a']),
  P('70s', 'polaroid', 'Instant Film', ['#efe6d2', '#2c5b63', '#c8553d', '#e3a447', '#98c0bb']),
  P('70s', 'coffee', 'Coffee Shop', ['#eadbc0', '#2d1a12', '#6e4329', '#b5763f', '#d9a35c']),
  P('70s', 'babyblue', "Baby Blue '76", ['#f4e7d0', '#3b2416', '#7c4c2c', '#b98a5c', '#6f9cbf', '#adcbe0']),
  P('70s', 'modlime', 'Mod Lime', ['#f5ecd6', '#233d2b', '#8db33a', '#e9b632', '#d4572a']),
  P('70s', 'riviera', "Riviera '71", ['#f7ecdd', '#4a1d4c', '#bf2c6b', '#ec5b2d', '#f29b2c']),
  P('70s', 'seafoam', 'Seafoam Motel', ['#e9efe2', '#1f5f61', '#6fb3a6', '#e98a3c', '#f3c969']),
  P('70s', 'peach', 'Peach Melba', ['#fbebdc', '#3b5d57', '#b4472f', '#e9845c', '#f2b48a']),
  P('70s', 'denim', 'Denim & Rust', ['#f1e9da', '#1b2a49', '#3d6a9e', '#c4572c', '#e8b04a']),
  P('70s', 'cherrycola', 'Cherry Cola', ['#2b0f0c', '#7d1d1a', '#c43b2c', '#ee7d4b', '#f7c59a']),
  P('70s', 'avonight', 'Avocado Night', ['#1d2312', '#4f6b1f', '#9aa83a', '#e2b33c', '#e57a33', '#f1e2bf']),

  // Modern art: the pigments of the painters and schools the styles are named after.
  P('art', 'bauhaus', 'Bauhaus Primary', ['#efe8d8', '#d13b28', '#22509c', '#efb52e', '#1c1b19']),
  P('art', 'bauhausmuted', 'Bauhaus Muted', ['#fbf0b4', '#4f1013', '#9e2a24', '#2f5c69', '#e4a43f']),
  P('art', 'destijl', 'De Stijl', ['#ece8de', '#1b1a1a', '#c9322a', '#efc52f', '#1f3f91', '#bab5aa']),
  P('art', 'kandinsky', 'Kandinsky', ['#ece2cb', '#1a1918', '#25408f', '#c43a2c', '#eebc33', '#6a3f8c', '#2f7f66', '#9ebfd4']),
  P('art', 'cutouts', 'Paper Cut-Outs', ['#f3ede0', '#2448a0', '#e5603e', '#f3c42e', '#3d8b4e', '#c8437d', '#161616']),
  P('art', 'constructivist', 'Constructivist', ['#e8dcc0', '#151413', '#c42126', '#a8916d']),
  P('art', 'swiss', 'Swiss Poster', ['#f2f1ec', '#dd2a1b', '#1a1a1a', '#c4c0b8']),
  P('art', 'midcentury', 'Mid-Century', ['#f1e8d5', '#2c2b29', '#d2552c', '#2d7286', '#e1ad37', '#7d8f3c']),
  P('art', 'ochre', 'Ochre & Slate', ['#e8dbbf', '#3a4a57', '#7b3529', '#c46a3c', '#dcab55', '#6f8b88']),
  P('art', 'memphis', 'Memphis', ['#f7f3ea', '#141414', '#f29ea4', '#2c5fd9', '#7fd1cc', '#f7d046']),

  // Pop & op: disco and lava lamps, print-shop inks, and black-and-white optics.
  P('pop', 'disco', 'Disco Inferno', ['#24102f', '#f0388a', '#f57f20', '#f9cf2e', '#2fb8d6', '#7f48d8']),
  P('pop', 'psych', 'Psychedelic', ['#1d1233', '#5f2ca0', '#d93d6c', '#f39a24', '#3ab5a6', '#f2dc84']),
  P('pop', 'lava', 'Lava Lamp', ['#1a0d24', '#7b1fa2', '#e3245e', '#ff7a1a', '#ffc93c']),
  P('pop', 'zine', 'Zine Inks', ['#f2eee6', '#3d5588', '#ff48b0', '#ffb511', '#00838a', '#f15060']),
  P('pop', 'mint', 'Mod Mint', ['#e6f2ea', '#11423f', '#2c9c86', '#f29e4c', '#e8566b']),
  P('pop', 'pink', 'Pink Lounge', ['#fbe4e2', '#6d1a36', '#d43d6a', '#f58fa3', '#f6c453']),
  P('pop', 'opart', 'Op Art', ['#f7f5f0', '#141414']),
  P('pop', 'opred', 'Op Art Red', ['#f4f1ea', '#151515', '#c8202f']),
  P('pop', 'cyanotype', 'Cyanotype', ['#183f6b', '#f2eee3', '#6f97c4', '#091d35']),

  // Soft: chalky, dusty and pastel, but always with a dark anchor.
  P('soft', 'morandi', 'Morandi', ['#ebe5d8', '#55504a', '#7b8b91', '#b5a88d', '#ad7c66', '#d3c19b']),
  P('soft', 'sherbet', 'Sherbet', ['#fdf3e5', '#3d5a6c', '#e86f8a', '#f6a84c', '#7fbcd2', '#a9d08e']),
  P('soft', 'pastelbauhaus', 'Pastel Bauhaus', ['#f6efe1', '#3f3f46', '#ef9a8f', '#94b6dc', '#f2cf7a']),
  P('soft', 'lavender', 'Lavender Haze', ['#f3eef6', '#4b3a6e', '#9a84c4', '#e19aae', '#eac46e']),
  P('soft', 'sage', 'Sage & Clay', ['#f0f1e7', '#4a5840', '#93a675', '#cb7a59', '#e8bf7c']),
  P('soft', 'desert', 'Palm Springs', ['#f5ecdd', '#294a52', '#df8566', '#79c0bd', '#e8c178']),
  P('soft', 'terracotta', 'Terracotta', ['#f5e8dc', '#2f4858', '#8d3b2b', '#c9674a', '#e8a97f']),
];

// ---------------------------------------------------------------- invented palettes
// Harmonious random palettes, built in OKLCH so lightness steps look even
// across hues. rand() is any [0, 1) source.

function oklchToHex(L, C, hDeg) {
  // Reduce chroma until the colour fits in sRGB, so hues never clip to odd shades.
  for (let c = C; c >= 0; c -= 0.005) {
    const h = (hDeg * Math.PI) / 180;
    const a = c * Math.cos(h);
    const b = c * Math.sin(h);
    const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [
      4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
      -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
      -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ];
    if (lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4)) {
      return `#${lin
        .map((v) => {
          const x = Math.min(1, Math.max(0, v));
          const g = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
          return Math.round(g * 255).toString(16).padStart(2, '0');
        })
        .join('')}`;
    }
  }
  return '#808080';
}

function hexToOklab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function hexToOklch(hex) {
  const [L, a, b] = hexToOklab(hex);
  return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
}

// Perceptual distance, scaled so ~2 is just noticeable and 10+ reads as a clear step.
export function deltaE(x, y) {
  const A = hexToOklab(x);
  const B = hexToOklab(y);
  return 100 * Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

// Every ink must stand apart from every other ink and from the ground.
function separated(colors, inkGap = 10, groundGap = 13) {
  for (let i = 1; i < colors.length; i++) {
    if (deltaE(colors[i], colors[0]) < groundGap) return false;
    for (let j = i + 1; j < colors.length; j++) if (deltaE(colors[i], colors[j]) < inkGap) return false;
  }
  return true;
}

// Pigments drift as they lighten or darken: light tints lean toward yellow,
// deep shades toward red-brown. A touch of that keeps invented colours from
// looking like screen swatches.
function pigmentHue(h, L) {
  const target = L > 0.6 ? 92 : 28;
  const amount = Math.min(0.35, Math.abs(L - 0.6) * 0.6);
  const diff = ((target - h + 540) % 360) - 180;
  return (h + diff * amount + 360) % 360;
}

// Roughly how saturated artists' pigments get at each hue (OKLCH chroma):
// cadmiums and ochres run strong, greens and cyans much less so.
const PIGMENT_CAP = [[0, 0.16], [40, 0.17], [85, 0.16], [115, 0.13], [150, 0.1], [205, 0.095], [250, 0.13], [295, 0.13], [335, 0.15], [360, 0.16]];

function pigmentChroma(C, h, L) {
  let cap = 0.16;
  for (let k = 1; k < PIGMENT_CAP.length; k++) {
    const [h1, c1] = PIGMENT_CAP[k];
    const [h0, c0] = PIGMENT_CAP[k - 1];
    if (h <= h1) {
      cap = c0 + ((c1 - c0) * (h - h0)) / (h1 - h0);
      break;
    }
  }
  if (L > 0.82) cap *= 0.7;
  else if (L < 0.32) cap *= 0.75;
  return Math.min(C, cap);
}

function ink(L, C, h) {
  const hue = pigmentHue(h, L);
  return oklchToHex(L, pigmentChroma(C, hue, L), hue);
}

function paper(rand) {
  return oklchToHex(0.935 + rand() * 0.03, 0.018 + rand() * 0.02, 78 + rand() * 18);
}

// Take a curated palette and turn its hues, keeping its value structure.
function remixPalette(rand) {
  const pool = PALETTES.filter((p) => p.colors.length >= 4);
  const src = pool[Math.floor(rand() * pool.length)].colors;
  const turn = 30 + rand() * 300;
  const chroma = 0.85 + rand() * 0.25;
  const [L0, C0, h0] = hexToOklch(src[0]);
  // Light grounds stay paper-coloured; dark grounds turn with the inks.
  const ground = L0 > 0.6 ? paper(rand) : oklchToHex(L0, C0, (h0 + turn) % 360);
  const inks = src.slice(1).map((c) => {
    const [L, C, h] = hexToOklch(c);
    // Near-neutrals (blacks, greys) stay neutral rather than turning into odd tints.
    return C < 0.03 ? c : ink(L, C * chroma, (h + turn) % 360);
  });
  return [ground, ...inks];
}

// Build a palette from scratch on a hue scheme, with a deliberate value ladder.
function composePalette(rand) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const r = (a, b) => a + rand() * (b - a);
  const scheme = pick(['analogous', 'complement', 'split', 'retro', 'earthy', 'triad']);
  let h0 = rand() * 360;
  let hues;
  if (scheme === 'analogous') hues = [h0, h0 + 30, h0 + 60, h0 - 25];
  else if (scheme === 'complement') hues = [h0, h0 + 20, h0 + 180, h0 + 200];
  else if (scheme === 'split') hues = [h0, h0 + 150, h0 + 210, h0 + 25];
  else if (scheme === 'triad') hues = [h0, h0 + 120, h0 + 240, h0 + 20];
  else if (scheme === 'retro') {
    h0 = r(35, 80); // ochres, oranges and browns with one cool accent
    hues = [h0, h0 - 20, h0 + 22, r(190, 220)];
  } else {
    h0 = r(55, 115);
    hues = [h0, h0 - 30, h0 + 35, h0 + 80];
  }
  const muted = scheme === 'earthy' ? 0.6 : r(0.8, 1);
  const dark = rand() < 0.18;
  const n = 3 + Math.floor(rand() * 3);
  const ground = dark ? oklchToHex(r(0.18, 0.24), r(0.025, 0.06), (hues[2] + 180) % 360) : paper(rand);
  const ladder = dark ? [0.88, 0.76, 0.66, 0.56, 0.48] : [0.28, 0.5, 0.62, 0.72, 0.82];
  const inks = [];
  for (let k = 0; k < n; k++) {
    const L = ladder[Math.round((k * (ladder.length - 1)) / Math.max(1, n - 1))] + r(-0.025, 0.025);
    // Chroma peaks in the mid tones, as it does for real pigments.
    const C = (L < 0.4 ? r(0.04, 0.09) : L > 0.78 ? r(0.05, 0.1) : r(0.1, 0.16)) * muted;
    inks.push(ink(L, C, (hues[k % hues.length] + r(-8, 8) + 360) % 360));
  }
  // Half the time the dark anchor is a near-neutral: warm black or charcoal.
  if (!dark && rand() < 0.5) inks[0] = oklchToHex(r(0.22, 0.3), r(0.01, 0.035), r(30, 80));
  return [ground, ...inks];
}

export function inventPalette(rand = Math.random) {
  let pal;
  for (let attempt = 0; attempt < 16; attempt++) {
    pal = rand() < 0.5 ? remixPalette(rand) : composePalette(rand);
    if (separated(pal)) return pal;
  }
  return pal;
}

// ---------------------------------------------------------------- palettes from images
// k-means in OKLab over a small copy of the image, then the same palette rules as
// the curated set: a paper or ink ground, distinct inks, and a dark anchor.

function oklabToHex([L, a, b]) {
  return oklchToHex(L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360);
}

export function paletteFromPixels(rgba, rand = Math.random, maxInks = 5) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const pts = [];
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const r = lin(rgba[i] / 255), g = lin(rgba[i + 1] / 255), b = lin(rgba[i + 2] / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    pts.push([
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ]);
  }
  if (pts.length < 16) return null;
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  // k-means++ seeding, then a dozen Lloyd iterations.
  const K = Math.min(10, pts.length);
  const cents = [pts[Math.floor(rand() * pts.length)].slice()];
  const best = new Float64Array(pts.length).fill(Infinity);
  while (cents.length < K) {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      best[i] = Math.min(best[i], d2(pts[i], cents[cents.length - 1]));
      sum += best[i];
    }
    let t = rand() * sum;
    let pick = 0;
    for (; pick < pts.length - 1 && (t -= best[pick]) > 0; pick++);
    cents.push(pts[pick].slice());
  }
  const assign = new Int32Array(pts.length);
  const counts = new Array(K).fill(0);
  for (let it = 0; it < 12; it++) {
    const acc = cents.map(() => [0, 0, 0]);
    counts.fill(0);
    for (let i = 0; i < pts.length; i++) {
      let bi = 0, bd = Infinity;
      for (let k = 0; k < K; k++) {
        const d = d2(pts[i], cents[k]);
        if (d < bd) { bd = d; bi = k; }
      }
      assign[i] = bi;
      counts[bi]++;
      acc[bi][0] += pts[i][0];
      acc[bi][1] += pts[i][1];
      acc[bi][2] += pts[i][2];
    }
    for (let k = 0; k < K; k++) if (counts[k]) cents[k] = acc[k].map((v) => v / counts[k]);
  }
  const clusters = cents.map((c, k) => ({ lab: c, n: counts[k], L: c[0], C: Math.hypot(c[1], c[2]) })).filter((c) => c.n > 0);
  const far = (x, chosen, gap) => chosen.every((y) => 100 * Math.sqrt(d2(x.lab, y.lab)) >= gap);

  // Ground: the most common very light (or, for dark images, very dark) colour, calmed to paper or ink.
  const byCount = clusters.slice().sort((p, q) => q.n - p.n);
  const lightShare = clusters.filter((c) => c.L > 0.7).reduce((t, c) => t + c.n, 0) / pts.length;
  const darkGround = lightShare < 0.15 && rand() < 0.7;
  const groundSrc = darkGround ? clusters.reduce((p, q) => (q.L < p.L ? q : p)) : byCount.find((c) => c.L > 0.75) || clusters.reduce((p, q) => (q.L > p.L ? q : p));
  const gh = (Math.atan2(groundSrc.lab[2], groundSrc.lab[1]) * 180) / Math.PI;
  const groundHex = darkGround
    ? oklchToHex(Math.min(0.24, groundSrc.L), Math.min(0.06, groundSrc.C), (gh + 360) % 360)
    : oklchToHex(Math.max(0.93, groundSrc.L), Math.min(0.035, groundSrc.C), groundSrc.C < 0.01 ? 85 : (gh + 360) % 360);
  const ground = { lab: hexToOklab(groundHex) };

  // Inks: favour colours that are both common and colourful, and keep them apart.
  const ranked = clusters
    .filter((c) => c !== groundSrc)
    .sort((p, q) => q.n * (0.35 + q.C * 6) - p.n * (0.35 + p.C * 6));
  const inks = [];
  for (const c of ranked) {
    if (inks.length >= maxInks) break;
    if (far(c, [ground, ...inks], 11)) inks.push(c);
  }
  // A dark anchor for structure: the image's own darkest colour, deepened if need be,
  // or failing that a deep shade of the leading ink.
  if (!darkGround && !inks.some((c) => c.L < 0.4)) {
    const own = clusters
      .filter((c) => c !== groundSrc && c.L < 0.5)
      .sort((p, q) => p.L - q.L)[0];
    const src = own || inks[0] || groundSrc;
    const h = (Math.atan2(src.lab[2], src.lab[1]) * 180) / Math.PI;
    const L = own ? Math.min(own.L, 0.32) : 0.27;
    const anchor = { lab: hexToOklab(oklchToHex(L, Math.min(own ? 0.1 : 0.06, src.C), (h + 360) % 360)) };
    const rest = inks.filter((c) => far(c, [anchor], 11));
    inks.length = 0;
    inks.push(anchor, ...rest.slice(0, maxInks - 1));
  }
  if (!inks.length) return null;
  inks.sort((p, q) => p.lab[0] - q.lab[0]);
  return [groundHex, ...inks.map((c) => oklabToHex(c.lab))];
}

// ---------------------------------------------------------------- vintage
// Age a palette like a print left in the sun: inks lose chroma and drift warm,
// blacks lift toward brown, and the paper yellows. age runs from 0 to 1.

export function ageColors(colors, age) {
  if (!age) return colors;
  const t = Math.min(1, Math.max(0, age));
  return colors.map((hex, k) => {
    const [L, A, B] = hexToOklab(hex);
    if (k === 0 && L > 0.6) {
      // Paper: a little darker and yellower.
      return oklabToHex([L - 0.035 * t, A + (0.006 - A) * 0.8 * t, B + (0.045 - B) * 0.8 * t]);
    }
    // Inks: lose chroma, then pick up a thin yellow varnish. Working in Lab rather
    // than rotating hue keeps blues fading to slate instead of drifting to purple.
    const keep = 1 - 0.42 * t;
    const lift = L < 0.45 ? (0.45 - L) * 0.45 * t : 0;
    return oklabToHex([L + lift - (L > 0.8 ? 0.02 * t : 0), A * keep + 0.004 * t, B * keep + 0.024 * t]);
  });
}

export const PALETTES_BY_ID = Object.fromEntries(PALETTES.map((p) => [p.id, p]));
export const PATTERNS_BY_ID = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));
export { PATTERNS };

// ---------------------------------------------------------------- rendering
// Patterns draw in a logical space whose shorter side is 1000 units, so a given
// spec looks identical at 600px and at 8K. All randomness comes from the spec,
// never from the output size or the strip being drawn.

export function renderPattern(ctx, spec, pxW, pxH, viewX = 0, viewY = 0) {
  const gen = PATTERNS_BY_ID[spec.style] || PATTERNS[0];
  const unit = Math.min(pxW, pxH) / 1000;
  const W = pxW / unit;
  const H = pxH / unit;
  const seed = hashString(`${gen.id}:${spec.seed}`);
  const rng = mulberry32(seed);
  const colors = ageColors(spec.colors.length >= 2 ? spec.colors : ['#ffffff', '#000000'], (spec.age || 0) / 100);
  const o = {
    W, H, unit,
    px: 1 / unit,
    rng,
    rand: (a, b) => a + rng() * (b - a),
    pick: (arr) => arr[Math.floor(rng() * arr.length)],
    hash: (a, b, c) => hash3(seed, a, b, c),
    colors,
    bg: colors[0],
    ink: colors.slice(1),
    scale: spec.scale,
    detail: spec.detail,
    angle: ((spec.rotation || 0) * Math.PI) / 180,
    pixel: { pxW, pxH, x0: viewX, y0: viewY, w: ctx.canvas.width, h: ctx.canvas.height },
  };

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = o.bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (gen.pixels) {
    gen.pixels(ctx, o);
  } else {
    ctx.setTransform(unit, 0, 0, unit, -viewX, -viewY);
    ctx.lineJoin = 'round';
    if (o.angle && gen.fit) {
      // Compositions turn in place at frame size; the ground already fills the corners.
      ctx.translate(W / 2, H / 2);
      ctx.rotate(o.angle);
      ctx.translate(-W / 2, -H / 2);
    } else if (o.angle) {
      // Rotate about the centre and hand the pattern a square big enough to cover the frame.
      const D = Math.hypot(W, H);
      ctx.translate(W / 2, H / 2);
      ctx.rotate(o.angle);
      ctx.translate(-D / 2, -D / 2);
      o.W = o.H = D;
    }
    gen.draw(ctx, o);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- PNG export
// Renders the image in horizontal strips and streams them through the
// browser's native zlib (CompressionStream) into a PNG. This keeps memory
// small and sidesteps per-canvas size limits, so 8K works even on phones.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes, crc = 0xffffffff) {
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return crc;
}

function u32(n) {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

function pngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const crc = crc32(data, crc32(typeBytes)) ^ 0xffffffff;
  return [u32(data.length), typeBytes, data, u32(crc >>> 0)];
}

// Let the page breathe between strips. setTimeout is throttled to about once a second
// in background tabs, which would make an export crawl if you switch away; a
// MessageChannel round trip is not.
function yieldToPage() {
  if (globalThis.scheduler?.yield) return globalThis.scheduler.yield();
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(0);
  });
}

export function canStreamPNG() {
  return typeof CompressionStream === 'function';
}

export async function exportPNG(spec, pxW, pxH, onProgress = () => {}) {
  if (!canStreamPNG()) return exportViaCanvas(spec, pxW, pxH);

  const stripRows = Math.max(8, Math.min(pxH, Math.floor(4_000_000 / pxW)));
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = stripRows;
  // Software rasterisation: every strip is read back anyway, and GPU raster can leave
  // hairline cracks in dense strokes that differ from strip to strip.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const cs = new CompressionStream('deflate'); // zlib framing, which is what IDAT expects
  const writer = cs.writable.getWriter();
  const compressed = new Response(cs.readable).arrayBuffer();
  const rowBytes = pxW * 3 + 1;

  for (let y = 0; y < pxH; y += stripRows) {
    const h = Math.min(stripRows, pxH - y);
    renderPattern(ctx, spec, pxW, pxH, 0, y);
    const src = ctx.getImageData(0, 0, pxW, h).data;
    const out = new Uint8Array(rowBytes * h);
    for (let r = 0; r < h; r++) {
      let si = r * pxW * 4;
      let di = r * rowBytes;
      out[di++] = 1; // "Sub" filter: flat colour runs become zeros and compress well
      let pr = 0, pg = 0, pb = 0;
      for (let x = 0; x < pxW; x++, si += 4, di += 3) {
        const R = src[si], G = src[si + 1], B = src[si + 2];
        out[di] = (R - pr) & 255;
        out[di + 1] = (G - pg) & 255;
        out[di + 2] = (B - pb) & 255;
        pr = R; pg = G; pb = B;
      }
    }
    await writer.write(out);
    onProgress((y + h) / pxH);
    await yieldToPage();
  }
  await writer.close();
  const idat = new Uint8Array(await compressed);

  const ihdr = new Uint8Array(13);
  ihdr.set(u32(pxW), 0);
  ihdr.set(u32(pxH), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return new Blob(
    [signature, ...pngChunk('IHDR', ihdr), ...pngChunk('IDAT', idat), ...pngChunk('IEND', new Uint8Array(0))],
    { type: 'image/png' },
  );
}

function exportViaCanvas(spec, pxW, pxH) {
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  renderPattern(canvas.getContext('2d'), spec, pxW, pxH);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This browser could not encode an image this large.'))), 'image/png'),
  );
}
