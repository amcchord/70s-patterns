// Seeded randomness, palettes, the render pipeline and the strip-based PNG exporter.
import { PATTERNS } from './patterns.js';

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

export const PALETTES = [
  { id: 'harvest', name: 'Harvest Gold', colors: ['#f4e4c1', '#4a2511', '#a0451a', '#e07b24', '#f2b33d'] },
  { id: 'tangerine', name: 'Tangerine Dream', colors: ['#fde3c0', '#6b1d0b', '#e8461e', '#f58a1f', '#ffb43b'] },
  { id: 'avocado', name: 'Avocado Kitchen', colors: ['#efe6c8', '#4b5320', '#8a9a3b', '#d4a72c', '#7a4a1e'] },
  { id: 'rustteal', name: 'Rust & Teal', colors: ['#f3e3c3', '#3b2414', '#c0561e', '#e89a2e', '#36a39c'] },
  { id: 'sunset', name: 'Sunset Strip', colors: ['#f3e2c6', '#b8321f', '#e8763f', '#f2b28a', '#2e7a8c', '#1d4e5f'] },
  { id: 'coffee', name: 'Coffee Shop', colors: ['#eadbc0', '#2d1a12', '#6e4329', '#b5763f', '#d9a35c'] },
  { id: 'modlime', name: 'Mod Lime', colors: ['#f5ecd6', '#233d2b', '#8db33a', '#e9b632', '#d4572a'] },
  { id: 'seafoam', name: 'Seafoam Motel', colors: ['#e9efe2', '#1f5f61', '#6fb3a6', '#e98a3c', '#f3c969'] },
  { id: 'denim', name: 'Denim & Rust', colors: ['#f1e9da', '#1b2a49', '#3d6a9e', '#c4572c', '#e8b04a'] },
  { id: 'disco', name: 'Disco Inferno', colors: ['#2a0f3b', '#ff2e93', '#ff8c1a', '#ffd21f', '#20c9e6', '#8a3ffc'] },
  { id: 'psych', name: 'Psychedelic', colors: ['#1b1033', '#6b2fb3', '#e83f6f', '#ff9f1c', '#2ec4b6', '#f9e07f'] },
  { id: 'bauhaus', name: 'Bauhaus Primary', colors: ['#f2ede1', '#e2312b', '#1f63b0', '#f6b419', '#151515'] },
  { id: 'bauhausmuted', name: 'Bauhaus Muted', colors: ['#fbf0b4', '#4f1013', '#9e2a24', '#2f5c69', '#e4a43f'] },
  { id: 'opart', name: 'Op Art', colors: ['#f7f5f0', '#141414'] },
];

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
  const ctx = canvas.getContext('2d');

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
