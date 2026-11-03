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
  const pal = others(o.colors, o.bg);
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
        ci: Math.floor(h(6) * pal.length),
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
    petals(fl, fl.R, cyc(pal, fl.ci), 0);
    if (fl.double) petals(fl, fl.R * 0.62, cyc(pal, fl.ci + 1), Math.PI / fl.k);
    if (outline) disc(ctx, fl.x, fl.y, fl.R * 0.26 + olw, outline);
    disc(ctx, fl.x, fl.y, fl.R * 0.26, cyc(pal, fl.ci + 2));
    disc(ctx, fl.x, fl.y, fl.R * 0.12, cyc(pal, fl.ci + 3));
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

function threeColours(L, h0, h1, h2) {
  const a = Math.floor(h0 * L);
  const b = (a + 1 + Math.floor(h1 * (L - 1))) % L;
  let c = (b + 1 + Math.floor(h2 * (L - 1))) % L;
  if (c === a && L > 2) c = (c + 1) % L === b ? (c + 2) % L : (c + 1) % L;
  return [a, b, c];
}

def('bauhaus', 'Bauhaus Blocks', 'geo', (ctx, o) => {
  const c = 115 * o.scale;
  const cols = Math.ceil(o.W / c);
  const rows = Math.ceil(o.H / c);
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
  const pal = o.colors;
  for (const t of tiles) {
    const s = t.size * c;
    const h = (k) => o.hash(t.i, t.j, k + 10);
    const [a, b, cc] = threeColours(pal.length, h(0), h(1), h(2));
    const motif = MOTIFS[Math.floor(h(3) * MOTIFS.length)];
    ctx.save();
    ctx.translate(t.i * c, t.j * c);
    ctx.fillStyle = pal[a];
    ctx.fillRect(0, 0, s + o.px, s + o.px);
    ctx.translate(s / 2, s / 2);
    ctx.rotate((Math.floor(h(4) * 4) * Math.PI) / 2);
    ctx.translate(-s / 2, -s / 2);
    motif(ctx, s, pal[a], pal[b], pal[cc], o.detail);
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
  const pal = o.colors;
  const L = pal.length;
  const quarterP = o.detail * 0.05;
  const block = [];
  for (let b = 0; b < k * k; b++) {
    const pi = Math.floor(rng() * L);
    const P = pal[pi];
    const Q = pal[(pi + 1 + Math.floor(rng() * (L - 1))) % L];
    const t = rng();
    if (t < quarterP) block.push([P, pal[Math.floor(rng() * L)], Q, pal[Math.floor(rng() * L)]]);
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
}, { thumb: { scale: 1.1 } });

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
}, { thumb: { scale: 1.2 } });

def('colorstudy', 'Color Study', 'art', (ctx, o) => {
  const { rng } = o;
  const c = 165 * o.scale;
  const rings = 2 + Math.round(o.detail * 0.3);
  const wob = rng() < 0.75 ? o.rand(0.012, 0.028) : 0;
  const pal = o.colors;
  const L = pal.length;
  const cols = Math.ceil(o.W / c) + 1;
  const rows = Math.ceil(o.H / c) + 1;
  const ox = (o.W - (cols - 1) * c) / 2 - c / 2;
  const oy = (o.H - (rows - 1) * c) / 2 - c / 2;
  const cells = new Map();
  const add = (col) => cells.get(col) || cells.set(col, new Path2D()).get(col);
  const bgOf = (i, j) => pal[Math.floor(o.hash(i, j, 0) * L)];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) add(bgOf(i, j)).rect(ox + i * c, oy + j * c, c, c);
  for (const [col, p] of cells) {
    ctx.fillStyle = col;
    ctx.fill(p);
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const h = (q) => o.hash(i, j, q);
      let prev = bgOf(i, j);
      let cx = ox + i * c + c / 2 + (h(1) - 0.5) * c * 0.08;
      let cy = oy + j * c + c / 2 + (h(2) - 0.5) * c * 0.08;
      let r = c * (0.36 + h(3) * 0.07);
      for (let q = 0; q < rings; q++) {
        const choices = pal.filter((x) => x !== prev);
        const colr = choices[Math.floor(h(10 + q) * choices.length)];
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
