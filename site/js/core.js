// Seeded randomness, palettes, the render pipeline and the strip-based PNG exporter.
import { PATTERNS } from './patterns.js?v=3';

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
// The first colour is the background; the rest are inks.

export const PALETTE_GROUPS = [
  ['70s', 'Seventies'],
  ['art', 'Modern art'],
  ['pop', 'Pop & op'],
  ['soft', 'Soft'],
];

const P = (group, id, name, colors) => ({ group, id, name, colors });

export const PALETTES = [
  P('70s', 'harvest', 'Harvest Gold', ['#f4e4c1', '#4a2511', '#a0451a', '#e07b24', '#f2b33d']),
  P('70s', 'rainbow73', "Rainbow '73", ['#f5e9d0', '#5c2e14', '#b8321f', '#e3692b', '#f0a531', '#f6d04d', '#6f8f3a']),
  P('70s', 'tangerine', 'Tangerine Dream', ['#fde3c0', '#6b1d0b', '#e8461e', '#f58a1f', '#ffb43b']),
  P('70s', 'avocado', 'Avocado Kitchen', ['#efe6c8', '#4b5320', '#8a9a3b', '#d4a72c', '#7a4a1e']),
  P('70s', 'rustteal', 'Rust & Teal', ['#f3e3c3', '#3b2414', '#c0561e', '#e89a2e', '#36a39c']),
  P('70s', 'sunset', 'Sunset Strip', ['#f3e2c6', '#b8321f', '#e8763f', '#f2b28a', '#2e7a8c', '#1d4e5f']),
  P('70s', 'mustardplum', 'Mustard & Plum', ['#f3e4c4', '#3a1730', '#7b2d54', '#c45a3b', '#e0a526', '#efcf6e']),
  P('70s', 'polaroid', 'Polaroid', ['#f1e9d6', '#264d59', '#d65f3c', '#eea243', '#86b8b7']),
  P('70s', 'coffee', 'Coffee Shop', ['#eadbc0', '#2d1a12', '#6e4329', '#b5763f', '#d9a35c']),
  P('70s', 'shag', 'Shag Carpet', ['#ead9b5', '#4a2c15', '#8c5426', '#c88a36', '#6d7531']),
  P('70s', 'modlime', 'Mod Lime', ['#f5ecd6', '#233d2b', '#8db33a', '#e9b632', '#d4572a']),
  P('70s', 'lemonlime', 'Lemon & Lime', ['#fbf3d5', '#2f5d1f', '#7fb03b', '#d8d93c', '#f2b630']),
  P('70s', 'seafoam', 'Seafoam Motel', ['#e9efe2', '#1f5f61', '#6fb3a6', '#e98a3c', '#f3c969']),
  P('70s', 'peach', 'Peach Fuzz', ['#fde8d7', '#b84a32', '#ee8b60', '#f6b98a', '#3f6e66']),
  P('70s', 'denim', 'Denim & Rust', ['#f1e9da', '#1b2a49', '#3d6a9e', '#c4572c', '#e8b04a']),
  P('70s', 'cherrycola', 'Cherry Cola', ['#2b0f0c', '#7d1d1a', '#c43b2c', '#ee7d4b', '#f7c59a']),
  P('70s', 'avonight', 'Avocado Night', ['#1d2312', '#4f6b1f', '#9aa83a', '#e2b33c', '#e57a33', '#f1e2bf']),

  P('art', 'bauhaus', 'Bauhaus Primary', ['#f2ede1', '#e2312b', '#1f63b0', '#f6b419', '#151515']),
  P('art', 'bauhausmuted', 'Bauhaus Muted', ['#fbf0b4', '#4f1013', '#9e2a24', '#2f5c69', '#e4a43f']),
  P('art', 'kandinsky', 'Kandinsky', ['#efe6d2', '#161616', '#1f3d8c', '#c2362b', '#f0b928', '#6b3d8f', '#3c8c6e']),
  P('art', 'constructivist', 'Constructivist', ['#eadfc6', '#131313', '#c8102e', '#8d8579']),
  P('art', 'swiss', 'Swiss Poster', ['#f3f2ee', '#e2231a', '#1a1a1a', '#bcb8b1']),
  P('art', 'midcentury', 'Mid-Century', ['#f2e9d6', '#2b2b2b', '#d4572a', '#2f7a8a', '#e8b23a', '#7c9a3d']),
  P('art', 'cutouts', 'Paper Cut-Outs', ['#f5efe3', '#1f4fa0', '#e4572e', '#f3b61f', '#2c8c5a', '#141414']),
  P('art', 'ochre', 'Ochre & Slate', ['#e9dcc0', '#3d4f5c', '#7a3b2e', '#c9713d', '#e7b25d', '#6f8a8a']),
  P('art', 'memphis', 'Memphis', ['#fbf6ea', '#111111', '#ff5fa2', '#22c3b3', '#ffd23f', '#3d6cf4']),

  P('pop', 'disco', 'Disco Inferno', ['#2a0f3b', '#ff2e93', '#ff8c1a', '#ffd21f', '#20c9e6', '#8a3ffc']),
  P('pop', 'psych', 'Psychedelic', ['#1b1033', '#6b2fb3', '#e83f6f', '#ff9f1c', '#2ec4b6', '#f9e07f']),
  P('pop', 'lava', 'Lava Lamp', ['#1a0d24', '#7b1fa2', '#e3245e', '#ff7a1a', '#ffc93c']),
  P('pop', 'neon', 'Neon Night', ['#0e0b1f', '#ff2e88', '#00d1e0', '#8c52ff', '#f9f871']),
  P('pop', 'mint', 'Mod Mint', ['#e6f2ea', '#11423f', '#2c9c86', '#f29e4c', '#e8566b']),
  P('pop', 'pink', 'Pink Lounge', ['#fbe4e2', '#6d1a36', '#d43d6a', '#f58fa3', '#f6c453']),
  P('pop', 'opart', 'Op Art', ['#f7f5f0', '#141414']),
  P('pop', 'opred', 'Op Art Red', ['#f4f1ea', '#151515', '#c8202f']),
  P('pop', 'cyanotype', 'Cyanotype', ['#123d6a', '#f1eee4', '#5f8fbf', '#2b6496']),

  P('soft', 'sherbet', 'Sherbet', ['#fff3e4', '#ff8fa3', '#ffb84d', '#86c5da', '#b5d99c']),
  P('soft', 'pastelbauhaus', 'Pastel Bauhaus', ['#f6efe1', '#3f3f46', '#ef9a8f', '#94b6dc', '#f2cf7a']),
  P('soft', 'lavender', 'Lavender Haze', ['#f1ecf6', '#4b3a6e', '#9a84c4', '#e7a3b6', '#f3d38a']),
  P('soft', 'sage', 'Sage & Clay', ['#eef0e4', '#4f5d43', '#9aab7c', '#cf7f5f', '#efc98a']),
  P('soft', 'desert', 'Desert Modern', ['#f2e7d5', '#3e4a43', '#c8693f', '#e3a66f', '#93a27f']),
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

export function inventPalette(rand = Math.random) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const r = (a, b) => a + rand() * (b - a);
  const scheme = pick(['analogous', 'complement', 'triad', 'split', 'retro', 'earthy']);
  let h0 = rand() * 360;
  let hues;
  if (scheme === 'analogous') hues = [h0, h0 + 28, h0 + 56, h0 - 26];
  else if (scheme === 'complement') hues = [h0, h0 + 18, h0 + 180, h0 + 200];
  else if (scheme === 'triad') hues = [h0, h0 + 120, h0 + 240, h0 + 25];
  else if (scheme === 'split') hues = [h0, h0 + 150, h0 + 210, h0 + 30];
  else if (scheme === 'retro') {
    h0 = r(30, 85); // oranges, golds and browns with a cool accent
    hues = [h0, h0 + 20, h0 - 18, r(185, 215)];
  } else {
    h0 = r(40, 120);
    hues = [h0, h0 + 30, h0 - 25, h0 + 70];
  }
  const muted = scheme === 'earthy' ? 0.55 : 1;
  const dark = rand() < 0.2;
  const n = 3 + Math.floor(rand() * 3);
  const bg = dark ? oklchToHex(r(0.17, 0.24), r(0.02, 0.06), hues[2] + 180) : oklchToHex(r(0.93, 0.97), r(0.015, 0.04), pick([h0, 75, 85]));
  // Spread lightness so each palette has a dark anchor, mid tones and a light accent.
  const Ls = dark ? [0.86, 0.74, 0.64, 0.55, 0.47] : [0.3, 0.52, 0.64, 0.74, 0.83];
  const inks = [];
  for (let k = 0; k < n; k++) {
    const L = Ls[Math.round((k * (Ls.length - 1)) / Math.max(1, n - 1))] + r(-0.03, 0.03);
    const C = (L < 0.4 ? r(0.05, 0.1) : L > 0.78 ? r(0.05, 0.11) : r(0.1, 0.17)) * muted;
    inks.push(oklchToHex(L, C, (hues[k % hues.length] + r(-8, 8) + 360) % 360));
  }
  // Mix the order so the darkest ink is not always first.
  for (let k = inks.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [inks[k], inks[j]] = [inks[j], inks[k]];
  }
  return [bg, ...inks];
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
  const colors = spec.colors.length >= 2 ? spec.colors : ['#ffffff', '#000000'];
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
    if (o.angle) {
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
    await new Promise((r) => setTimeout(r, 0));
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
