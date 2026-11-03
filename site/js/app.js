import {
  PATTERNS, PATTERNS_BY_ID, PALETTES, PALETTES_BY_ID, PALETTE_GROUPS, MAX_SIDE,
  renderPattern, exportPNG, randomSeed, inventPalette, paletteFromPixels,
} from './core.js?v=8';

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

// First visits open on one of these hand-picked pairings.
const FEATURED = [
  ['waves', 'harvest', 'groovy'], ['composition', 'kandinsky', 'b'], ['sunrise', 'rainbow73', 'd'],
  ['bulge', 'psych', 'vega'], ['cutouts', 'cutouts', 'a'], ['destijl', 'destijl', 'b'],
  ['colorstudy', 'kandinsky', 'a'], ['ogee', 'sunset', 'k'], ['drops', 'avocado', 'k'],
  ['atomic', 'midcentury', 'a'], ['oplines', 'opart', 'riley'], ['liquid', 'disco', 'groovy'],
];

// Palette groups that suit each family, for "Surprise me".
const AFFINITY = { '70s': ['70s', '70s', 'pop', 'soft'], geo: ['art', 'pop', '70s', 'soft'], art: ['art', 'art', 'soft', '70s'] };
const OP_STYLES = new Set(['opsquares', 'oplines', 'bulge', 'chevron']);

function featured() {
  const [style, palette, seed] = FEATURED[Math.floor(Math.random() * FEATURED.length)];
  return { ...DEFAULTS, style, palette, seed, colors: [...PALETTES_BY_ID[palette].colors] };
}

let state = fromHash() || featured();
const past = [];

function fromHash() {
  return parseState(location.hash.slice(1));
}

function parseState(str) {
  const q = new URLSearchParams(str);
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
  // Leave room for whatever sits under the preview (buttons, notes, variations).
  const below = $('stage').getBoundingClientRect().bottom - frame.getBoundingClientRect().bottom;
  const availH = wide ? window.innerHeight - frame.getBoundingClientRect().top - below - 20 : window.innerHeight * 0.62;
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
  if (!varPending) {
    varPending = true;
    requestAnimationFrame(() => {
      varPending = false;
      drawVariations();
    });
  }
}

// ---------------------------------------------------------------- variations
// Six other seeds of the current style and colours. Picking one swaps it with
// the current seed, so the previous pattern stays one click away.

let varSeeds = Array.from({ length: 6 }, randomSeed);
let varPending = false;

function buildVariations() {
  const root = $('variations');
  varSeeds.forEach((_, k) => {
    const b = document.createElement('button');
    b.className = 'variation';
    b.title = 'Use this variation';
    b.setAttribute('aria-label', `Variation ${k + 1}`);
    b.append(document.createElement('canvas'));
    b.addEventListener('click', () => {
      remember();
      [state.seed, varSeeds[k]] = [varSeeds[k], state.seed];
      commit();
    });
    root.append(b);
  });
  $('moreVars').addEventListener('click', () => {
    varSeeds = varSeeds.map(randomSeed);
    drawVariations();
  });
}

function drawVariations() {
  const [ow, oh] = outputSize();
  const aspect = ow / oh;
  const h = 84 * dpr();
  const w = Math.min(200 * dpr(), h * aspect);
  for (const [k, b] of [...$('variations').children].entries()) {
    const c = b.firstChild;
    const cw = Math.round(w);
    const ch = Math.round(w / aspect);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    renderPattern(c.getContext('2d'), { ...state, seed: varSeeds[k] }, cw, ch);
  }
}

// ---------------------------------------------------------------- style thumbnails

const thumbs = new Map();
const FAMILIES = [['70s', '1970s'], ['geo', 'Bauhaus, geometric & op'], ['art', 'Art & abstract']];
// Styles in the order the picker shows them, for [ and ].
const ORDER = FAMILIES.flatMap(([family]) => PATTERNS.filter((p) => p.family === family).map((p) => p.id));

function buildStyles() {
  const root = $('styles');
  for (const [family, title] of FAMILIES) {
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
  // Draw as many thumbnails as fit in ~10 ms per frame, so the page stays responsive.
  const step = () => {
    if (thumbKey !== key) return; // palette changed again; a newer pass is running
    const t0 = performance.now();
    while (ids.length && performance.now() - t0 < 10) {
      const id = ids.shift();
      const c = thumbs.get(id);
      const t = PATTERNS_BY_ID[id].thumb || {};
      renderPattern(c.getContext('2d'), { style: id, seed: t.seed || 'groovy', colors: state.colors, scale: t.scale || 1.7, detail: 5, rotation: 0 }, c.width, c.height);
    }
    if (ids.length) requestAnimationFrame(step);
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
    b.title = `${p.name} · ${p.colors.join(' ')}`;
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
    input.title = `${i === 0 ? 'Background' : `Colour ${i + 1}`} · ${c}`;
    input.setAttribute('aria-label', input.title);
    input.addEventListener('focus', () => remember(), { once: true });
    input.addEventListener('input', () => {
      state.colors[i] = input.value;
      input.title = `${i === 0 ? 'Background' : `Colour ${i + 1}`} · ${input.value}`;
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
  const gen = PATTERNS_BY_ID[state.style];
  $('aboutName').textContent = gen.name;
  $('aboutText').textContent = gen.about;
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

// ---------------------------------------------------------------- saved patterns
// A per-browser shelf of favourites. Storage can be unavailable (private
// windows, blocked site data), so every access is guarded and the page works without it.

const SAVED_KEY = 'gpm.saved.v1';
const MAX_SAVED = 36;

function loadSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function storeSaved(list) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function savePattern() {
  const key = toHash();
  const list = loadSaved().filter((k) => k !== key);
  list.unshift(key);
  if (!storeSaved(list.slice(0, MAX_SAVED))) {
    toast('This browser is not letting the page save. Copy the link instead.');
    return;
  }
  buildSaved();
  toast('Saved to your shelf');
}

function buildSaved() {
  const list = loadSaved();
  const root = $('saved');
  $('savedCard').hidden = list.length === 0;
  root.replaceChildren();
  for (const key of list) {
    const s = parseState(key);
    if (!s) continue;
    const item = document.createElement('div');
    item.className = 'saved-item';
    const b = document.createElement('button');
    b.className = 'saved-open';
    b.title = `${PATTERNS_BY_ID[s.style].name} · ${s.seed}`;
    b.setAttribute('aria-label', `Open saved ${b.title}`);
    const c = document.createElement('canvas');
    c.width = 96 * dpr();
    c.height = 64 * dpr();
    b.append(c);
    b.addEventListener('click', () => {
      remember();
      state = s;
      commit();
    });
    const x = document.createElement('button');
    x.className = 'remove';
    x.textContent = '×';
    x.title = 'Remove from shelf';
    x.setAttribute('aria-label', `Remove ${b.title}`);
    x.addEventListener('click', () => {
      storeSaved(loadSaved().filter((k) => k !== key));
      buildSaved();
    });
    item.append(b, x);
    root.append(item);
    renderPattern(c.getContext('2d'), s, c.width, c.height);
  }
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
  varSeeds = varSeeds.map(randomSeed);
  commit();
}

function surprise() {
  remember();
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const gen = rnd(PATTERNS);
  state.style = gen.id;
  if (Math.random() < 0.2) {
    state.palette = 'custom';
    state.colors = inventPalette();
  } else {
    // Lean toward palettes that suit the style: op art loves black and white.
    const op = OP_STYLES.has(gen.id) && Math.random() < 0.35;
    const group = rnd(AFFINITY[gen.family]);
    const pool = op ? PALETTES.filter((p) => ['opart', 'opred', 'cyanotype'].includes(p.id)) : PALETTES.filter((p) => p.group === group);
    const pal = rnd(pool);
    state.palette = pal.id;
    state.colors = [...pal.colors];
  }
  state.seed = randomSeed();
  state.scale = Math.round((0.7 + Math.random() * 0.8) * 20) / 20;
  state.detail = 3 + Math.floor(Math.random() * 6);
  state.rotation = Math.random() < 0.2 ? Math.round((Math.random() - 0.5) * 60) : 0;
  commit();
}

// Swap the ground with the ink that contrasts with it most: a night version of a
// day palette, or the other way round.
function flipGround() {
  const c = state.colors;
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  };
  let best = 1;
  for (let i = 2; i < c.length; i++) if (Math.abs(lum(c[i]) - lum(c[0])) > Math.abs(lum(c[best]) - lum(c[0]))) best = i;
  remember();
  state.colors = c.slice();
  [state.colors[0], state.colors[best]] = [state.colors[best], state.colors[0]];
  state.palette = 'custom';
  commit();
}

// Take a palette from a picture. It is read and shrunk locally; nothing is uploaded.
async function paletteFromImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k));
    const h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0, w, h);
    const colors = paletteFromPixels(g.getImageData(0, 0, w, h).data);
    if (!colors) throw new Error('no colours found');
    remember();
    state.colors = colors;
    state.palette = 'custom';
    commit();
    toast('Palette taken from your image (it never left this browser)');
  } catch (err) {
    console.error(err);
    toast('Could not read colours from that image');
  }
}

function invent() {
  remember();
  state.palette = 'custom';
  state.colors = inventPalette();
  commit();
}

function stepStyle(dir) {
  const i = ORDER.indexOf(state.style);
  remember();
  state.style = ORDER[(i + dir + ORDER.length) % ORDER.length];
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
  $('invent').addEventListener('click', invent);
  $('flip').addEventListener('click', flipGround);
  $('copyHex').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.colors.join(' '));
      toast('Colours copied');
    } catch {
      toast(state.colors.join(' '));
    }
  });
  $('fromImage').addEventListener('click', () => $('imageFile').click());
  $('imageFile').addEventListener('change', async () => {
    await paletteFromImage($('imageFile').files[0]);
    $('imageFile').value = '';
  });
  // Drop a picture anywhere on the page to take its colours.
  window.addEventListener('dragover', (e) => {
    if ([...e.dataTransfer.items].some((i) => i.type.startsWith('image/'))) e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    paletteFromImage(file);
  });
  $('save').addEventListener('click', savePattern);
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
    else if (e.key === 'p' || e.key === 'P') invent();
    else if (e.key === ']') stepStyle(1);
    else if (e.key === '[') stepStyle(-1);
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
buildSaved();
buildVariations();
bind();
commit();
