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
