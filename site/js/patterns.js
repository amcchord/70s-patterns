// Pattern generators.
//
// Each generator draws into a logical space whose shorter side is 1000 units
// (o.W × o.H). Global choices come from o.rng() in a fixed order; per-cell
// choices come from o.hash(i, j, k) so they never depend on draw order.
// Generators with `pixels` compute colour per pixel instead of drawing shapes.

const TAU = Math.PI * 2;
export const PATTERNS = [];

function def(id, name, family, draw, extra = {}) {
  PATTERNS.push({ id, name, family, draw, ...extra });
}

// ---------------------------------------------------------------- helpers

function cyc(arr, i) {
  const n = arr.length;
  return arr[((i % n) + n) % n];
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function darkest(colors) {
  return colors.reduce((a, b) => (luminance(b) < luminance(a) ? b : a));
}

function others(colors, ...exclude) {
  const rest = colors.filter((c) => !exclude.includes(c));
  return rest.length ? rest : colors;
}

// Inks, unless the palette is too small to make bands from inks alone.
function inks(o) {
  return o.ink.length >= 2 ? o.ink : o.colors;
}

// Colour weighting after the 60-30-10 rule of print design: the ground and one
// ink lead, a couple support, the rest are accents. The seed decides which ink
// leads (via the hash, so the rng sequence is untouched). pick(u, avoid) maps a
// uniform number to a colour and skips anything in avoid when it can.
function tones(o, ground = 0.3) {
  const order = o.colors
    .slice(1)
    .map((c, k) => [o.hash(7919, k), c])
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1]);
  const list = [o.bg, ...order];
  const w = [ground];
  let x = 1;
  for (let k = 0; k < order.length; k++, x *= 0.62) w.push(x);
  const inkSum = w.slice(1).reduce((a, b) => a + b, 0) || 1;
  for (let k = 1; k < w.length; k++) w[k] = (w[k] / inkSum) * (1 - ground);
  return {
    pick(u, avoid = []) {
      let total = 0;
      for (let k = 0; k < list.length; k++) if (!avoid.includes(list[k])) total += w[k];
      // Everything avoided (tiny palettes): at least differ from the first thing to avoid.
      if (total <= 0) return list.find((c) => c !== avoid[0]) || list[0];
      let t = u * total;
      let last = list[0];
      for (let k = 0; k < list.length; k++) {
        if (avoid.includes(list[k])) continue;
        last = list[k];
        t -= w[k];
        if (t <= 0) return last;
      }
      return last;
    },
  };
}

// Stroke one path several times, widest first, to get perfectly parallel bands.
// colors[0] runs down the centre line, the last colour forms the outer edge.
function nestStroke(ctx, path, colors, band) {
  for (let k = colors.length - 1; k >= 0; k--) {
    ctx.strokeStyle = colors[k];
    ctx.lineWidth = (2 * k + 1) * band;
    ctx.stroke(path);
  }
}

// Concentric bands inside a closed shape. colors[0] hugs the edge.
function insetBands(ctx, path, colors, band) {
  ctx.save();
  ctx.clip(path);
  for (let k = colors.length; k >= 1; k--) {
    ctx.strokeStyle = colors[k - 1];
    ctx.lineWidth = 2 * k * band;
    ctx.stroke(path);
  }
  ctx.restore();
}

// Draw with an extra rotation about the centre, on a square that still covers the frame.
function withTurn(ctx, o, angle, fn) {
  if (!angle) return fn(o.W, o.H);
  const D = Math.hypot(o.W, o.H);
  ctx.save();
  ctx.translate(o.W / 2, o.H / 2);
  ctx.rotate(angle);
  ctx.translate(-D / 2, -D / 2);
  fn(D, D);
  ctx.restore();
}

function disc(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// Rounded rectangle with a radius per corner: [tl, tr, br, bl].
function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r[0], y);
  ctx.arcTo(x + w, y, x + w, y + h, r[1]);
  ctx.arcTo(x + w, y + h, x, y + h, r[2]);
  ctx.arcTo(x, y + h, x, y, r[3]);
  ctx.arcTo(x, y, x + w, y, r[0]);
  ctx.closePath();
}

// ================================================================ 1970s

def('waves', 'Groovy Waves', '70s', (ctx, o) => {
  const { rng } = o;
  const vertical = rng() < 0.4;
  const n = 2 + Math.round(o.detail * 0.45);
  const T = 95 * o.scale * o.rand(0.85, 1.2);
  const pitch = T * o.rand(0.6, 1.0);
  const lambda = T * o.rand(2.4, 4.6);
  const amp = T * o.rand(0.3, 1.0);
  const mirror = rng() < 0.3;
  const rowShift = rng() < 0.5 ? 0 : 1;
  const outline = rng() < 0.45;
  const pal = outline ? inks(o) : rng() < 0.5 ? o.colors : inks(o);
  const start = Math.floor(rng() * pal.length);

  withTurn(ctx, o, vertical ? Math.PI / 2 : 0, (W, H) => {
    const per = 32;
    const steps = Math.ceil((W + 2 * lambda) / (lambda / per));
    const rows = Math.ceil((H + 2 * (amp + T)) / pitch) + 1;
    for (let r = 0; r < rows; r++) {
      const y0 = -amp - T + r * pitch;
      const ph = mirror && r & 1 ? Math.PI : 0;
      const p = new Path2D();
      for (let s = 0; s <= steps; s++) {
        const x = -lambda + (s * lambda) / per;
        const y = y0 + amp * Math.sin((TAU * x) / lambda + ph);
        if (s) p.lineTo(x, y);
        else p.moveTo(x, y);
      }
      const colors = [];
      for (let k = 0; k < n; k++) colors.push(cyc(pal, start + k + r * rowShift));
      if (outline) colors.push(o.bg);
      nestStroke(ctx, p, colors, T / (2 * colors.length - 1));
    }
  });
});

def('scallops', 'Rainbow Scales', '70s', (ctx, o) => {
  const { rng } = o;
  const R = 75 * o.scale;
  const n = 2 + Math.round(o.detail * 0.55);
  const arch = rng() < 0.5;
  const b = R / (n + (arch ? 0.5 : 0.35));
  const rowShift = rng() < 0.6 ? 0 : 1;
  const flip = rng() < 0.25;
  const pal = rng() < 0.5 ? inks(o) : o.colors;
  const start = Math.floor(rng() * pal.length);

  withTurn(ctx, o, flip ? Math.PI : 0, (W, H) => {
    const rows = Math.ceil(H / R) + 3;
    const cols = Math.ceil(W / (2 * R)) + 2;
    for (let r = 0; r < rows; r++) {
      const cy = (r - 1) * R;
      for (let c = -1; c <= cols; c++) {
        const cx = c * 2 * R + (r & 1 ? R : 0);
        for (let k = 0; k < n; k++) {
          const rad = R - k * b;
          ctx.fillStyle = cyc(pal, start + k + r * rowShift);
          ctx.beginPath();
          if (arch) {
            ctx.moveTo(cx - rad, cy + 2.2 * R);
            ctx.lineTo(cx - rad, cy);
            ctx.arc(cx, cy, rad, Math.PI, TAU);
            ctx.lineTo(cx + rad, cy + 2.2 * R);
          } else {
            ctx.arc(cx, cy, rad, 0, TAU);
          }
          ctx.fill();
        }
      }
    }
  });
});

def('drops', 'Petal Drops', '70s', (ctx, o) => {
  const { rng } = o;
  const c = 95 * o.scale;
  const mode = Math.floor(rng() * 3);
  const offset = rng() < 0.6;
  const nest = 1 + (o.detail >= 7) + (o.detail >= 10);
  const bgA = o.colors[0];
  const bgB = cyc(o.ink, Math.floor(rng() * o.ink.length));
  const start = Math.floor(rng() * 12);
  const cols = Math.ceil(o.W / c) + 1;
  const rows = Math.ceil(o.H / c) + 2;

  for (let i = 0; i < cols; i++) {
    const x = i * c;
    const colBg = i & 1 ? bgB : bgA;
    ctx.fillStyle = colBg;
    ctx.fillRect(x, -c, c + o.px, o.H + 2 * c);
    const pal = others(o.colors, colBg);
    for (let j = -1; j < rows; j++) {
      const y = j * c + (offset && i & 1 ? c / 2 : 0);
      let corner;
      if (mode === 0) corner = i & 1 ? 3 : 2; // drops lean toward each other
      else if (mode === 1) corner = (i + j) & 3; // pinwheel
      else corner = Math.floor(o.hash(i, j) * 4);
      for (let k = 0; k < nest; k++) {
        const inset = k * c * 0.17;
        const s = c - 2 * inset;
        const radii = [s / 2, s / 2, s / 2, s / 2];
        radii[corner] = 0;
        // Two alternating colours per column keeps it calm; nested drops step to the next colour.
        ctx.fillStyle = pal.length >= 2 ? cyc(pal, start + (j & 1) + 2 * (i & 1) + k) : k & 1 ? colBg : pal[0];
        ctx.beginPath();
        roundRect(ctx, x + inset, y + inset, s, s, radii);
        ctx.fill();
      }
    }
  }
});

def('loops', 'Loop Chain', '70s', (ctx, o) => {
  const { rng } = o;
  const r = 42 * o.scale;
  const n = 2 + Math.round(o.detail * 0.35);
  const T = r * o.rand(1.15, 1.45);
  const band = T / (2 * n - 1);
  const dotR = r - T / 2 - band * 0.7;
  const gap = r * o.rand(1.85, 2.4);
  const tilt = o.pick([0, 0, -0.42, 0.42, -0.785]);
  const drift = r * o.pick([0, 0.5, 1]);
  const pal = inks(o);
  const start = Math.floor(rng() * pal.length);
  const rowShift = rng() < 0.5 ? 1 : 0;
  const dotFromBg = rng() < 0.5;

  withTurn(ctx, o, tilt, (W, H) => {
    const rows = Math.ceil((H + 4 * r) / gap) + 1;
    const count = Math.ceil((W + 8 * r) / (2 * r)) + 1;
    for (let row = 0; row < rows; row++) {
      const y = -2 * r + row * gap;
      const x0 = -4 * r + ((row * drift) % (2 * r));
      const p = new Path2D();
      p.moveTo(x0 - r, y);
      for (let k = 0; k < count; k++) {
        const cx = x0 + 2 * r * k;
        if (k & 1) p.arc(cx, y, r, Math.PI, 0, true);
        else p.arc(cx, y, r, Math.PI, TAU);
      }
      const colors = [];
      for (let k = 0; k < n; k++) colors.push(cyc(pal, start + k + row * rowShift));
      nestStroke(ctx, p, colors, band);
      if (dotR > band * 0.5) {
        const dc = dotFromBg ? o.bg : cyc(pal, start + n + row * rowShift);
        for (let k = 0; k < count; k++) disc(ctx, x0 + 2 * r * k, y, dotR, dc);
      }
    }
  });
});

def('ogee', 'Ogee Onions', '70s', (ctx, o) => {
  const { rng } = o;
  const w = 105 * o.scale;
  const lambda = w * o.rand(1.9, 2.7);
  const a = w / 2; // adjacent curves touch, pinching the cells into onions
  const n = 1 + Math.round(o.detail * 0.4);
  const band = (w * 0.62) / (n + 0.6);
  const pal = o.colors;
  const startA = Math.floor(rng() * pal.length);
  const startB = startA + 1 + Math.floor(rng() * (pal.length - 1));
  const eye = rng() < 0.6;
  const latticeW = w * o.rand(0.04, 0.12);
  const lattice = darkest(pal);
  const curve = (i, y) => i * w + (i & 1 ? -a : a) * Math.sin((TAU * y) / lambda);
  const S = 40;
  const i1 = Math.ceil(o.W / w) + 2;
  const kMax = Math.ceil(o.H / lambda) + 2;

  for (let i = -2; i < i1; i++) {
    const even = (i & 1) === 0;
    const st = even ? startA : startB;
    for (let k = -2; k < kMax; k++) {
      const ys = lambda * (k + (even ? 0.25 : 0.75));
      const p = new Path2D();
      for (let s = 0; s <= S; s++) {
        const y = ys + (lambda * s) / S;
        if (s) p.lineTo(curve(i, y), y);
        else p.moveTo(curve(i, y), y);
      }
      for (let s = S; s >= 0; s--) {
        const y = ys + (lambda * s) / S;
        p.lineTo(curve(i + 1, y), y);
      }
      p.closePath();
      ctx.fillStyle = cyc(pal, st + n);
      ctx.fill(p);
      const bands = [];
      for (let b = 0; b < n; b++) bands.push(cyc(pal, st + b));
      insetBands(ctx, p, bands, band);
      if (eye) disc(ctx, i * w + w / 2, ys + lambda / 2, (w - n * band) * 0.42, cyc(pal, st + n + 1));
    }
  }
  ctx.strokeStyle = lattice;
  ctx.lineWidth = latticeW;
  for (let i = -2; i <= i1; i++) {
    const p = new Path2D();
    for (let s = 0; s <= S * (kMax + 3); s++) {
      const y = -2 * lambda + (lambda * s) / S;
      if (s) p.lineTo(curve(i, y), y);
      else p.moveTo(curve(i, y), y);
    }
    ctx.stroke(p);
  }
});

def('diamonds', 'Diamond Nest', '70s', (ctx, o) => {
  const { rng } = o;
  const R = 72 * o.scale;
  const sy = o.pick([1, 1, 1.3, 1.6]);
  const n = 2 + Math.round(o.detail * 0.55);
  const b = R / (n + 0.25);
  const pal = rng() < 0.5 ? o.colors : inks(o);
  const start = Math.floor(rng() * pal.length);
  const shiftB = 1 + Math.floor(rng() * (pal.length - 1));
  const outline = rng() < 0.35 ? darkest(o.colors) : null;
  const cols = Math.ceil(o.W / (2 * R)) + 2;
  const rows = Math.ceil(o.H / (2 * R * sy)) + 2;

  const diamond = (cx, cy, rr) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - rr * sy);
    ctx.lineTo(cx + rr, cy);
    ctx.lineTo(cx, cy + rr * sy);
    ctx.lineTo(cx - rr, cy);
    ctx.closePath();
  };
  for (let j = -1; j < rows; j++) {
    for (let i = -1; i < cols; i++) {
      for (const lat of [0, 1]) {
        const cx = i * 2 * R + lat * R;
        const cy = (j * 2 + lat) * R * sy;
        for (let k = 0; k < n; k++) {
          ctx.fillStyle = cyc(pal, start + k + lat * shiftB);
          diamond(cx, cy, R - k * b + (k === 0 ? o.px : 0));
          ctx.fill();
        }
      }
    }
  }
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = b * 0.35;
    for (let j = -1; j < rows; j++) {
      for (let i = -1; i < cols; i++) {
        diamond(i * 2 * R, j * 2 * R * sy, R);
        ctx.stroke();
      }
    }
  }
});

def('liquid', 'Liquid Groove', '70s', null, {
  // Contour bands of a domain-warped field, anti-aliased with the field gradient.
  pixels(ctx, o) {
    const { rng } = o;
    const pools = rng() < 0.5;
    const f = 0.0042 / o.scale;
    const ph = Array.from({ length: 8 }, () => rng() * TAU);
    const warp = o.rand(0.7, 1.6);
    const k1 = o.rand(0.7, 1.3);
    const k2 = o.rand(0.7, 1.3);
    const cycles = 0.9 + o.detail * 0.35;
    const ring = (26 * o.scale) / (0.6 + o.detail * 0.12);
    const centres = pools
      ? Array.from({ length: 3 + Math.floor(rng() * 4) }, () => [rng() * o.W * f, rng() * o.H * f])
      : [];
    let seq = o.colors.slice();
    const rot = Math.floor(rng() * seq.length);
    seq = seq.slice(rot).concat(seq.slice(0, rot));
    if (rng() < 0.5 && seq.length > 2) seq = seq.concat(seq.slice(1, -1).reverse());
    const rgb = seq.map(hexToRgb);
    const L = rgb.length;

    const { x0, y0, w, h } = o.pixel;
    const unit = o.unit;
    const cxL = o.W / 2;
    const cyL = o.H / 2;
    const ca = Math.cos(-o.angle);
    const sa = Math.sin(-o.angle);

    const field = (px, py) => {
      const lx = px / unit - cxL;
      const ly = py / unit - cyL;
      const X = (lx * ca - ly * sa + cxL) * f;
      const Y = (lx * sa + ly * ca + cyL) * f;
      const qx = Math.sin(Y * 1.7 + ph[0]) + 0.5 * Math.sin(X * 2.3 + Y * 0.9 + ph[1]);
      const qy = Math.sin(X * 1.3 + ph[2]) + 0.5 * Math.sin(Y * 2.1 - X * 0.7 + ph[3]);
      const X2 = X + warp * qx;
      const Y2 = Y + warp * qy;
      if (pools) {
        let d = Infinity;
        for (const [cx, cy] of centres) {
          const dx = X2 - cx;
          const dy = Y2 - cy;
          d = Math.min(d, dx * dx + dy * dy);
        }
        return Math.sqrt(d) / (ring * f);
      }
      return (Math.sin(X2 * k1 + ph[4]) + Math.sin(Y2 * k2 + ph[5]) + 0.6 * Math.sin((X2 - Y2) * 0.8 + ph[6])) * cycles;
    };

    // Sample one pixel beyond each edge so every pixel has neighbours for the gradient.
    const gw = w + 2;
    const gh = h + 2;
    const v = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      const py = y0 + j - 0.5;
      for (let i = 0; i < gw; i++) v[j * gw + i] = field(x0 + i - 0.5, py);
    }
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const c = (j + 1) * gw + i + 1;
        const t = v[c];
        const gx = (v[c + 1] - v[c - 1]) * 0.5;
        const gy = (v[c + gw] - v[c - gw]) * 0.5;
        const g = Math.sqrt(gx * gx + gy * gy) + 1e-6;
        const idx = Math.floor(t);
        const fr = t - idx;
        let nb, dist;
        if (fr < 0.5) {
          nb = idx - 1;
          dist = fr / g;
        } else {
          nb = idx + 1;
          dist = (1 - fr) / g;
        }
        const al = Math.min(1, 0.5 + dist);
        const A = rgb[((idx % L) + L) % L];
        const B = rgb[((nb % L) + L) % L];
        const di = (j * w + i) * 4;
        d[di] = B[0] + (A[0] - B[0]) * al;
        d[di + 1] = B[1] + (A[1] - B[1]) * al;
        d[di + 2] = B[2] + (A[2] - B[2]) * al;
        d[di + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  },
});

def('flowers', 'Flower Power', '70s', (ctx, o) => {
  const { rng } = o;
  const c = 150 * o.scale;
  const outline = rng() < 0.55 ? darkest(o.colors) : null;
  const olw = c * 0.018;
  const tone = tones(o, 0);
  const doubleP = 0.3 + o.detail * 0.06;
  const cols = Math.ceil(o.W / c) + 2;
  const rows = Math.ceil(o.H / c) + 2;
  const flowers = [];
  for (let j = -1; j < rows; j++) {
    for (let i = -1; i < cols; i++) {
      const h = (k) => o.hash(i, j, k);
      flowers.push({
        x: (i + 0.5 + (h(1) - 0.5) * 0.8) * c,
        y: (j + 0.5 + (h(2) - 0.5) * 0.8) * c,
        R: c * (0.38 + h(3) * 0.42),
        k: 5 + Math.floor(h(4) * 7),
        rot: h(5) * TAU,
        c1: h(6),
        c2: h(9),
        c3: h(10),
        c4: h(11),
        double: h(7) < doubleP,
        order: h(8),
      });
    }
  }
  flowers.sort((a, b) => a.order - b.order);

  const petals = (fl, rr, color, off) => {
    const dd = rr * 0.52;
    const rx = rr * 0.48;
    const ry = Math.min(rx * 0.95, ((Math.PI * dd) / fl.k) * 1.1);
    const p = new Path2D();
    for (let q = 0; q < fl.k; q++) {
      const an = fl.rot + off + (q * TAU) / fl.k;
      const ex = fl.x + Math.cos(an) * dd;
      const ey = fl.y + Math.sin(an) * dd;
      p.moveTo(ex + Math.cos(an) * rx, ey + Math.sin(an) * rx);
      p.ellipse(ex, ey, rx, ry, an, 0, TAU);
    }
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = olw * 2;
      ctx.stroke(p);
    }
    ctx.fillStyle = color;
    ctx.fill(p);
  };
  for (const fl of flowers) {
    // Petals follow the palette's weighting; each ring differs from the one beneath it.
    const p1 = tone.pick(fl.c1, [o.bg]);
    const p2 = tone.pick(fl.c2, [o.bg, p1]);
    const core = tone.pick(fl.c3, [fl.double ? p2 : p1, o.bg]);
    const dot = tone.pick(fl.c4, [core]);
    petals(fl, fl.R, p1, 0);
    if (fl.double) petals(fl, fl.R * 0.62, p2, Math.PI / fl.k);
    if (outline) disc(ctx, fl.x, fl.y, fl.R * 0.26 + olw, outline);
    disc(ctx, fl.x, fl.y, fl.R * 0.26, core);
    disc(ctx, fl.x, fl.y, fl.R * 0.12, dot);
  }
});

def('supergraphic', 'Supergraphic', '70s', (ctx, o) => {
  const { rng } = o;
  const g = 125 * o.scale;
  const n = 2 + Math.round(o.detail * 0.45);
  const T = g * 0.8;
  const pal = inks(o);
  const sameColours = rng() < 0.6;
  const start0 = Math.floor(rng() * pal.length);
  const cols = Math.ceil(o.W / g);
  const rows = Math.ceil(o.H / g);
  const K = Math.max(3, Math.round((cols + rows) * 0.4));
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  for (let s = 0; s < K; s++) {
    let i = Math.floor(rng() * (cols + 1));
    let j = Math.floor(rng() * (rows + 1));
    let d = Math.floor(rng() * 4);
    // Long lead-in and lead-out so the stripe ends stay off the canvas.
    const pts = [[i - dirs[d][0] * 60, j - dirs[d][1] * 60], [i, j]];
    const segs = 2 + Math.floor(rng() * 6);
    for (let q = 0; q < segs; q++) {
      d = (d + (rng() < 0.5 ? 1 : 3)) & 3;
      const len = 1 + Math.floor(rng() * 4);
      i += dirs[d][0] * len;
      j += dirs[d][1] * len;
      pts.push([i, j]);
    }
    d = (d + (rng() < 0.5 ? 1 : 3)) & 3;
    pts.push([i + dirs[d][0] * 60, j + dirs[d][1] * 60]);

    const p = new Path2D();
    p.moveTo(pts[0][0] * g, pts[0][1] * g);
    for (let q = 1; q < pts.length - 1; q++) {
      p.arcTo(pts[q][0] * g, pts[q][1] * g, pts[q + 1][0] * g, pts[q + 1][1] * g, g / 2);
    }
    p.lineTo(pts[pts.length - 1][0] * g, pts[pts.length - 1][1] * g);

    const start = sameColours ? start0 : start0 + s;
    const colors = [];
    for (let k = 0; k < n; k++) colors.push(cyc(pal, start + k));
    colors.push(o.bg);
    nestStroke(ctx, p, colors, T / (2 * colors.length - 1));
  }
});

def('targets', 'Mod Targets', '70s', (ctx, o) => {
  const { rng } = o;
  const s = 115 * o.scale;
  const hex = rng() < 0.6;
  const dy = hex ? s * 0.866 : s;
  const R = (s / 2) * o.rand(0.78, 1.0);
  const n = 2 + Math.round(o.detail * 0.5);
  const stems = !hex && rng() < 0.6;
  const pal = inks(o);
  const start = Math.floor(rng() * pal.length);
  const shiftMode = Math.floor(rng() * 3); // 0 none, 1 per row, 2 scattered
  const bgCentre = rng() < 0.5;
  const cols = Math.ceil(o.W / s) + 2;
  const rows = Math.ceil(o.H / dy) + 2;

  if (stems) {
    const p = new Path2D();
    for (let i = -1; i < cols; i++) {
      p.moveTo(i * s, -s);
      p.lineTo(i * s, o.H + s);
    }
    const sc = [cyc(pal, start + 1), cyc(pal, start + 2)];
    nestStroke(ctx, p, sc, (R * 0.9) / 3);
  }
  for (let r = -1; r < rows; r++) {
    for (let i = -1; i < cols; i++) {
      const cx = i * s + (hex && r & 1 ? s / 2 : 0);
      const cy = r * dy;
      const base = start + (shiftMode === 1 ? r : shiftMode === 2 ? Math.floor(o.hash(i, r) * pal.length) : 0);
      for (let k = 0; k < n; k++) {
        const last = k === n - 1;
        disc(ctx, cx, cy, R * (1 - k / n), last && bgCentre ? o.bg : cyc(pal, base + k));
      }
    }
  }
});

// ================================================================ Bauhaus & geometric

// Tile motifs drawn in the square [0, s]². A is the tile background, B and C are inks.
const MOTIFS = [
  function quarter(ctx, s, A, B) {
    ctx.fillStyle = B;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, s, 0, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
  },
  function quarterRings(ctx, s, A, B, C, n) {
    const m = 2 + Math.floor(n / 3);
    for (let k = 0; k < m; k++) {
      ctx.fillStyle = k & 1 ? C : B;
      ctx.beginPath();
      ctx.moveTo(0, s);
      ctx.arc(0, s, s * (1 - k / m), -Math.PI / 2, 0);
      ctx.closePath();
      ctx.fill();
    }
  },
  function dome(ctx, s, A, B, C) {
    ctx.fillStyle = B;
    ctx.beginPath();
    ctx.arc(s / 2, s, s / 2, Math.PI, TAU);
    ctx.fill();
    disc(ctx, s / 2, s * 0.28, s * 0.12, C);
  },
  function halves(ctx, s, A, B, C) {
    ctx.fillStyle = B;
    ctx.beginPath();
    ctx.arc(s / 2, 0, s / 2, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = C;
    ctx.beginPath();
    ctx.arc(s / 2, s, s / 2, Math.PI, TAU);
    ctx.fill();
  },
  function circle(ctx, s, A, B) {
    disc(ctx, s / 2, s / 2, s * 0.38, B);
  },
  function target(ctx, s, A, B, C, n) {
    const m = 2 + Math.floor(n / 4);
    for (let k = 0; k < m; k++) disc(ctx, s / 2, s / 2, s * 0.45 * (1 - k / m), [B, C, A][k % 3]);
  },
  function triangle(ctx, s, A, B) {
    ctx.fillStyle = B;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.closePath();
    ctx.fill();
  },
  function bowtie(ctx, s, A, B, C) {
    ctx.fillStyle = B;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s, 0);
    ctx.lineTo(s / 2, s / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C;
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.lineTo(s, s);
    ctx.lineTo(s / 2, s / 2);
    ctx.closePath();
    ctx.fill();
  },
  function stripes(ctx, s, A, B, C, n) {
    const m = 3 + Math.floor(n / 3);
    ctx.fillStyle = B;
    for (let q = 0; q < m; q++) ctx.fillRect(0, ((q + 0.25) * s) / m, s, s / (2 * m));
  },
  function diagonal(ctx, s, A, B, C, n) {
    const m = 3 + Math.floor(n / 3);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, s, s);
    ctx.clip();
    ctx.strokeStyle = B;
    ctx.lineWidth = (s * Math.SQRT2) / (2 * m);
    ctx.beginPath();
    for (let q = 0; q < m; q++) {
      const u = -s + ((q + 0.5) * 2 * s) / m;
      ctx.moveTo(u - s * 0.2, s * 1.2);
      ctx.lineTo(u + s * 1.2, -s * 0.2);
    }
    ctx.stroke();
    ctx.restore();
  },
  function leaf(ctx, s, A, B) {
    ctx.fillStyle = B;
    ctx.beginPath();
    ctx.arc(0, s, s, -Math.PI / 2, 0);
    ctx.arc(s, 0, s, Math.PI / 2, Math.PI);
    ctx.closePath();
    ctx.fill();
  },
  function split(ctx, s, A, B) {
    ctx.fillStyle = B;
    ctx.fillRect(0, 0, s / 2, s);
    ctx.fillStyle = A;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.34, Math.PI / 2, Math.PI * 1.5);
    ctx.fill();
    ctx.fillStyle = B;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.34, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
  },
  function checker(ctx, s, A, B) {
    ctx.fillStyle = B;
    ctx.fillRect(0, 0, s / 2, s / 2);
    ctx.fillRect(s / 2, s / 2, s / 2, s / 2);
  },
  function dots(ctx, s, A, B, C, n) {
    const m = n > 6 ? 3 : 2;
    for (let a = 0; a < m; a++) {
      for (let b = 0; b < m; b++) disc(ctx, ((a + 0.5) * s) / m, ((b + 0.5) * s) / m, (s / (2 * m)) * 0.62, (a + b) & 1 ? C : B);
    }
  },
  function plus(ctx, s, A, B) {
    ctx.fillStyle = B;
    ctx.fillRect(s / 3, s * 0.12, s / 3, s * 0.76);
    ctx.fillRect(s * 0.12, s / 3, s * 0.76, s / 3);
  },
  function steps(ctx, s, A, B, C, n) {
    const m = 3 + Math.floor(n / 4);
    ctx.fillStyle = B;
    ctx.beginPath();
    ctx.moveTo(0, s);
    for (let q = 0; q < m; q++) {
      ctx.lineTo((q * s) / m, s - ((q + 1) * s) / m);
      ctx.lineTo(((q + 1) * s) / m, s - ((q + 1) * s) / m);
    }
    ctx.lineTo(s, s);
    ctx.closePath();
    ctx.fill();
  },
  function pill(ctx, s, A, B, C) {
    ctx.fillStyle = B;
    ctx.beginPath();
    roundRect(ctx, s * 0.12, s * 0.3, s * 0.76, s * 0.4, [s * 0.2, s * 0.2, s * 0.2, s * 0.2]);
    ctx.fill();
    disc(ctx, s * 0.32, s / 2, s * 0.1, C);
  },
  function arch(ctx, s, A, B, C) {
    ctx.fillStyle = B;
    ctx.beginPath();
    ctx.moveTo(s * 0.15, s);
    ctx.lineTo(s * 0.15, s * 0.5);
    ctx.arc(s / 2, s * 0.5, s * 0.35, Math.PI, TAU);
    ctx.lineTo(s * 0.85, s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C;
    ctx.beginPath();
    ctx.moveTo(s * 0.33, s);
    ctx.lineTo(s * 0.33, s * 0.5);
    ctx.arc(s / 2, s * 0.5, s * 0.17, Math.PI, TAU);
    ctx.lineTo(s * 0.67, s);
    ctx.closePath();
    ctx.fill();
  },
  function quarterPair(ctx, s, A, B, C) {
    ctx.fillStyle = B;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, s / 2, 0, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C;
    ctx.beginPath();
    ctx.moveTo(s, s);
    ctx.arc(s, s, s / 2, Math.PI, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
  },
  function half(ctx, s, A, B, C) {
    ctx.fillStyle = B;
    ctx.fillRect(0, 0, s, s / 2);
    disc(ctx, s / 2, s / 2, s * 0.22, C);
  },
];

def('bauhaus', 'Bauhaus Blocks', 'geo', (ctx, o) => {
  // Whole tiles across the width; any crop is shared evenly top and bottom.
  const cols = Math.max(1, Math.round(o.W / (115 * o.scale)));
  const c = o.W / cols;
  const rows = Math.ceil(o.H / c);
  const oy = (o.H - rows * c) / 2;
  const bigP = o.rand(0.04, 0.2);
  const used = new Uint8Array(cols * rows);
  const tiles = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (used[j * cols + i]) continue;
      let size = 1;
      if (i + 1 < cols && j + 1 < rows && !used[j * cols + i + 1] && o.hash(i, j, 1) < bigP) size = 2;
      for (let dj = 0; dj < size; dj++) for (let di = 0; di < size; di++) used[(j + dj) * cols + i + di] = 1;
      tiles.push({ i, j, size });
    }
  }
  const tone = tones(o);
  for (const t of tiles) {
    const s = t.size * c;
    const h = (k) => o.hash(t.i, t.j, k + 10);
    const a = tone.pick(h(0));
    const b = tone.pick(h(1), [a]);
    const cc = tone.pick(h(2), [a, b]);
    const motif = MOTIFS[Math.floor(h(3) * MOTIFS.length)];
    ctx.save();
    ctx.translate(t.i * c, oy + t.j * c);
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, s + o.px, s + o.px);
    ctx.translate(s / 2, s / 2);
    ctx.rotate((Math.floor(h(4) * 4) * Math.PI) / 2);
    ctx.translate(-s / 2, -s / 2);
    motif(ctx, s, a, b, cc, o.detail);
    ctx.restore();
  }
});

// Add a square made of four triangles meeting in the middle (q = [top, right, bottom, left])
// to one Path2D per colour. Filling each colour's path once lets shared edges between
// same-coloured pieces merge exactly, so no anti-aliased hairlines appear between them.
function addQuadSquare(paths, x, y, s, q) {
  const path = (col) => paths.get(col) || paths.set(col, new Path2D()).get(col);
  const corners = [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
  let st = 0;
  while (st < 4 && q[st] === q[(st + 3) % 4]) st++;
  if (st === 4) {
    path(q[0]).rect(x, y, s, s);
    return;
  }
  for (let m = 0; m < 4; ) {
    const qi = (st + m) % 4;
    const col = q[qi];
    let len = 1;
    while (m + len < 4 && q[(qi + len) % 4] === col) len++;
    const p = path(col);
    p.moveTo(x + s / 2, y + s / 2);
    for (let k = 0; k <= len; k++) p.lineTo(...corners[(qi + k) % 4]);
    p.closePath();
    m += len;
  }
}

def('quilt', 'Kaleido Quilt', 'geo', (ctx, o) => {
  const { rng } = o;
  const k = 2 + Math.floor(rng() * 3);
  const c = 75 * o.scale;
  const quarterP = o.detail * 0.05;
  const block = [];
  const tone = tones(o);
  for (let b = 0; b < k * k; b++) {
    const P = tone.pick(rng());
    const Q = tone.pick(rng(), [P]);
    const t = rng();
    if (t < quarterP) block.push([P, tone.pick(rng()), Q, tone.pick(rng())]);
    else if (t < quarterP + 0.1) block.push([P, P, P, P]);
    else block.push(rng() < 0.5 ? [P, P, Q, Q] : [P, Q, Q, P]);
  }
  const period = 2 * k;
  const cols = Math.ceil(o.W / c) + 1;
  const rows = Math.ceil(o.H / c) + 1;
  const paths = new Map();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = i % period;
      const b = j % period;
      const q = block[(b >= k ? period - 1 - b : b) * k + (a >= k ? period - 1 - a : a)].slice();
      if (a >= k) [q[1], q[3]] = [q[3], q[1]];
      if (b >= k) [q[0], q[2]] = [q[2], q[0]];
      addQuadSquare(paths, i * c, j * c, c, q);
    }
  }
  for (const [col, p] of paths) {
    ctx.fillStyle = col;
    ctx.fill(p);
  }
});

def('chevron', 'Chevron Op', 'geo', (ctx, o) => {
  const { rng } = o;
  const big = rng() < 0.2;
  const P = big ? o.W * o.rand(0.7, 1.1) : 130 * o.scale * o.rand(0.7, 1.4);
  const A = P * (big ? o.rand(0.35, 0.5) : o.rand(0.22, 0.6));
  const base = (34 * o.scale) / (0.6 + o.detail * 0.18);
  const seqLen = 2 + Math.floor(rng() * 4);
  const widths = Array.from({ length: seqLen }, () => base * o.pick([1, 1, 1, 1.6, 2.4]));
  const op = o.colors.length <= 2 || rng() < 0.25;
  const pal = op ? [o.colors[0], darkest(o.colors)] : o.colors;
  const vertical = rng() < 0.35;

  withTurn(ctx, o, vertical ? Math.PI / 2 : 0, (W, H) => {
    const m0 = -2;
    const m1 = Math.ceil(W / (P / 2)) + 2;
    const xOff = big ? (W / 2) % P : 0; // centre a big chevron
    let y = -A - 6 * base;
    for (let k = 0; y < H + A; k++) {
      const w = widths[k % seqLen];
      const p = new Path2D();
      for (let m = m0; m <= m1; m++) {
        const yy = y + (m & 1 ? A : 0);
        if (m === m0) p.moveTo(xOff + (m * P) / 2, yy);
        else p.lineTo(xOff + (m * P) / 2, yy);
      }
      for (let m = m1; m >= m0; m--) p.lineTo(xOff + (m * P) / 2, y + w + o.px + (m & 1 ? A : 0));
      p.closePath();
      ctx.fillStyle = cyc(pal, k);
      ctx.fill(p);
      y += w;
    }
  });
});

def('truchet', 'Truchet Rings', 'geo', (ctx, o) => {
  const { rng } = o;
  const c = 100 * o.scale;
  const n = 1 + Math.round(o.detail * 0.4);
  const h = c * o.rand(0.14, 0.205);
  const band = (2 * h) / (2 * n - 1);
  const pal = inks(o);
  const start = Math.floor(rng() * pal.length);
  const dots = rng() < 0.7;
  const cols = Math.ceil(o.W / c) + 1;
  const rows = Math.ceil(o.H / c) + 1;
  const r = c / 2;
  const p = new Path2D();
  for (let j = -1; j < rows; j++) {
    for (let i = -1; i < cols; i++) {
      const x = i * c;
      const y = j * c;
      if (o.hash(i, j) < 0.5) {
        p.moveTo(x + r, y);
        p.arc(x, y, r, 0, Math.PI / 2);
        p.moveTo(x + c - r, y + c);
        p.arc(x + c, y + c, r, Math.PI, Math.PI * 1.5);
      } else {
        p.moveTo(x + c, y + r);
        p.arc(x + c, y, r, Math.PI / 2, Math.PI);
        p.moveTo(x, y + c - r);
        p.arc(x, y + c, r, Math.PI * 1.5, TAU);
      }
    }
  }
  const colors = [];
  for (let k = 0; k < n; k++) colors.push(cyc(pal, start + k));
  nestStroke(ctx, p, colors, band);
  if (dots) {
    const dr = r - h - band * 0.8;
    if (dr > 0) {
      const dc = cyc(pal, start + n);
      for (let j = -1; j <= rows; j++) for (let i = -1; i <= cols; i++) disc(ctx, i * c, j * c, dr, dc);
    }
  }
});

def('rainbowtiles', 'Rainbow Tiles', '70s', (ctx, o) => {
  const { rng } = o;
  const s = 120 * o.scale;
  const n = 2 + Math.round(o.detail * 0.45);
  const mode = Math.floor(rng() * 5); // 0 arches, 1 circles, 2 fans, 3 pinwheel, 4 random
  const pal = rng() < 0.6 ? inks(o) : o.colors;
  const start = Math.floor(rng() * pal.length);
  const hole = rng() < 0.5; // leave the centre open, like a rainbow
  const checker = rng() < 0.3 && o.ink.length >= 3;
  const tileBg = [o.bg, checker ? cyc(o.ink, start + n + 1) : o.bg];
  const cols = Math.ceil(o.W / s) + 1;
  const rows = Math.ceil(o.H / s) + 1;
  // Corners: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left.
  const corner = (i, j) => {
    if (mode === 0) return i & 1 ? 3 : 2;
    if (mode === 1) return [[2, 1], [3, 0]][i & 1][j & 1];
    if (mode === 2) return 3;
    if (mode === 3) return [2, 3, 0, 1][((i & 1) + 2 * (j & 1)) % 4];
    return Math.floor(o.hash(i, j) * 4);
  };
  const bands = n + (hole ? 1 : 0);
  // One path per (band, colour): equal bands in neighbouring tiles merge without hairlines.
  const layers = Array.from({ length: n }, () => new Map());
  const bgPaths = new Map();
  const add = (map, col) => map.get(col) || map.set(col, new Path2D()).get(col);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * s;
      const y = j * s;
      add(bgPaths, tileBg[(i + j) & 1]).rect(x, y, s, s);
      const q = corner(i, j);
      const cx = x + (q === 1 || q === 2 ? s : 0);
      const cy = y + (q >= 2 ? s : 0);
      const a0 = [0, 0.5, 1, 1.5][q] * Math.PI;
      for (let k = 0; k < n; k++) {
        const r = s * (1 - k / bands);
        const p = add(layers[k], cyc(pal, start + k));
        p.moveTo(cx, cy);
        p.arc(cx, cy, r, a0, a0 + Math.PI / 2);
        p.closePath();
      }
    }
  }
  const fillAll = (map) => {
    for (const [col, p] of map) {
      ctx.fillStyle = col;
      ctx.fill(p);
    }
  };
  if (checker) fillAll(bgPaths);
  for (const layer of layers) fillAll(layer);
  if (hole) {
    const p = new Path2D();
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const q = corner(i, j);
        const cx = i * s + (q === 1 || q === 2 ? s : 0);
        const cy = j * s + (q >= 2 ? s : 0);
        const a0 = [0, 0.5, 1, 1.5][q] * Math.PI;
        p.moveTo(cx, cy);
        p.arc(cx, cy, s / bands, a0, a0 + Math.PI / 2);
        p.closePath();
      }
    }
    ctx.fillStyle = o.bg;
    ctx.fill(p);
  }
});

// ================================================================ more geometric

def('cubes', 'Tumbling Blocks', 'geo', (ctx, o) => {
  const { rng } = o;
  const a = 62 * o.scale;
  const w = Math.sqrt(3) * a;
  const mode = Math.floor(rng() * 3); // 0 classic three tones, 1 coloured cubes, 2 coloured rows
  const byLum = o.colors.slice().sort((p, q) => luminance(q) - luminance(p));
  const L = byLum.length;
  const classic = [byLum[0], byLum[Math.floor((L - 1) / 2)], byLum[L - 1]];
  const hues = others(o.colors, o.bg);
  const shade = (c) => [mixHex(c, '#ffffff', 0.38), c, mixHex(c, '#000000', 0.4)];
  const inset = o.detail >= 7 ? 0.42 + (o.detail - 7) * 0.05 : 0; // Vasarely-style inner cubes
  const cols = Math.ceil(o.W / w) + 2;
  const rows = Math.ceil(o.H / (1.5 * a)) + 2;
  const paths = new Map();
  const add = (col) => paths.get(col) || paths.set(col, new Path2D()).get(col);
  const face = (col, pts) => {
    const p = add(col);
    p.moveTo(...pts[0]);
    for (let q = 1; q < pts.length; q++) p.lineTo(...pts[q]);
    p.closePath();
  };
  const cube = (cx, cy, r, tones) => {
    const T = [cx, cy - r], UR = [cx + (w / a) * r / 2, cy - r / 2], LR = [cx + (w / a) * r / 2, cy + r / 2];
    const B = [cx, cy + r], LL = [cx - (w / a) * r / 2, cy + r / 2], UL = [cx - (w / a) * r / 2, cy - r / 2];
    const C = [cx, cy];
    face(tones[0], [T, UR, C, UL]);
    face(tones[2], [C, UR, LR, B]);
    face(tones[1], [C, B, LL, UL]);
  };
  for (let j = -1; j < rows; j++) {
    for (let i = -1; i < cols; i++) {
      const cx = i * w + (j & 1 ? w / 2 : 0);
      const cy = j * 1.5 * a;
      let tones = classic;
      if (mode === 1) tones = shade(hues[Math.floor(o.hash(i, j) * hues.length)]);
      else if (mode === 2) tones = shade(cyc(hues, j));
      cube(cx, cy, a, tones);
      if (inset) {
        const inner = mode === 0 ? [tones[2], tones[0], tones[1]] : shade(cyc(hues, Math.floor(o.hash(i, j, 1) * hues.length)));
        cube(cx, cy, a * inset, inner);
      }
    }
  }
  // Inner cubes overlap the outer faces, so fill outer and inner passes in order.
  for (const [col, p] of paths) {
    ctx.fillStyle = col;
    ctx.fill(p);
  }
});

def('opsquares', 'Op Squares', 'geo', (ctx, o) => {
  const { rng } = o;
  const base = 62 * o.scale;
  const ink = contrastInk(o);
  const duo = o.colors.length > 2 && rng() < 0.3;
  const A = duo ? o.ink[0] : o.bg;
  const B = duo ? cyc(o.ink, 1 + Math.floor(rng() * (o.ink.length - 1))) : ink;
  const vertical = rng() < 0.3;
  const minF = o.rand(0.05, 0.16);
  const folds = rng() < 0.65 ? 1 : 2;
  const both = rng() < 0.25;
  const sharp = 1 + o.detail * 0.18;

  withTurn(ctx, o, vertical ? Math.PI / 2 : 0, (W, H) => {
    const foldsX = folds === 1 ? [W * o.rand(0.35, 0.65)] : [W * o.rand(0.2, 0.38), W * o.rand(0.62, 0.8)];
    const spreadX = W * o.rand(0.22, 0.38) / folds;
    const width = (d, spr) => base * (minF + (1 - minF) * (1 - Math.pow(1 - Math.min(1, d / spr), sharp)));
    // Walk outward from each fold to the edge of its region, so columns mirror exactly about it.
    // Regions between two folds meet at their midpoint.
    const edges = (len, fs, spr) => {
      const mids = fs.slice(1).map((f, q) => (fs[q] + f) / 2);
      const e = [...mids];
      fs.forEach((f, q) => {
        const lo = q === 0 ? -base : mids[q - 1];
        const hi = q === fs.length - 1 ? len + base : mids[q];
        e.push(f);
        for (const sgn of [-1, 1]) {
          const outer = sgn < 0 ? q === 0 : q === fs.length - 1;
          let x = f + sgn * width(0, spr);
          for (;;) {
            const inside = sgn < 0 ? x > lo : x < hi;
            if (!inside) {
              if (outer) e.push(x);
              break;
            }
            // Skip an edge that would leave a sliver against the midpoint.
            const toMid = sgn < 0 ? x - lo : hi - x;
            if (outer || toMid > base * 0.3) e.push(x);
            x += sgn * width(Math.abs(x - f), spr);
          }
        }
      });
      return e.sort((a, b) => a - b);
    };
    const xs = edges(W, foldsX, spreadX);
    const ys = both ? edges(H, [H * o.rand(0.35, 0.65)], H * o.rand(0.25, 0.4)) : Array.from({ length: Math.ceil(H / base) + 3 }, (_, k) => (k - 1) * base);
    ctx.fillStyle = A;
    ctx.fillRect(-base, -base, W + 2 * base, H + 2 * base);
    const p = new Path2D();
    for (let j = 0; j < ys.length - 1; j++) {
      for (let i = 0; i < xs.length - 1; i++) {
        if ((i + j) & 1) p.rect(xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j]);
      }
    }
    ctx.fillStyle = B;
    ctx.fill(p);
  });
});

// ================================================================ Art & abstract

function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// The ink that stands out most against the background: black lines on cream, cream lines on night.
function contrastInk(o) {
  const lb = luminance(o.bg);
  return o.ink.reduce((a, b) => (Math.abs(luminance(b) - lb) > Math.abs(luminance(a) - lb) ? b : a));
}

// Mitchell's best-candidate sampling: evenly spread but never regular. Always the same number of rng() calls.
function spread(o, n, margin, taken = []) {
  const pts = taken.slice();
  const out = [];
  for (let k = 0; k < n; k++) {
    let best = null;
    let bestD = -1;
    for (let c = 0; c < 10; c++) {
      const x = o.W * (margin + o.rng() * (1 - 2 * margin));
      const y = o.H * (margin + o.rng() * (1 - 2 * margin));
      let d = Infinity;
      for (const [px, py] of pts) d = Math.min(d, (px - x) ** 2 + (py - y) ** 2);
      if (d > bestD) {
        bestD = d;
        best = [x, y];
      }
    }
    pts.push(best);
    out.push(best);
  }
  return out;
}

function gauss(o) {
  return Math.sqrt(-2 * Math.log(1 - o.rng())) * Math.cos(TAU * o.rng());
}

// A slightly irregular circle, as if cut or painted by hand. wob is the relative wobble.
function wobbleCircle(p, cx, cy, r, wob, ph) {
  const N = 96;
  for (let q = 0; q <= N; q++) {
    const t = (q / N) * TAU;
    const rr = r * (1 + wob * (Math.sin(2 * t + ph[0]) * 0.6 + Math.sin(3 * t + ph[1]) * 0.3 + Math.sin(5 * t + ph[2]) * 0.1));
    if (q) p.lineTo(cx + rr * Math.cos(t), cy + rr * Math.sin(t));
    else p.moveTo(cx + rr * Math.cos(t), cy + rr * Math.sin(t));
  }
  p.closePath();
}

def('composition', 'Composition', 'art', (ctx, o) => {
  const { rng } = o;
  const S = Math.min(o.W, o.H);
  const k = o.scale;
  const line = contrastInk(o);
  const fills = others(o.colors, o.bg, line);
  const tint = luminance(o.bg) >= luminance(line) ? 'multiply' : 'screen';
  const amount = 0.45 + o.detail * 0.11;
  const count = (b) => Math.max(1, Math.round(b * amount));
  const col = () => o.pick(fills);
  const lw = (w) => w * (0.55 + 0.45 * k);
  // Two dominant directions give the linework structure instead of a tangle.
  const dirA = o.rand(0, Math.PI);
  const dirB = dirA + o.rand(0.9, 1.5) * (rng() < 0.5 ? 1 : -1);
  const dir = () => (rng() < 0.55 ? dirA : dirB) + o.rand(-0.12, 0.12);
  // A few hubs pull elements into clusters, leaving calm open space elsewhere.
  const hubs = spread(o, 3, 0.2);
  const free = spread(o, 40, 0.06, hubs);
  let fi = 0;
  const at = (tight = 0.16) => {
    if (rng() < 0.6) {
      const [hx, hy] = o.pick(hubs);
      return [hx + gauss(o) * S * tight, hy + gauss(o) * S * tight];
    }
    return free[fi++ % free.length];
  };
  const seg = (x, y, a, len, w, c) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x - (Math.cos(a) * len) / 2, y - (Math.sin(a) * len) / 2);
    ctx.lineTo(x + (Math.cos(a) * len) / 2, y + (Math.sin(a) * len) / 2);
    ctx.stroke();
  };
  const poly = (pts) => {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (let q = 1; q < pts.length; q++) ctx.lineTo(...pts[q]);
    ctx.closePath();
  };
  const glow = (x, y, r0, r1, c, alpha) => {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    g.addColorStop(0, rgba(c, alpha));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r1, 0, TAU);
    ctx.fill();
  };
  ctx.lineCap = 'butt';

  // Washes: broad, faint clouds of colour that fade out on every side, plus sometimes a crisp plane.
  ctx.globalCompositeOperation = tint;
  for (let q = 0; q < 2; q++) {
    const [x, y] = free[fi++];
    const a = dir();
    const len = S * o.rand(0.45, 0.8) * k;
    const th = S * o.rand(0.14, 0.3) * k;
    const c = mixHex(col(), o.bg, 0.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.scale(len / th, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, th);
    g.addColorStop(0, rgba(c, 0.34));
    g.addColorStop(0.6, rgba(c, 0.16));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-th, -th, 2 * th, 2 * th);
    ctx.restore();
  }
  if (rng() < 0.5) {
    const [x, y] = free[fi++];
    const a = dir();
    const r = S * o.rand(0.25, 0.45) * k;
    ctx.fillStyle = rgba(mixHex(col(), o.bg, 0.4), 0.22);
    poly([0, 1, 2, 3].map((q) => {
      const t = a + q * Math.PI / 2 + o.rand(-0.35, 0.35);
      return [x + Math.cos(t) * r * o.rand(0.6, 1.2), y + Math.sin(t) * r * o.rand(0.6, 1.2)];
    }));
    ctx.fill();
  }

  // Large triangles and half-discs, overprinted.
  for (let q = 0; q < count(2.5); q++) {
    const [x, y] = at(0.22);
    const sz = S * o.rand(0.07, 0.17) * k;
    const a = o.rand(0, TAU);
    const wd = o.rand(0.28, 0.6);
    const pts = [
      [x + Math.cos(a) * sz * 1.5, y + Math.sin(a) * sz * 1.5],
      [x + Math.cos(a + Math.PI / 2) * sz * wd - Math.cos(a) * sz * 0.5, y + Math.sin(a + Math.PI / 2) * sz * wd - Math.sin(a) * sz * 0.5],
      [x - Math.cos(a + Math.PI / 2) * sz * wd - Math.cos(a) * sz * 0.5, y - Math.sin(a + Math.PI / 2) * sz * wd - Math.sin(a) * sz * 0.5],
    ];
    ctx.globalCompositeOperation = tint;
    ctx.fillStyle = col();
    poly(pts);
    ctx.fill();
    if (rng() < 0.45) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = line;
      ctx.lineWidth = lw(2);
      ctx.stroke();
    }
  }
  for (let q = 0; q < count(1.2); q++) {
    const [x, y] = at();
    const r = S * o.rand(0.04, 0.09) * k;
    const a = o.rand(0, TAU);
    ctx.globalCompositeOperation = tint;
    ctx.fillStyle = col();
    ctx.beginPath();
    ctx.arc(x, y, r, a, a + Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    seg(x, y, a, r * 2.6, lw(2.4), line);
  }

  // The focal circle: a dark disc in a glowing halo, a ringed target, or a coloured sun.
  ctx.globalCompositeOperation = 'source-over';
  {
    const [x, y] = hubs[0];
    const R = S * o.rand(0.09, 0.13) * k;
    const kind = rng();
    const c1 = col();
    const c2 = o.pick(others(fills, c1));
    const a = o.rand(0, TAU);
    if (kind < 0.5) {
      glow(x, y, R * 0.9, R * 1.75, c1, 0.9);
      disc(ctx, x, y, R * 1.08, c1);
      disc(ctx, x, y, R, line);
      disc(ctx, x + Math.cos(a) * R * 0.2, y + Math.sin(a) * R * 0.2, R * o.rand(0.32, 0.5), c2);
    } else if (kind < 0.75) {
      const m = 3 + Math.floor(rng() * 3);
      for (let q = 0; q < m; q++) {
        const rr = R * 1.15 * (1 - q / m);
        disc(ctx, x + Math.cos(a) * (R - rr) * 0.25, y + Math.sin(a) * (R - rr) * 0.25, rr, q & 1 ? c2 : q === 0 ? line : c1);
      }
    } else {
      glow(x, y, R * 0.6, R * 1.6, c2, 0.7);
      disc(ctx, x, y, R, c1);
      ctx.strokeStyle = line;
      ctx.lineWidth = lw(3);
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.stroke();
      disc(ctx, x + Math.cos(a) * R * 0.45, y + Math.sin(a) * R * 0.45, R * 0.3, line);
    }
  }

  // Lines: singles and fanned bundles along the two main directions.
  for (let q = 0; q < count(8); q++) {
    const [x, y] = at(0.2);
    const a = dir();
    const len = S * o.rand(0.25, 0.85);
    const w = lw(o.pick([1.2, 1.6, 2.2, 2.2, 3.5, 6, 9]));
    if (rng() < 0.22) {
      const m = 3 + Math.floor(rng() * 3);
      const spreadA = o.rand(0.04, 0.12);
      for (let b = 0; b < m; b++) {
        const ab = a + (b - (m - 1) / 2) * spreadA / m;
        const ox = x - Math.cos(a) * len * 0.5;
        const oy = y - Math.sin(a) * len * 0.5;
        seg(ox + (Math.cos(ab) * len) / 2, oy + (Math.sin(ab) * len) / 2, ab, len, lw(1.2), line);
      }
    } else {
      seg(x, y, a, len, w, line);
    }
  }
  for (let q = 0; q < count(3); q++) {
    const [x, y] = at(0.25);
    const r = S * o.rand(0.12, 0.4);
    const a = o.rand(0, TAU);
    ctx.strokeStyle = line;
    ctx.lineWidth = lw(o.pick([1.4, 2, 3]));
    ctx.beginPath();
    ctx.arc(x, y, r, a, a + o.rand(0.5, 1.5));
    ctx.stroke();
  }

  // Circles of every kind.
  const nC = count(9);
  for (let q = 0; q < nC; q++) {
    const [x, y] = at(0.18);
    const r = S * k * (0.01 + 0.05 * rng() ** 1.6);
    const t = rng();
    const c1 = col();
    const c2 = o.pick(others(fills, c1));
    ctx.globalCompositeOperation = 'source-over';
    if (t < 0.22) {
      glow(x, y, r * 0.9, r * 1.6, c2, 0.85);
      disc(ctx, x, y, r, c1);
    } else if (t < 0.42) {
      disc(ctx, x, y, r, c1);
      ctx.strokeStyle = line;
      ctx.lineWidth = lw(1.6);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
    } else if (t < 0.58) {
      ctx.strokeStyle = line;
      ctx.lineWidth = Math.max(lw(1.4), r * 0.12);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
    } else if (t < 0.78) {
      disc(ctx, x, y, r, c1);
      disc(ctx, x, y, r * 0.62, c2);
      disc(ctx, x, y, r * 0.28, line);
    } else {
      disc(ctx, x, y, r, line);
      disc(ctx, x + r * 0.18, y - r * 0.12, r * 0.55, c1);
    }
  }

  // Small structures: checkerboards, ladders, squiggles, bars, rays and dots.
  ctx.globalCompositeOperation = 'source-over';
  for (let q = 0; q < count(1.3); q++) {
    const [x, y] = at();
    const m = 2 + Math.floor(rng() * 4);
    const nn = 2 + Math.floor(rng() * 3);
    const cs = S * o.rand(0.016, 0.028) * k;
    const c = col();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rand(-0.5, 0.5));
    for (let a = 0; a < m; a++) {
      for (let b = 0; b < nn; b++) {
        ctx.fillStyle = (a + b) & 1 ? c : line;
        ctx.fillRect((a - m / 2) * cs, (b - nn / 2) * cs, cs + 0.02, cs + 0.02);
      }
    }
    ctx.restore();
  }
  for (let q = 0; q < count(1.2); q++) {
    const [x, y] = at();
    const a = dir();
    const len = S * o.rand(0.12, 0.3);
    seg(x, y, a, len, lw(1.6), line);
    const m = 4 + Math.floor(rng() * 6);
    const tl = S * o.rand(0.012, 0.03);
    for (let b = 0; b < m; b++) {
      const t = (b / (m - 1) - 0.5) * len * 0.8;
      seg(x + Math.cos(a) * t, y + Math.sin(a) * t, a + Math.PI / 2, tl, lw(1.4), line);
    }
  }
  for (let q = 0; q < count(1); q++) {
    const [x, y] = at();
    const a = dir();
    const len = S * o.rand(0.15, 0.3);
    const amp = S * o.rand(0.008, 0.02);
    const waves = 3 + Math.floor(rng() * 4);
    ctx.strokeStyle = line;
    ctx.lineWidth = lw(1.8);
    ctx.beginPath();
    for (let s = 0; s <= 80; s++) {
      const t = (s / 80 - 0.5) * len;
      const off = amp * Math.sin((s / 80) * TAU * waves);
      const px = x + Math.cos(a) * t - Math.sin(a) * off;
      const py = y + Math.sin(a) * t + Math.cos(a) * off;
      if (s) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  for (let q = 0; q < count(2.5); q++) {
    const [x, y] = at();
    const a = dir();
    const bl = S * o.rand(0.03, 0.08) * k;
    const bw = bl * o.rand(0.12, 0.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = rng() < 0.3 ? line : col();
    ctx.fillRect(-bl / 2, -bw / 2, bl, bw);
    ctx.restore();
  }
  if (rng() < 0.4 + o.detail * 0.05) {
    const [x, y] = at();
    const a = o.rand(0, TAU);
    const m = 5 + Math.floor(rng() * 6);
    const len = S * o.rand(0.08, 0.18);
    for (let b = 0; b < m; b++) {
      const ab = a + (b / (m - 1) - 0.5) * 0.9;
      seg(x + (Math.cos(ab) * len) / 2, y + (Math.sin(ab) * len) / 2, ab, len, lw(1.2), line);
    }
  }
  for (let q = 0; q < count(1.5); q++) {
    const [x, y] = at();
    const a = dir();
    const m = 3 + Math.floor(rng() * 5);
    const gap = S * o.rand(0.012, 0.022);
    const r = gap * o.rand(0.22, 0.34);
    for (let b = 0; b < m; b++) disc(ctx, x + Math.cos(a) * gap * b, y + Math.sin(a) * gap * b, r, line);
  }
}, { thumb: { scale: 1.1 }, fit: true });

def('circles', 'Floating Circles', 'art', (ctx, o) => {
  const { rng } = o;
  const S = Math.min(o.W, o.H);
  const k = o.scale;
  // These circles want a night sky. A light background becomes a circle colour instead.
  const lightBg = luminance(o.bg) > 110;
  const deep = darkest(o.colors);
  const ground = lightBg ? mixHex(deep, '#07070d', 0.72) : o.bg;
  const pal = lightBg ? others(o.colors, deep) : others(o.colors, o.bg);
  const lightest = o.colors.reduce((a, b) => (luminance(b) > luminance(a) ? b : a));
  // A soft cloud of light behind the cluster.
  const [gx, gy] = [o.W * o.rand(0.35, 0.65), o.H * o.rand(0.35, 0.65)];
  const cloud = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.hypot(o.W, o.H) * 0.6);
  cloud.addColorStop(0, mixHex(ground, lightest, 0.13));
  cloud.addColorStop(1, ground);
  ctx.fillStyle = cloud;
  ctx.fillRect(-o.W, -o.H, 3 * o.W, 3 * o.H);

  const hubs = spread(o, 2 + Math.floor(rng() * 2), 0.22);
  const N = Math.round((10 + o.detail * 4.5) / Math.sqrt(k));
  const items = [];
  // The big one: a dark disc with a coloured corona.
  items.push({ x: hubs[0][0], y: hubs[0][1], r: S * o.rand(0.14, 0.2) * k, big: true });
  for (let q = 0; q < N; q++) {
    let x, y;
    if (rng() < 0.65) {
      const [hx, hy] = o.pick(hubs);
      x = hx + gauss(o) * S * 0.2;
      y = hy + gauss(o) * S * 0.2;
    } else {
      x = o.rand(-0.05, 1.05) * o.W;
      y = o.rand(-0.05, 1.05) * o.H;
    }
    items.push({ x, y, r: S * k * (0.008 + 0.08 * rng() ** 2.4) });
  }
  items.sort((a, b) => b.r - a.r);
  ctx.globalCompositeOperation = 'screen';
  for (const it of items) {
    const c1 = o.pick(pal);
    const c2 = o.pick(others(pal, c1));
    const t = rng();
    const { x, y, r } = it;
    if (it.big) {
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(x, y, r * 0.95, x, y, r * 1.5);
      g.addColorStop(0, rgba(c2, 0.95));
      g.addColorStop(1, rgba(c2, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.5, 0, TAU);
      ctx.fill();
      disc(ctx, x, y, r, mixHex(ground, '#000000', 0.55));
      disc(ctx, x + r * 0.25, y - r * 0.2, r * 0.32, c1);
      ctx.globalCompositeOperation = 'screen';
      continue;
    }
    ctx.globalAlpha = o.rand(0.75, 0.95);
    if (t < 0.4) {
      const g = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.45);
      g.addColorStop(0, rgba(c2, 0.9));
      g.addColorStop(1, rgba(c2, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.45, 0, TAU);
      ctx.fill();
      disc(ctx, x, y, r, c1);
    } else if (t < 0.65) {
      disc(ctx, x, y, r, c1);
      ctx.strokeStyle = c2;
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.06, 0, TAU);
      ctx.stroke();
    } else if (t < 0.82) {
      disc(ctx, x, y, r, c1);
      disc(ctx, x, y, r * 0.55, c2);
    } else {
      disc(ctx, x, y, r, c1);
    }
    ctx.globalAlpha = 1;
  }
}, { thumb: { scale: 1.2 }, fit: true });

def('colorstudy', 'Color Study', 'art', (ctx, o) => {
  const { rng } = o;
  const c0 = 165 * o.scale;
  const rings = 2 + Math.round(o.detail * 0.3);
  const wob = rng() < 0.75 ? o.rand(0.012, 0.028) : 0;
  // Whole cells only: the grid fits the frame exactly, like a painted study.
  const cols = Math.max(1, Math.round(o.W / c0));
  const rows = Math.max(1, Math.round(o.H / c0));
  const cw = o.W / cols;
  const ch = o.H / rows;
  const c = Math.min(cw, ch);
  const cells = new Map();
  const add = (col) => cells.get(col) || cells.set(col, new Path2D()).get(col);
  const tone = tones(o, 0.22);
  const bgOf = (i, j) => tone.pick(o.hash(i, j, 0));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) add(bgOf(i, j)).rect(i * cw, j * ch, cw + o.px, ch + o.px);
  for (const [col, p] of cells) {
    ctx.fillStyle = col;
    ctx.fill(p);
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const h = (q) => o.hash(i, j, q);
      let prev = bgOf(i, j);
      let cx = (i + 0.5) * cw + (h(1) - 0.5) * c * 0.08;
      let cy = (j + 0.5) * ch + (h(2) - 0.5) * c * 0.08;
      let r = c * (0.36 + h(3) * 0.07);
      for (let q = 0; q < rings; q++) {
        const colr = tone.pick(h(10 + q), [prev]);
        const p = new Path2D();
        wobbleCircle(p, cx, cy, r, wob, [h(20 + q) * TAU, h(30 + q) * TAU, h(40 + q) * TAU]);
        ctx.fillStyle = colr;
        ctx.fill(p);
        prev = colr;
        const step = r / (rings - q + 0.6);
        r -= step * (0.75 + h(50 + q) * 0.5);
        cx += (h(60 + q) - 0.5) * step * 0.5;
        cy += (h(70 + q) - 0.5) * step * 0.5;
      }
    }
  }
}, { thumb: { scale: 1.6 } });

def('destijl', 'De Stijl Grid', 'art', (ctx, o) => {
  const { rng } = o;
  const k = o.scale;
  const lw = 16 * k;
  const minC = 64 * k;
  const line = contrastInk(o);
  const fills = others(o.ink, line);
  const boogie = rng() < 0.3 && fills.length >= 2;
  const fillP = 0.16 + o.detail * 0.025;
  const splitBias = 0.62 + o.detail * 0.04;
  const lines = [];
  const leaves = [];
  const split = (x, y, w, h, depth) => {
    const canV = w > 2 * minC;
    const canH = h > 2 * minC;
    const p = depth < 3 ? 1 : splitBias - (depth - 3) * 0.14;
    if ((!canV && !canH) || rng() >= p) {
      leaves.push([x, y, w, h]);
      return;
    }
    const vertical = canV && (!canH || rng() < w / (w + h) + 0.08);
    if (vertical) {
      const t = x + minC + rng() * (w - 2 * minC);
      lines.push([t - lw / 2, y, lw, h]);
      split(x, y, t - x, h, depth + 1);
      split(t, y, x + w - t, h, depth + 1);
    } else {
      const t = y + minC + rng() * (h - 2 * minC);
      lines.push([x, t - lw / 2, w, lw]);
      split(x, y, w, t - y, depth + 1);
      split(x, t, w, y + h - t, depth + 1);
    }
  };
  split(-lw, -lw, o.W + 2 * lw, o.H + 2 * lw, 0);
  const coloured = leaves.map(([, , w, h]) => rng() < fillP * (w * h < 6 * minC * minC ? 1.2 : 0.7));
  // Always a few blocks of colour, however the dice fall.
  const want = Math.min(leaves.length, 2 + Math.floor(o.detail / 4));
  for (let q = 0; coloured.filter(Boolean).length < want && q < 50; q++) coloured[Math.floor(rng() * leaves.length)] = true;
  leaves.forEach(([x, y, w, h], q) => {
    if (!coloured[q]) return;
    ctx.fillStyle = o.pick(fills.length ? fills : [line]);
    ctx.fillRect(x, y, w, h);
  });
  if (!boogie) {
    ctx.fillStyle = line;
    for (const [x, y, w, h] of lines) ctx.fillRect(x, y, w, h);
    return;
  }
  // Boogie-woogie: bright lines broken up by little blocks of colour.
  const lineCol = fills.reduce((a, b) => (luminance(b) > luminance(a) ? b : a));
  const dots = [...others(fills, lineCol), line];
  ctx.fillStyle = lineCol;
  for (const [x, y, w, h] of lines) ctx.fillRect(x, y, w, h);
  for (const [x, y, w, h] of lines) {
    const len = Math.max(w, h);
    const horiz = w > h;
    let t = lw * o.rand(0.5, 3);
    while (t < len - lw) {
      const run = lw * (rng() < 0.25 ? 2 : 1);
      ctx.fillStyle = o.pick(dots);
      if (horiz) ctx.fillRect(x + t, y, run, lw);
      else ctx.fillRect(x, y + t, lw, run);
      t += run + lw * o.rand(1.2, 4.5);
    }
  }
});

def('bulge', 'Op Bulge', 'geo', null, {
  // A grid pushed through one or more lenses, in the manner of 1960s and 70s op art.
  // Computed per pixel: each pixel maps back into the flat grid, and its edge distance
  // (divided by the local pixel size in grid units) gives exact anti-aliasing.
  pixels(ctx, o) {
    const { rng } = o;
    const S = Math.min(o.W, o.H);
    const s = 52 * o.scale;
    const mode = Math.floor(rng() * 3); // 0 checker, 1 dots, 2 stripes
    const ink = contrastInk(o);
    const tints = others(o.ink, ink);
    const shadeA = o.colors.length > 2 && rng() < 0.6 ? hexToRgb(o.pick(tints)) : null;
    const shadeB = shadeA && rng() < 0.5 ? hexToRgb(o.pick(tints)) : null;
    const A = hexToRgb(o.bg);
    const B = hexToRgb(ink);
    const strength = 0.32 + o.detail * 0.045;
    const single = rng() < 0.55;
    const lenses = [];
    const nL = single ? 1 : 2 + Math.floor(rng() * 2);
    for (let q = 0; q < nL; q++) {
      const R = S * (single ? o.rand(0.36, 0.5) : o.rand(0.22, 0.34));
      const cx = single ? o.W * o.rand(0.4, 0.6) : o.W * o.rand(0.18, 0.82);
      const cy = single ? o.H * o.rand(0.4, 0.6) : o.H * o.rand(0.18, 0.82);
      const k = strength * (q > 0 && rng() < 0.4 ? -0.7 : 1); // a few pinch instead of bulge
      lenses.push([cx, cy, R, k]);
    }
    const dotR = s * o.rand(0.3, 0.4);

    const { x0, y0, w, h } = o.pixel;
    const unit = o.unit;
    const cxL = o.W / 2;
    const cyL = o.H / 2;
    const ca = Math.cos(-o.angle);
    const sa = Math.sin(-o.angle);
    // Two rows of mapped grid coordinates at a time: (u, v) and the lens shading.
    const rowU = [new Float64Array(w + 1), new Float64Array(w + 1)];
    const rowV = [new Float64Array(w + 1), new Float64Array(w + 1)];
    const rowS = [new Float32Array(w + 1), new Float32Array(w + 1)];
    const mapRow = (j, b) => {
      const py = y0 + j + 0.5;
      for (let i = 0; i <= w; i++) {
        const lx = (x0 + i + 0.5) / unit - cxL;
        const ly = py / unit - cyL;
        const X = lx * ca - ly * sa + cxL;
        const Y = lx * sa + ly * ca + cyL;
        let u = X;
        let v = Y;
        let sh = 0;
        // Lenses apply one after another. Each is one-to-one, so overlaps never fold the grid.
        for (const [cx, cy, R, k] of lenses) {
          const dx = u - cx;
          const dy = v - cy;
          const t2 = (dx * dx + dy * dy) / (R * R);
          if (t2 < 1) {
            const e = (1 - t2) * (1 - t2);
            u -= dx * k * e;
            v -= dy * k * e;
            if (k > 0) sh = Math.max(sh, e);
          }
        }
        rowU[b][i] = u;
        rowV[b][i] = v;
        rowS[b][i] = sh;
      }
    };
    const img = ctx.createImageData(w, h);
    const d = img.data;
    mapRow(0, 0);
    for (let j = 0; j < h; j++) {
      const c = j & 1;
      const n = c ^ 1;
      mapRow(j + 1, n);
      const U = rowU[c], V = rowV[c], U2 = rowU[n], V2 = rowV[n], SH = rowS[c];
      for (let i = 0; i < w; i++) {
        const u = U[i];
        const v = V[i];
        const pix = Math.max(Math.hypot(U[i + 1] - u, V[i + 1] - v), Math.hypot(U2[i] - u, V2[i] - v)) + 1e-9;
        const fu = u / s;
        const fv = v / s;
        const iu = Math.floor(fu);
        const iv = Math.floor(fv);
        let par, dist;
        if (mode === 2) {
          const f2 = fu * 2;
          const i2 = Math.floor(f2);
          par = i2 & 1;
          dist = (s / 2) * Math.min(f2 - i2, 1 - (f2 - i2));
        } else {
          par = (iu + iv) & 1;
          dist = s * Math.min(fu - iu, 1 - (fu - iu), fv - iv, 1 - (fv - iv));
          if (mode === 1) {
            const e = Math.hypot(u - (iu + 0.5) * s, v - (iv + 0.5) * s) - dotR;
            if (e < 0) par ^= 1;
            dist = Math.min(dist, Math.abs(e));
          }
        }
        const al = Math.min(1, 0.5 + dist / pix);
        let P = par ? B : A;
        let Q = par ? A : B;
        const sh = SH[i];
        if (sh > 0 && shadeA) {
          // Tint the raised dome so it reads as a sphere.
          const ta = sh * 0.85;
          const mixA = [A[0] + (shadeA[0] - A[0]) * ta, A[1] + (shadeA[1] - A[1]) * ta, A[2] + (shadeA[2] - A[2]) * ta];
          const sB = shadeB || B;
          const tb = shadeB ? ta : 0;
          const mixB = [B[0] + (sB[0] - B[0]) * tb, B[1] + (sB[1] - B[1]) * tb, B[2] + (sB[2] - B[2]) * tb];
          P = par ? mixB : mixA;
          Q = par ? mixA : mixB;
        }
        const di = (j * w + i) * 4;
        d[di] = Q[0] + (P[0] - Q[0]) * al;
        d[di + 1] = Q[1] + (P[1] - Q[1]) * al;
        d[di + 2] = Q[2] + (P[2] - Q[2]) * al;
        d[di + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  },
});

def('sunrise', 'Sunrise', '70s', (ctx, o) => {
  const { rng } = o;
  const S = Math.min(o.W, o.H);
  const k = o.scale;
  const pal = inks(o);
  const start = Math.floor(rng() * pal.length);
  const mode = Math.floor(rng() * 3); // 0 horizon, 1 sunburst, 2 tiled arches
  const n = 3 + Math.round(o.detail * 0.35);
  const gaps = rng() < 0.4;
  const stripes = rng() < 0.75;
  const twist = rng() < 0.35 ? o.rand(0.18, 0.4) * (rng() < 0.5 ? -1 : 1) : 0;
  const nRays = 2 * Math.round(7 + o.detail * 1.1);
  const boldRays = rng() < 0.45;
  // Rays take the most saturated ink, so softened rays stay a tint and never turn grey or brown.
  const sat = (c) => {
    const v = hexToRgb(c);
    return Math.max(...v) - Math.min(...v);
  };
  const ranked = [...others(pal, cyc(pal, start))].sort((a, b) => sat(b) - sat(a));
  const rayInk = ranked[Math.floor(rng() * Math.min(2, ranked.length))];
  const lightBg = luminance(o.bg) > 128;
  const rayCol = boldRays ? rayInk : mixHex(rayInk, o.bg, lightBg ? 0.58 : 0.3);

  const rays = (cx, cy, far, col) => {
    const p = new Path2D();
    for (let q = 0; q < nRays; q += 2) {
      const a0 = (q / nRays) * TAU;
      const a1 = ((q + 1) / nRays) * TAU;
      const pt = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      p.moveTo(cx, cy);
      if (twist) {
        p.quadraticCurveTo(...pt(a0 + twist, far * 0.5), ...pt(a0 + 2 * twist, far));
        p.lineTo(...pt(a1 + 2 * twist, far));
        p.quadraticCurveTo(...pt(a1 + twist, far * 0.5), cx, cy);
      } else {
        p.lineTo(...pt(a0, far));
        p.lineTo(...pt(a1, far));
      }
      p.closePath();
    }
    ctx.fillStyle = col;
    ctx.fill(p);
  };
  // Rainbow bands around a striped sun. st picks the colours.
  const sun = (cx, cy, R, bw, st, behind) => {
    for (let b = n - 1; b >= 0; b--) {
      const r = R + (b + 1) * bw;
      if (gaps) {
        ctx.strokeStyle = cyc(pal, st + b + 1);
        ctx.lineWidth = bw * 0.72;
        ctx.beginPath();
        ctx.arc(cx, cy, r - bw / 2, 0, TAU);
        ctx.stroke();
      } else {
        disc(ctx, cx, cy, r, cyc(pal, st + b + 1));
      }
    }
    if (gaps) {
      disc(ctx, cx, cy, R + bw * 0.14, behind);
    }
    disc(ctx, cx, cy, R, cyc(pal, st));
    if (!stripes) return;
    // Retro cut-out stripes across the lower half, thickening toward the bottom.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + o.px, 0, TAU);
    ctx.clip();
    ctx.fillStyle = gaps ? behind : cyc(pal, st + 1);
    let y = cy + R * 0.12;
    for (let m = 0; y < cy + R; m++) {
      const t = R * (0.035 + m * 0.03);
      ctx.fillRect(cx - R - 1, y, 2 * R + 2, t);
      y += t + R * (0.13 - m * 0.012);
    }
    ctx.restore();
  };

  if (mode === 2) {
    const c = 230 * k;
    const th = c * 1.25;
    const gap = c * 0.09;
    const frame = darkest(o.colors) === o.bg ? cyc(pal, start + n + 2) : darkest(o.colors);
    ctx.fillStyle = frame;
    ctx.fillRect(-1, -1, o.W + 2, o.H + 2);
    const cols = Math.ceil(o.W / c) + 1;
    const rows = Math.ceil(o.H / th) + 1;
    for (let j = -1; j < rows; j++) {
      for (let i = -1; i < cols; i++) {
        const x = i * c + (j & 1 ? c / 2 : 0) + gap / 2;
        const y = j * th + gap / 2;
        const tw = c - gap;
        const hh = th - gap;
        const st = start + Math.floor(o.hash(i, j) * pal.length);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, y + hh);
        ctx.lineTo(x, y + tw / 2);
        ctx.arc(x + tw / 2, y + tw / 2, tw / 2, Math.PI, TAU);
        ctx.lineTo(x + tw, y + hh);
        ctx.closePath();
        ctx.fillStyle = o.bg;
        ctx.fill();
        ctx.clip();
        rays(x + tw / 2, y + hh, hh * 1.6, rayCol);
        sun(x + tw / 2, y + hh, tw * 0.16, (tw * 0.3) / n, st, o.bg);
        ctx.restore();
      }
    }
    return;
  }

  const horizon = mode === 0;
  const cx = o.W * (horizon ? 0.5 : o.rand(0.35, 0.65));
  const hy = o.H * (horizon ? o.rand(0.6, 0.72) : o.rand(0.4, 0.6));
  const R = S * o.rand(0.13, 0.18) * k;
  const bw = (S * o.rand(0.2, 0.28) * k) / n;
  const cy = horizon ? hy - R * 0.55 : hy;
  rays(cx, cy, Math.hypot(o.W, o.H) * 1.2, rayCol);
  sun(cx, cy, R, bw, start, o.bg);
  if (horizon) {
    // A striped ground in perspective, thin at the horizon.
    const ground = darkest(o.colors) === o.bg ? cyc(pal, start + n + 2) : darkest(o.colors);
    ctx.fillStyle = ground;
    ctx.fillRect(-1, hy, o.W + 2, o.H - hy + 1);
    const M = 5 + Math.round(o.detail * 0.5);
    const lineCol = cyc(others(pal, ground), start + 1);
    ctx.fillStyle = lineCol;
    for (let m = 0; m < M; m++) {
      const t0 = (m + 0.35) / M;
      const y0 = hy + (o.H - hy) * t0 * t0;
      const tt = (o.H - hy) * (0.012 + 0.05 * t0);
      ctx.fillRect(-1, y0, o.W + 2, tt);
    }
  }
}, { thumb: { scale: 1.1 } });

def('cutouts', 'Cut-Outs', 'art', (ctx, o) => {
  const { rng } = o;
  const k = o.scale;
  const pal = o.colors;
  // Sheets of coloured paper on the wall, slightly askew, then shapes cut from other sheets.
  const size = 290 * k * o.rand(0.85, 1.2);
  const cols = Math.max(1, Math.round(o.W / size));
  const rows = Math.max(1, Math.round(o.H / size));
  const cw = o.W / cols;
  const ch = o.H / rows;
  const inset = 5 * k;
  const jit = Math.min(cw, ch) * 0.012;
  const sheets = [];
  const tone = tones(o, 0);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const avoid = [o.bg];
      if (i) avoid.push(sheets[sheets.length - 1].col);
      if (j) avoid.push(sheets[sheets.length - cols].col);
      const col = tone.pick(rng(), avoid);
      const corner = () => [o.rand(-jit, jit), o.rand(-jit, jit)];
      sheets.push({ x: i * cw, y: j * ch, col, c: [corner(), corner(), corner(), corner()] });
    }
  }
  const contrast = (under) => {
    const lu = luminance(under);
    const options = pal.filter((c) => c !== under);
    const strong = options.filter((c) => Math.abs(luminance(c) - lu) > 45);
    return o.pick(strong.length ? strong : options);
  };

  // A seaweed frond: a curved spine with lobed edges that alternate side to side.
  const frond = (p, x, y, len, wid, a, lobes, bend, ph) => {
    const N = 160;
    const left = [];
    const right = [];
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let q = 0; q <= N; q++) {
      const t = q / N;
      const along = len * t;
      const off = bend * len * t * t;
      const px = x + ca * along - sa * off;
      const py = y + sa * along + ca * off;
      const tx = ca * len - sa * 2 * bend * len * t;
      const ty = sa * len + ca * 2 * bend * len * t;
      const tl = Math.hypot(tx, ty);
      const nx = -ty / tl, ny = tx / tl;
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08 + 0.02)), 0.7) * (1 - 0.3 * t);
      const lob = (phase) => (lobes ? 0.16 + 0.84 * Math.pow(Math.abs(Math.sin(Math.PI * lobes * t + phase)), 0.45) : 1);
      const hand = 1 + 0.035 * Math.sin(t * 41 + ph * 3);
      const wl = Math.max(wid * 0.05, wid * env * lob(ph) * hand);
      const wr = Math.max(wid * 0.05, wid * env * lob(ph + Math.PI / 2) * hand);
      left.push([px + nx * wl, py + ny * wl]);
      right.push([px - nx * wr, py - ny * wr]);
    }
    p.moveTo(...left[0]);
    for (const pt of left) p.lineTo(...pt);
    for (let q = right.length - 1; q >= 0; q--) p.lineTo(...right[q]);
    p.closePath();
  };
  // A soft-lobed star, as if cut freehand with scissors.
  const star = (p, x, y, R, m, rot, ph) => {
    const N = 220;
    for (let q = 0; q <= N; q++) {
      const t = (q / N) * TAU;
      const r = R * (0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.cos(m * (t - rot)), 0.85)) * (1 + 0.035 * Math.sin(3 * t + ph));
      if (q) p.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
      else p.moveTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
    }
    p.closePath();
  };
  const blob = (p, x, y, R, ph) => wobbleCircle(p, x, y, R, 0.08, [ph, ph * 2.3, ph * 0.7]);

  for (const s of sheets) {
    const pts = [
      [s.x + inset + s.c[0][0], s.y + inset + s.c[0][1]],
      [s.x + cw - inset + s.c[1][0], s.y + inset + s.c[1][1]],
      [s.x + cw - inset + s.c[2][0], s.y + ch - inset + s.c[2][1]],
      [s.x + inset + s.c[3][0], s.y + ch - inset + s.c[3][1]],
    ];
    ctx.fillStyle = s.col;
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const pt of pts.slice(1)) ctx.lineTo(...pt);
    ctx.closePath();
    ctx.fill();
  }
  for (const s of sheets) {
    const cx = s.x + cw / 2 + o.rand(-0.08, 0.08) * cw;
    const cy = s.y + ch / 2 + o.rand(-0.08, 0.08) * ch;
    const m = Math.min(cw, ch);
    const p = new Path2D();
    const t = rng();
    if (t < 0.45) {
      // Frond rising from the bottom of the sheet, sometimes with side branches.
      const a = -Math.PI / 2 + o.rand(-0.45, 0.45);
      const len = m * o.rand(0.7, 0.9);
      const bx = cx - (Math.cos(a) * len) / 2;
      const by = cy - (Math.sin(a) * len) / 2;
      const bend = o.rand(-0.18, 0.18);
      const lobes = 2 + Math.floor(rng() * 3);
      frond(p, bx, by, len, m * o.rand(0.2, 0.27), a, lobes, bend, o.rand(0, TAU));
      if (rng() < 0.5) {
        for (const side of [-1, 1]) {
          const tt = o.rand(0.3, 0.55);
          frond(p, bx + Math.cos(a) * len * tt, by + Math.sin(a) * len * tt, len * o.rand(0.35, 0.5), m * 0.12, a + side * o.rand(0.55, 0.85), 2 + Math.floor(rng() * 2), -side * 0.1, o.rand(0, TAU));
        }
      }
    } else if (t < 0.75) {
      star(p, cx, cy, m * o.rand(0.3, 0.4), 5 + Math.floor(rng() * 4), o.rand(0, TAU), o.rand(0, TAU));
    } else {
      // A spray of leaves from one point.
      const leaves = 3 + Math.floor(rng() * 3);
      const base = o.rand(0, TAU);
      for (let q = 0; q < leaves; q++) {
        const a = base + (q / leaves) * TAU + o.rand(-0.2, 0.2);
        frond(p, cx, cy, m * o.rand(0.3, 0.42), m * o.rand(0.08, 0.12), a, 0, o.rand(-0.15, 0.15), o.rand(0, TAU));
      }
    }
    ctx.fillStyle = contrast(s.col);
    ctx.fill(p);
  }
  // Loose confetti: little stars, blobs and leaves dropped across the seams.
  const bits = spread(o, Math.round((4 + o.detail * 2.2) * (o.W * o.H) / 1.5e6 / (k * k)), 0.02);
  for (const [x, y] of bits) {
    const sheet = sheets[Math.min(rows - 1, Math.floor(y / ch)) * cols + Math.min(cols - 1, Math.floor(x / cw))];
    const r = Math.min(cw, ch) * o.rand(0.04, 0.08);
    const p = new Path2D();
    const t = rng();
    if (t < 0.35) star(p, x, y, r, 5 + Math.floor(rng() * 3), o.rand(0, TAU), o.rand(0, TAU));
    else if (t < 0.7) blob(p, x, y, r * 0.75, o.rand(0, TAU));
    else frond(p, x, y, r * 2.4, r * 0.55, o.rand(0, TAU), 0, o.rand(-0.2, 0.2), 0);
    ctx.fillStyle = contrast(sheet ? sheet.col : o.bg);
    ctx.fill(p);
  }
}, { thumb: { scale: 1.2 } });

def('atomic', 'Atomic Age', 'art', (ctx, o) => {
  const { rng } = o;
  const c = 140 * o.scale;
  const line = contrastInk(o);
  const skip = 0.34 - o.detail * 0.03;
  const tone = tones(o);
  const lw = c * 0.022;
  const mix = Math.floor(rng() * 3); // which motifs lead: 0 bursts, 1 boomerangs, 2 even
  const cols = Math.ceil(o.W / c) + 2;
  const rows = Math.ceil(o.H / c) + 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const burst = (x, y, r, spikes, rot, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let q = 0; q < spikes; q++) {
      const a = rot + (q / spikes) * TAU;
      const len = q & 1 ? r * 0.55 : r;
      // Spikes start at the centre so their union covers the hub with no anti-aliased specks.
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    }
    ctx.stroke();
    disc(ctx, x, y, r * 0.1, col);
  };
  const sputnik = (x, y, r, rot, col, dotCol) => {
    const arms = 3 + Math.floor(o.hash(x, y, 9) * 4);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    for (let q = 0; q < arms; q++) {
      const a = rot + (q / arms) * TAU;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.stroke();
    for (let q = 0; q < arms; q++) {
      const a = rot + (q / arms) * TAU;
      disc(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.12, dotCol);
    }
    disc(ctx, x, y, r * 0.3, dotCol);
  };
  // The classic lopsided boomerang: two tapered arms, one longer than the other.
  const boomerang = (x, y, r, rot, col) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(r, r);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-0.95, -0.2);
    ctx.quadraticCurveTo(-0.6, 0.5, 0.05, 0.38);
    ctx.quadraticCurveTo(0.7, 0.28, 1.1, -0.5);
    ctx.quadraticCurveTo(0.55, 0.02, 0.02, 0.08);
    ctx.quadraticCurveTo(-0.45, 0.1, -0.95, -0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  const atom = (x, y, r, rot, col, nucleus) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * 0.8;
    for (let q = 0; q < 3; q++) {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.32, rot + (q * Math.PI) / 3, 0, TAU);
      ctx.stroke();
    }
    disc(ctx, x, y, r * 0.16, nucleus);
  };
  const sparkle = (x, y, r, rot, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let q = 0; q < 4; q++) {
      const a = rot + (q * Math.PI) / 2;
      const b = a + Math.PI / 2;
      const p1 = [x + Math.cos(a) * r, y + Math.sin(a) * r];
      const p2 = [x + Math.cos(b) * r, y + Math.sin(b) * r];
      if (!q) ctx.moveTo(...p1);
      ctx.quadraticCurveTo(x, y, ...p2);
    }
    ctx.closePath();
    ctx.fill();
  };
  const kidney = (x, y, r, rot, col) => {
    const p = new Path2D();
    wobbleCircle(p, 0, 0, r, 0.22, [rot * 3, rot * 5, rot * 7]);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(1.35, 0.8);
    ctx.fillStyle = col;
    ctx.fill(p);
    ctx.restore();
  };

  // Bigger soft shapes first, line motifs on top.
  const items = [];
  for (let j = -1; j < rows; j++) {
    for (let i = -1; i < cols; i++) {
      const h = (q) => o.hash(i, j, q);
      if (h(0) < skip) continue;
      const x = (i + 0.5 + (h(1) - 0.5) * 0.55) * c + (j & 1 ? c / 2 : 0);
      const y = (j + 0.5 + (h(2) - 0.5) * 0.55) * c * 0.9;
      const r = c * (0.28 + h(3) * 0.16);
      const rot = h(4) * TAU;
      let t = h(5);
      if (mix === 0) t = t < 0.45 ? 0.05 : t;
      if (mix === 1) t = t < 0.35 ? 0.45 : t;
      const kind = t < 0.22 ? 'burst' : t < 0.36 ? 'sputnik' : t < 0.55 ? 'boomerang' : t < 0.66 ? 'atom' : t < 0.82 ? 'sparkle' : 'kidney';
      const col = tone.pick(h(6), [o.bg, line]);
      const col2 = tone.pick(h(7), [o.bg, line, col]);
      items.push({ x, y, r, rot, kind, col, col2, layer: kind === 'kidney' || kind === 'boomerang' ? 0 : 1 });
    }
  }
  for (const layer of [0, 1]) {
    for (const it of items) {
      if (it.layer !== layer) continue;
      const { x, y, r, rot } = it;
      if (it.kind === 'burst') burst(x, y, r, 2 * (5 + Math.floor((rot / TAU) * 4)), rot, line);
      else if (it.kind === 'sputnik') sputnik(x, y, r * 0.8, rot, line, it.col);
      else if (it.kind === 'boomerang') boomerang(x, y, r * 0.95, rot, it.col);
      else if (it.kind === 'atom') atom(x, y, r * 0.85, rot, line, it.col);
      else if (it.kind === 'sparkle') sparkle(x, y, r * 0.55, rot, it.col);
      else kidney(x, y, r * 0.6, rot, it.col2);
    }
  }
}, { thumb: { scale: 1.6 } });

def('oplines', 'Op Lines', 'geo', (ctx, o) => {
  const { rng } = o;
  const pitch = 15 * o.scale;
  const ink = contrastInk(o);
  const mode = Math.floor(rng() * 3); // 0 squeeze, 1 swell, 2 ripple. Rows always share phase, so lines never cross.
  const vertical = rng() < 0.4;
  const lw = pitch * o.rand(0.42, 0.56);
  const amp = pitch * (0.9 + o.detail * 0.22) * o.rand(0.85, 1.15);
  const ph = Array.from({ length: 4 }, () => rng() * TAU);
  const reverse = rng() < 0.5;

  withTurn(ctx, o, vertical ? Math.PI / 2 : 0, (W, H) => {
    const lmax = W * o.rand(0.09, 0.16);
    const lmin = lmax * o.rand(0.12, 0.22);
    const rows = Math.ceil(H / pitch) + 8;
    const step = lmin / 14;
    // Each line is a filled ribbon of constant vertical thickness. Stroking would fold
    // back on itself at tight crests and leave pinholes; a ribbon cannot.
    const p = new Path2D();
    for (let r = 0; r < rows; r++) {
      const y0 = (r - 4) * pitch;
      const v = y0 / H;
      let phase = ph[0];
      const top = [];
      for (let x = -pitch * 2; x <= W + pitch * 2 + step; x += step) {
        const u = Math.min(1, Math.max(0, x / W));
        let lambda = lmax;
        let a = amp;
        if (mode === 0) lambda = lmax + (lmin - lmax) * (reverse ? 1 - u : u) ** 1.4;
        else if (mode === 1) {
          lambda = lmax + (lmin - lmax) * 0.5 * (reverse ? 1 - u : u);
          const sw = Math.sin(Math.PI * Math.min(1, Math.max(0, v * 0.9 + 0.05 + 0.25 * Math.sin(TAU * u + ph[3]))));
          a = amp * (0.08 + 0.92 * sw * sw);
        } else {
          lambda = (lmax + lmin) / 2;
          a = amp * (0.15 + 0.85 * (0.5 + 0.5 * Math.sin(TAU * (u * 1.3 + v * 0.8) + ph[1]) * Math.cos(TAU * (v * 1.1 - u * 0.4) + ph[2])));
        }
        top.push([x, y0 + a * Math.sin(phase)]);
        phase += (TAU * step) / lambda;
      }
      p.moveTo(top[0][0], top[0][1] - lw / 2);
      for (const [x, y] of top) p.lineTo(x, y - lw / 2);
      for (let q = top.length - 1; q >= 0; q--) p.lineTo(top[q][0], top[q][1] + lw / 2);
      p.closePath();
    }
    ctx.fillStyle = ink;
    ctx.fill(p);
  });
});

def('kaleido', 'Kaleidoscope', '70s', (ctx, o) => {
  const { rng } = o;
  const tiled = rng() < 0.45;
  // Tiled mandalas use 4-fold mirrors, so each square tile matches its neighbours at the edges.
  const n = tiled ? 4 : o.pick([5, 6, 6, 8, 8, 10, 12]);
  const wedge = Math.PI / n;
  const tone = tones(o, 0.18);
  const line = contrastInk(o);

  // Concentric bands under everything, then shapes placed in one wedge (unit radius).
  const B = 3 + Math.floor(o.detail / 3);
  const bands = [];
  for (let b = 0; b < B; b++) bands.push(tone.pick(rng(), bands.length ? [bands[bands.length - 1]] : []));
  const bandAt = (r) => bands[Math.min(B - 1, Math.floor((1 - Math.min(1, r)) * B))];
  const shapes = [];
  const m = Math.round(8 + o.detail * 3.2);
  for (let q = 0; q < m; q++) {
    const r = 0.07 + 0.91 * rng() ** 0.7;
    const a = rng() * wedge;
    const size = (0.025 + 0.07 * rng()) * (0.45 + r);
    const kind = o.pick(['petal', 'petal', 'disc', 'ring', 'tri', 'eye', 'dots', 'arc']);
    const under = bandAt(r);
    const c1 = tone.pick(rng(), [under]);
    const c2 = tone.pick(rng(), [c1, under]);
    shapes.push({ r, a, size, kind, c1, c2 });
  }
  shapes.sort((p, q) => q.size - p.size);

  const drawShapes = (R) => {
    for (const sh of shapes) {
      const x = Math.cos(sh.a) * sh.r * R;
      const y = Math.sin(sh.a) * sh.r * R;
      const z = sh.size * R;
      if (sh.kind === 'petal' || sh.kind === 'eye') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(sh.a);
        ctx.fillStyle = sh.c1;
        ctx.beginPath();
        ctx.ellipse(0, 0, z * 1.7, z * (sh.kind === 'eye' ? 0.7 : 0.55), 0, 0, TAU);
        ctx.fill();
        if (sh.kind === 'eye') disc(ctx, 0, 0, z * 0.38, sh.c2);
        ctx.restore();
      } else if (sh.kind === 'disc') {
        disc(ctx, x, y, z, sh.c1);
        disc(ctx, x, y, z * 0.45, sh.c2);
      } else if (sh.kind === 'ring') {
        ctx.strokeStyle = sh.c1;
        ctx.lineWidth = z * 0.32;
        ctx.beginPath();
        ctx.arc(x, y, z, 0, TAU);
        ctx.stroke();
      } else if (sh.kind === 'tri') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(sh.a);
        ctx.fillStyle = sh.c1;
        ctx.beginPath();
        ctx.moveTo(z * 1.6, 0);
        ctx.lineTo(-z * 0.8, z * 0.9);
        ctx.lineTo(-z * 0.8, -z * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (sh.kind === 'dots') {
        for (let k = 0; k < 3; k++) disc(ctx, x + Math.cos(sh.a) * z * 1.1 * k, y + Math.sin(sh.a) * z * 1.1 * k, z * 0.32, k === 1 ? sh.c2 : sh.c1);
      } else {
        ctx.strokeStyle = sh.c1;
        ctx.lineWidth = z * 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, sh.r * R, sh.a - 0.3 * wedge, sh.a + 0.3 * wedge);
        ctx.stroke();
      }
    }
  };

  // One mirrored mandala. Each wedge's clip is widened by about a pixel on both edges, so
  // mirrored neighbours overlap instead of meeting in an anti-aliased hairline.
  const mandala = (cx, cy, R) => {
    for (let b = 0; b < B; b++) disc(ctx, cx, cy, R * (1 - b / B) + (b ? 0 : o.px), bands[b]);
    const d = o.px * 0.75;
    const ex = R * 1.5;
    const n2 = [-Math.sin(wedge), Math.cos(wedge)];
    const x0 = -(d + d * Math.cos(wedge)) / Math.sin(wedge);
    for (let k = 0; k < 2 * n; k++) {
      ctx.save();
      ctx.translate(cx, cy);
      if (k & 1) {
        ctx.rotate((k + 1) * wedge);
        ctx.scale(1, -1);
      } else ctx.rotate(k * wedge);
      ctx.beginPath();
      ctx.moveTo(x0, -d);
      ctx.lineTo(ex, -d);
      ctx.lineTo(ex * Math.cos(wedge) + d * n2[0], ex * Math.sin(wedge) + d * n2[1]);
      ctx.closePath();
      ctx.clip();
      drawShapes(R);
      ctx.restore();
    }
    disc(ctx, cx, cy, R * 0.06, line);
  };

  if (!tiled) {
    mandala(o.W / 2, o.H / 2, Math.hypot(o.W, o.H) / 2 + o.px);
    return;
  }
  const c = 330 * o.scale;
  // When the frame turns, tile far enough to cover its corners.
  const span = o.angle ? Math.hypot(o.W, o.H) : 0;
  const cols = Math.ceil((span || o.W) / c) + 1;
  const rows = Math.ceil((span || o.H) / c) + 1;
  const ox = (o.W - cols * c) / 2;
  const oy = (o.H - rows * c) / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = ox + i * c;
      const y = oy + j * c;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - o.px, y - o.px, c + 2 * o.px, c + 2 * o.px);
      ctx.clip();
      mandala(x + c / 2, y + c / 2, (c / 2) * Math.SQRT2);
      ctx.restore();
    }
  }
  // Grout between the tiles, as on glazed ceramic. Where a shape ends just short of a tile
  // edge, its mirror image leaves a sliver along that edge; the grout makes the edge deliberate.
  const grout = new Path2D();
  for (let i = 0; i <= cols; i++) {
    grout.moveTo(ox + i * c, oy);
    grout.lineTo(ox + i * c, oy + rows * c);
  }
  for (let j = 0; j <= rows; j++) {
    grout.moveTo(ox, oy + j * c);
    grout.lineTo(ox + cols * c, oy + j * c);
  }
  ctx.strokeStyle = o.bg;
  ctx.lineWidth = Math.max(c * 0.016, 2 * o.px);
  ctx.lineCap = 'butt';
  ctx.stroke(grout);
}, { thumb: { scale: 1.2 }, fit: true });

def('parquet', 'Parquet', '70s', (ctx, o) => {
  const { rng } = o;
  const w = 34 * o.scale;
  const r = 2 + Math.round(o.detail / 3); // plank length in widths
  const basket = rng() < 0.35;
  const diagonal = !basket && rng() < 0.6;
  const grout = darkest(o.colors);
  const gap = w * 0.07;
  const tone = tones(o, 0.25);
  const shade = rng() < 0.5; // planks of one direction a touch darker, like light across a floor
  // Colour by row or block (stripes), as shades of one wood, or plank by plank (mosaic).
  const roll = rng();
  const mode = roll < 0.5 ? 'stripes' : roll < 0.78 ? 'wood' : 'mosaic';
  const wood = tone.pick(rng(), [grout]);
  const paths = new Map();
  const add = (col) => paths.get(col) || paths.set(col, new Path2D()).get(col);
  // group: hash for the block or row; h: hash for this plank.
  const plank = (x, y, pw, ph, group, h, darker) => {
    let col;
    if (mode === 'stripes') col = tone.pick(group, [grout]);
    else if (mode === 'wood') col = h < 0.5 ? mixHex(wood, o.bg, h * 0.5) : mixHex(wood, grout, (h - 0.5) * 0.5);
    else col = tone.pick(h, [grout]);
    if (darker) col = mixHex(col, grout, 0.12);
    add(col).rect(x + gap / 2, y + gap / 2, pw - gap, ph - gap);
  };

  withTurn(ctx, o, diagonal ? Math.PI / 4 : 0, (W, H) => {
    ctx.fillStyle = grout;
    ctx.fillRect(-w, -w, W + 2 * w, H + 2 * w);
    if (basket) {
      const b = r * w;
      for (let j = -1; j * b < H + b; j++) {
        for (let i = -1; i * b < W + b; i++) {
          const across = (i + j) & 1;
          const group = o.hash(i, j, 99);
          for (let k = 0; k < r; k++) {
            const h = o.hash(i, j, k);
            if (across) plank(i * b, j * b + k * w, b, w, group, h, false);
            else plank(i * b + k * w, j * b, w, b, group, h, shade);
          }
        }
      }
    } else {
      // Herringbone: horizontal planks at (t + s·r, t − s·r) and vertical ones beside them,
      // in units of the plank width. The two lattice vectors (1, 1) and (r, −r) tile the plane.
      const X0 = -2 * r, X1 = W / w + 2 * r, Y0 = -2 * r, Y1 = H / w + 2 * r;
      const t0 = Math.floor((X0 + Y0) / 2), t1 = Math.ceil((X1 + Y1) / 2);
      const s0 = Math.floor((X0 - Y1) / (2 * r)), s1 = Math.ceil((X1 - Y0) / (2 * r));
      for (let s = s0; s <= s1; s++) {
        for (let t = t0; t <= t1; t++) {
          const hx = t + s * r, hy = t - s * r;
          if (hx > X1 || hx < X0 - r || hy > Y1 || hy < Y0 - r) continue;
          // Each staircase s is one zigzag row.
          const group = o.hash(s, 0, 99);
          plank(hx * w, hy * w, r * w, w, group, o.hash(t, s, 0), false);
          plank((hx + r) * w, (hy + 1 - r) * w, w, r * w, group, o.hash(t, s, 1), shade);
        }
      }
    }
    for (const [col, p] of paths) {
      ctx.fillStyle = col;
      ctx.fill(p);
    }
  });
});

// One-line descriptions shown under the preview.
const ABOUT = {
  waves: 'Nested wavy bands, like a 1970s bedspread.',
  scallops: 'Rainbow scales and arches, overlapping row on row.',
  drops: 'Petal-shaped drops in alternating columns.',
  loops: 'Interlocking banded loops strung in rows.',
  ogee: 'An onion-dome ogee lattice with banded cells.',
  diamonds: 'Concentric diamonds nested on a lattice.',
  liquid: 'Psychedelic contour bands of a warped field, computed per pixel.',
  flowers: 'Scattered flower-power daisies, some doubled.',
  supergraphic: 'Racing-stripe supergraphics with rounded corners.',
  targets: 'Rows of mod bullseyes.',
  rainbowtiles: 'Quarter-circle rainbow tiles that join into arches, circles and fans.',
  sunrise: 'A striped 70s sun with rays and rainbow bands.',
  bauhaus: 'Bauhaus-style tiles of arcs, circles and blocks.',
  quilt: 'Mirrored triangle blocks, pieced like a quilt.',
  chevron: 'Op-art chevrons in a rhythmic stripe sequence.',
  truchet: 'Truchet tiles that link into endless banded paths.',
  cubes: 'Tumbling blocks: the classic three-tone cube illusion.',
  opsquares: 'A checkerboard squeezed into folds, after 1960s op art.',
  bulge: 'A grid swelling through lenses, after Vasarely’s spheres.',
  oplines: 'Vibrating wavy lines that tighten and ripple, after Bridget Riley.',
  composition: 'An abstract composition after Kandinsky: circles, lines and planes.',
  circles: 'Glowing circles on a night sky, after Kandinsky’s Several Circles.',
  colorstudy: 'Concentric circles in squares, after Kandinsky’s colour study.',
  destijl: 'De Stijl grids after Mondrian, sometimes boogie-woogie.',
  cutouts: 'Paper cut-out fronds and stars, after Matisse.',
  atomic: 'Mid-century starbursts, boomerangs, atoms and sparkles.',
  kaleido: 'A mirrored psychedelic mandala, alone or as glazed tiles whose mirrors meet.',
  parquet: 'Herringbone and basketweave parquet, laid plank by plank with dark grout.',
};
for (const p of PATTERNS) p.about = ABOUT[p.id] || '';
