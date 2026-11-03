import {
  PATTERNS, PATTERNS_BY_ID, PALETTES, PALETTES_BY_ID, PALETTE_GROUPS, MAX_SIDE,
  renderPattern, exportPNG, randomSeed,
} from './core.js?v=2';

const $ = (id) => document.getElementById(id);
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

const screenSize = (() => {
  const r = window.devicePixelRatio || 1;
  const w = Math.round(window.screen.width * r);
  const h = Math.round(window.screen.height * r);
  return `${Math.min(w, MAX_SIDE)}x${Math.min(h, MAX_SIDE)}`;
})();

const SIZES = [
  ['7680x4320', '8K UHD · 7680 × 4320'],
  ['4320x7680', '8K portrait · 4320 × 7680'],
  ['8192x8192', '8K square · 8192 × 8192'],
  ['5120x2880', '5K · 5120 × 2880'],
  ['3840x2160', '4K UHD · 3840 × 2160'],
  ['4096x4096', 'Square · 4096 × 4096'],
  ['2560x1440', 'QHD · 2560 × 1440'],
  ['1920x1080', 'Full HD · 1920 × 1080'],
  ['1290x2796', 'Phone wallpaper · 1290 × 2796'],
  ['2048x2732', 'Tablet · 2048 × 2732'],
  [screenSize, `This screen · ${screenSize.replace('x', ' × ')}`],
  ['custom', 'Custom size…'],
];

const DEFAULTS = { style: 'waves', palette: 'harvest', scale: 1, detail: 5, rotation: 0, size: '7680x4320', custom: '3000x2000' };

// ---------------------------------------------------------------- state & URL

let state = fromHash() || {
  ...DEFAULTS,
  colors: [...PALETTES_BY_ID[DEFAULTS.palette].colors],
  seed: randomSeed(),
};
const past = [];

function fromHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (!q.has('style') && !q.has('seed')) return null;
  const s = { ...DEFAULTS };
  if (PATTERNS_BY_ID[q.get('style')]) s.style = q.get('style');
  s.seed = (q.get('seed') || randomSeed()).slice(0, 24);
  const colors = (q.get('colors') || '').split('.').filter((c) => /^[0-9a-f]{6}$/i.test(c)).map((c) => `#${c.toLowerCase()}`);
  if (colors.length >= 2) {
    s.colors = colors.slice(0, 8);
    s.palette = 'custom';
  } else {
    s.palette = PALETTES_BY_ID[q.get('palette')] ? q.get('palette') : DEFAULTS.palette;
    s.colors = [...PALETTES_BY_ID[s.palette].colors];
  }
  s.scale = clamp(parseFloat(q.get('scale')) || 1, 0.4, 2.5);
  s.detail = clamp(Math.round(parseFloat(q.get('detail')) || 5), 1, 10);
  s.rotation = clamp(Math.round(parseFloat(q.get('rot')) || 0), -90, 90);
  const size = q.get('size');
  if (size && /^\d+x\d+$/.test(size)) {
    if (SIZES.some(([id]) => id === size)) s.size = size;
    else {
      s.size = 'custom';
      s.custom = size;
    }
  }
  return s;
}

function toHash() {
  const q = new URLSearchParams();
  q.set('style', state.style);
  if (state.palette === 'custom') q.set('colors', state.colors.map((c) => c.slice(1)).join('.'));
  else q.set('palette', state.palette);
  q.set('seed', state.seed);
  q.set('scale', String(state.scale));
  q.set('detail', String(state.detail));
  if (state.rotation) q.set('rot', String(state.rotation));
  q.set('size', state.size === 'custom' ? state.custom : state.size);
  return q.toString();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function outputSize() {
  const [w, h] = (state.size === 'custom' ? state.custom : state.size).split('x').map(Number);
  return [clamp(w || 1920, 16, MAX_SIDE), clamp(h || 1080, 16, MAX_SIDE)];
}

function remember() {
  past.push(structuredClone(state));
  if (past.length > 60) past.shift();
  $('back').disabled = false;
}

// ---------------------------------------------------------------- preview

const frame = $('frame');
const preview = $('preview');
let pending = false;

function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    drawPreview();
  });
}

function drawPreview() {
  const [ow, oh] = outputSize();
  const aspect = ow / oh;
  const wide = window.matchMedia('(min-width: 960px)').matches;
  const availW = frame.clientWidth;
  const availH = wide ? window.innerHeight - frame.getBoundingClientRect().top - 110 : window.innerHeight * 0.62;
  let cssW = availW;
  let cssH = cssW / aspect;
  if (cssH > availH) {
    cssH = Math.max(200, availH);
    cssW = cssH * aspect;
  }
  preview.style.width = `${Math.round(cssW)}px`;
  preview.style.height = `${Math.round(cssH)}px`;

  // Per-pixel styles are costlier, so keep their preview a little lighter.
  let scale = dpr();
  const budget = PATTERNS_BY_ID[state.style].pixels ? 2.2e6 : 6e6;
  if (cssW * cssH * scale * scale > budget) scale = Math.sqrt(budget / (cssW * cssH));
  const pw = Math.max(1, Math.round(cssW * scale));
  const ph = Math.max(1, Math.round(cssH * scale));
  if (preview.width !== pw || preview.height !== ph) {
    preview.width = pw;
    preview.height = ph;
  }
  renderPattern(preview.getContext('2d'), state, pw, ph);
}

// ---------------------------------------------------------------- style thumbnails

const thumbs = new Map();

function buildStyles() {
  const root = $('styles');
  const groups = [['70s', '1970s'], ['geo', 'Bauhaus, geometric & op'], ['art', 'Art & abstract']];
  for (const [family, title] of groups) {
    const h = document.createElement('h3');
    h.textContent = title;
    root.append(h);
    const grid = document.createElement('div');
    grid.className = 'styles';
    for (const p of PATTERNS.filter((x) => x.family === family)) {
      const b = document.createElement('button');
      b.className = 'style';
      b.dataset.id = p.id;
      b.setAttribute('aria-pressed', 'false');
      const c = document.createElement('canvas');
      c.width = 132 * dpr();
      c.height = 88 * dpr();
      const label = document.createElement('span');
      label.textContent = p.name;
      b.append(c, label);
      b.addEventListener('click', () => {
        if (state.style === p.id) return;
        remember();
        state.style = p.id;
        commit();
      });
      grid.append(b);
      thumbs.set(p.id, c);
    }
    root.append(grid);
  }
}

let thumbKey = '';
function drawThumbs() {
  const key = state.colors.join();
  if (key === thumbKey) return;
  thumbKey = key;
  const ids = [...thumbs.keys()];
  const step = () => {
    if (thumbKey !== key) return; // palette changed again; a newer pass is running
    const id = ids.shift();
    if (!id) return;
    const c = thumbs.get(id);
    const t = PATTERNS_BY_ID[id].thumb || {};
    renderPattern(c.getContext('2d'), { style: id, seed: t.seed || 'groovy', colors: state.colors, scale: t.scale || 1.7, detail: 5, rotation: 0 }, c.width, c.height);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------- palettes & colours

let paletteTab = '';
let shownPalette = '';

function showPaletteGroup(group) {
  paletteTab = group;
  for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t.dataset.group === group));
  for (const b of document.querySelectorAll('.palette')) b.hidden = b.dataset.group !== group;
}

function buildPalettes() {
  const tabs = $('paletteTabs');
  for (const [group, title] of PALETTE_GROUPS) {
    const t = document.createElement('button');
    t.className = 'tab';
    t.dataset.group = group;
    t.setAttribute('role', 'tab');
    t.textContent = title;
    t.addEventListener('click', () => showPaletteGroup(group));
    tabs.append(t);
  }
  const root = $('palettes');
  for (const p of PALETTES) {
    const b = document.createElement('button');
    b.className = 'palette';
    b.dataset.id = p.id;
    b.dataset.group = p.group;
    b.title = p.name;
    b.setAttribute('aria-label', p.name);
    const strip = document.createElement('span');
    strip.className = 'strip';
    for (const c of p.colors) {
      const i = document.createElement('i');
      i.style.background = c;
      strip.append(i);
    }
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = p.name;
    b.append(strip, name);
    b.addEventListener('click', () => {
      remember();
      state.palette = p.id;
      state.colors = [...p.colors];
      commit();
    });
    root.append(b);
  }
}

function buildChips() {
  const root = $('chips');
  root.replaceChildren();
  state.colors.forEach((c, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    const input = document.createElement('input');
    input.type = 'color';
    input.value = c;
    input.title = i === 0 ? 'Background colour' : `Colour ${i + 1}`;
    input.setAttribute('aria-label', input.title);
    input.addEventListener('focus', () => remember(), { once: true });
    input.addEventListener('input', () => {
      state.colors[i] = input.value;
      state.palette = 'custom';
      commit({ chips: false });
    });
    chip.append(input);
    if (i === 0) {
      const tag = document.createElement('small');
      tag.textContent = 'bg';
      chip.append(tag);
    }
    if (state.colors.length > 2) {
      const x = document.createElement('button');
      x.className = 'remove';
      x.textContent = '×';
      x.title = 'Remove colour';
      x.setAttribute('aria-label', `Remove colour ${i + 1}`);
      x.addEventListener('click', () => {
        remember();
        state.colors.splice(i, 1);
        state.palette = 'custom';
        commit();
      });
      chip.append(x);
    }
    root.append(chip);
  });
  $('addColor').disabled = state.colors.length >= 8;
}

// ---------------------------------------------------------------- controls

function buildSizes() {
  const sel = $('size');
  for (const [id, label] of SIZES) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = label;
    sel.append(o);
  }
}

function syncControls({ chips = true } = {}) {
  for (const b of document.querySelectorAll('.style')) b.setAttribute('aria-pressed', String(b.dataset.id === state.style));
  for (const b of document.querySelectorAll('.palette')) b.setAttribute('aria-pressed', String(b.dataset.id === state.palette));
  // Follow the palette to its tab when it changes from elsewhere (surprise, back, a link).
  if (state.palette !== shownPalette) {
    shownPalette = state.palette;
    const group = PALETTES_BY_ID[state.palette]?.group;
    if (group && group !== paletteTab) showPaletteGroup(group);
    else if (!paletteTab) showPaletteGroup(PALETTE_GROUPS[0][0]);
  }
  if (chips) buildChips();
  $('seed').value = state.seed;
  for (const id of ['scale', 'detail', 'rotation']) {
    $(id).value = state[id];
    $(id).nextElementSibling.textContent = id === 'scale' ? `${Number(state[id]).toFixed(2)}×` : id === 'rotation' ? `${state[id]}°` : state[id];
  }
  $('size').value = SIZES.some(([id]) => id === state.size) ? state.size : 'custom';
  $('custom').hidden = state.size !== 'custom';
  const [w, h] = outputSize();
  if (state.size === 'custom') {
    if (document.activeElement !== $('cw')) $('cw').value = w;
    if (document.activeElement !== $('ch')) $('ch').value = h;
  }
  const mp = (w * h) / 1e6;
  $('hint').textContent = `${w.toLocaleString()} × ${h.toLocaleString()} px · ${mp.toFixed(1)} megapixels`;
}

function commit(opts) {
  history.replaceState(null, '', `#${toHash()}`);
  syncControls(opts);
  drawThumbs();
  schedule();
}

function newSeed() {
  remember();
  state.seed = randomSeed();
  commit();
}

function surprise() {
  remember();
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pal = rnd(PALETTES);
  state.style = rnd(PATTERNS).id;
  state.palette = pal.id;
  state.colors = [...pal.colors];
  state.seed = randomSeed();
  state.scale = Math.round((0.7 + Math.random() * 0.8) * 20) / 20;
  state.detail = 3 + Math.floor(Math.random() * 6);
  state.rotation = Math.random() < 0.2 ? Math.round((Math.random() - 0.5) * 60) : 0;
  commit();
}

function back() {
  const prev = past.pop();
  if (!prev) return;
  state = prev;
  $('back').disabled = past.length === 0;
  commit();
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

async function download() {
  const btn = $('download');
  const bar = $('progress');
  const [w, h] = outputSize();
  btn.disabled = true;
  btn.textContent = 'Rendering…';
  bar.hidden = false;
  bar.firstElementChild.style.width = '0%';
  const t0 = performance.now();
  try {
    const blob = await exportPNG(structuredClone(state), w, h, (p) => {
      bar.firstElementChild.style.width = `${Math.round(p * 100)}%`;
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `groovy-${state.style}-${state.seed}-${w}x${h}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    toast(`Saved ${w} × ${h} PNG (${(blob.size / 1e6).toFixed(1)} MB) in ${secs}s`);
  } catch (err) {
    console.error(err);
    toast(`Export failed: ${err.message || err}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download PNG';
    bar.hidden = true;
  }
}

function bind() {
  $('generate').addEventListener('click', newSeed);
  $('surprise').addEventListener('click', surprise);
  $('back').addEventListener('click', back);
  $('download').addEventListener('click', download);
  $('share').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied');
    } catch {
      toast('Copy the address bar to share this pattern');
    }
  });
  $('seed').addEventListener('change', () => {
    const v = $('seed').value.trim().slice(0, 24);
    if (!v || v === state.seed) return;
    remember();
    state.seed = v;
    commit();
  });
  for (const id of ['scale', 'detail', 'rotation']) {
    $(id).addEventListener('pointerdown', () => remember());
    $(id).addEventListener('input', () => {
      state[id] = Number($(id).value);
      commit({ chips: false });
    });
  }
  $('shuffle').addEventListener('click', () => {
    remember();
    const c = state.colors.slice();
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    state.colors = c;
    state.palette = 'custom';
    commit();
  });
  $('addColor').addEventListener('click', () => {
    if (state.colors.length >= 8) return;
    remember();
    const pool = PALETTES.flatMap((p) => p.colors).filter((c) => !state.colors.includes(c));
    state.colors.push(pool[Math.floor(Math.random() * pool.length)] || '#808080');
    state.palette = 'custom';
    commit();
  });
  $('size').addEventListener('change', () => {
    state.size = $('size').value;
    commit({ chips: false });
  });
  for (const id of ['cw', 'ch']) {
    $(id).addEventListener('change', () => {
      const w = clamp(Math.round(Number($('cw').value)) || 16, 16, MAX_SIDE);
      const h = clamp(Math.round(Number($('ch').value)) || 16, 16, MAX_SIDE);
      $('cw').value = w;
      $('ch').value = h;
      state.custom = `${w}x${h}`;
      commit({ chips: false });
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === ' ' && tag !== 'BUTTON') {
      e.preventDefault();
      newSeed();
    } else if (e.key === 'ArrowLeft') back();
    else if (e.key === 's' || e.key === 'S') surprise();
  });
  window.addEventListener('hashchange', () => {
    const s = fromHash();
    if (s && toHash() !== location.hash.slice(1)) {
      state = s;
      commit();
    }
  });
  new ResizeObserver(schedule).observe(frame);
}

buildStyles();
buildPalettes();
buildSizes();
bind();
commit();
