// POE2 Filter Studio — app.js (UI layer)
// State: one FilterDoc + filename + dirty flag + selections. See CONTRACT.md.

import { parseFilter, serializeFilter, createRule, describeConditions, validateDoc } from './engine.js';
import { CATALOG, ALERT_COLORS, MINIMAP_SHAPES, SOUNDS } from './catalog.js';
import { playAlertPreview } from './sounds.js';

const LS_KEY = 'poe2-filter-studio.v1';
const NAME_RE = /^[A-Za-z0-9 _.-]+\.filter$/i;

const SHAPE_GLYPHS = {
  Circle: '●',        // ●
  Diamond: '◆',       // ◆
  Hexagon: '⬢',       // ⬢
  Square: '■',        // ■
  Star: '★',          // ★
  Triangle: '▲',      // ▲
  Cross: '✚',         // ✚
  Moon: '☾',          // ☾
  Raindrop: '⬮',      // ⬮ (ellipse stand-in)
  Kite: '◈',          // ◈
  Pentagon: '⬟',      // ⬟
  UpsideDownHouse: '⌂', // ⌂ (approximation)
};

// Crisp inline-SVG shape set (16x16, filled via currentColor) — used in rule-card
// indicator pills, the style-editor swatch, and the live preview. The #mi-shape
// <select> keeps the unicode glyphs above (options can't hold SVG).
const SHAPE_SVGS = {
  Circle: '<circle cx="8" cy="8" r="6"/>',
  Diamond: '<polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/>',
  Hexagon: '<polygon points="8,1.2 13.9,4.6 13.9,11.4 8,14.8 2.1,11.4 2.1,4.6"/>',
  Square: '<rect x="2.5" y="2.5" width="11" height="11"/>',
  Star: '<polygon points="8,1 9.9,5.4 14.7,5.8 11,9 12.1,13.7 8,11.2 3.9,13.7 5,9 1.3,5.8 6.1,5.4"/>',
  Triangle: '<polygon points="8,2 14.5,13.5 1.5,13.5"/>',
  Cross: '<path d="M6.2 1.5h3.6v4.7h4.7v3.6H9.8v4.7H6.2V9.8H1.5V6.2h4.7z"/>',
  Moon: '<path d="M14 8.53A6 6 0 1 1 7.47 2 4.67 4.67 0 0 0 14 8.53z"/>',
  Raindrop: '<path d="M8 1.3c2.8 3.7 4.7 6.3 4.7 8.7a4.7 4.7 0 1 1-9.4 0C3.3 7.6 5.2 5 8 1.3z"/>',
  Kite: '<polygon points="8,1 13,6.5 8,15 3,6.5"/>',
  Pentagon: '<polygon points="8,1.4 14.7,6.2 12.1,14.1 3.9,14.1 1.3,6.2"/>',
  UpsideDownHouse: '<polygon points="2.5,2.5 13.5,2.5 13.5,9 8,14.5 2.5,9"/>',
};

function shapeSvg(shape) {
  const s = document.createElement('span');
  s.className = 'shape-svg';
  s.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${SHAPE_SVGS[shape] || SHAPE_SVGS.Circle}</svg>`;
  return s;
}

// ---- item icons (public/img/manifest.json — see CONTRACT.md "Item images") ---
// The manifest is optional: missing file, missing key, offline, or a dead URL
// all degrade to the glyph fallbacks with zero console errors.

const ICONS = { baseTypes: {}, classes: {}, specials: {} };

async function loadIconManifest() {
  try {
    const res = await fetch('img/manifest.json');
    if (!res.ok) return; // no manifest yet — glyph fallbacks everywhere
    const data = await res.json();
    if (!data || typeof data !== 'object') return;
    ICONS.baseTypes = data.baseTypes || {};
    ICONS.classes = data.classes || {};
    ICONS.specials = data.specials || {};
    renderCatalog();
    renderRules();
    renderPanel();
  } catch { /* offline / malformed — glyph fallbacks */ }
}

// Catalog entry: baseTypes[entry.baseTypes[0]] → specials[entry.id] → classes[...]
function entryIconUrl(e) {
  if (e.baseTypes && e.baseTypes.length && ICONS.baseTypes[e.baseTypes[0]]) return ICONS.baseTypes[e.baseTypes[0]];
  if (ICONS.specials[e.id]) return ICONS.specials[e.id];
  const cls = e.class ?? (e.classes && e.classes[0]);
  if (cls && ICONS.classes[cls]) return ICONS.classes[cls];
  return null;
}

// Rule: first BaseType condition value found in baseTypes → first Class value in classes → none
function ruleIconUrl(rule) {
  for (const c of rule.conditions) {
    if (c.type === 'BaseType' && c.values) {
      for (const v of c.values) if (ICONS.baseTypes[v]) return ICONS.baseTypes[v];
    }
  }
  for (const c of rule.conditions) {
    if (c.type === 'Class' && c.values) {
      for (const v of c.values) if (ICONS.classes[v]) return ICONS.classes[v];
    }
  }
  return null;
}

// Fixed-size <img> that removes itself (or runs onFail) on a dead URL —
// never a broken-image icon, never a layout shift.
function iconImg(url, onFail) {
  const img = h('img', { class: 'icon-img', src: url, alt: '', loading: 'lazy', draggable: 'false' });
  img.addEventListener('error', onFail);
  return img;
}

const KIND_GLYPHS = { basetype: '◆', class: '▤', special: '✦' };

// Presets wired from John's filter conventions (test/fixtures/John-T1-Monk.filter).
const PRESETS = [
  { key: 'jackpot', label: 'Jackpot', action: 'Show', style: {
    fontSize: 45, textColor: [255, 0, 0, 255], borderColor: [255, 0, 0, 255],
    backgroundColor: [255, 255, 255, 255],
    minimapIcon: { size: 0, color: 'Red', shape: 'Star' },
    playEffect: { color: 'Red', temp: false },
    alertSound: { id: 6, volume: 300 }, raw: [] } },
  { key: 'high', label: 'High', action: 'Show', style: {
    fontSize: 44, textColor: [255, 255, 255, 255], borderColor: [255, 255, 255, 255],
    backgroundColor: [240, 80, 70, 255],
    minimapIcon: { size: 0, color: 'Red', shape: 'Circle' },
    playEffect: { color: 'Red', temp: false },
    alertSound: { id: 1, volume: 300 }, raw: [] } },
  { key: 'mid', label: 'Mid', action: 'Show', style: {
    fontSize: 40, textColor: [25, 15, 0, 255], borderColor: [200, 120, 40, 255],
    backgroundColor: [245, 160, 90, 255],
    minimapIcon: { size: 1, color: 'Yellow', shape: 'Circle' },
    playEffect: { color: 'Yellow', temp: false },
    alertSound: { id: 2, volume: 300 }, raw: [] } },
  { key: 'quiet', label: 'Quiet', action: 'Show', style: {
    fontSize: 32, textColor: [200, 200, 150, 255], borderColor: [100, 100, 70, 255],
    backgroundColor: null, minimapIcon: null, playEffect: null, alertSound: null, raw: [] } },
  { key: 'hidden', label: 'Hidden', action: 'Hide', style: {
    fontSize: null, textColor: null, borderColor: null, backgroundColor: null,
    minimapIcon: null, playEffect: null, alertSound: null, raw: [] } },
];

function defaultPendingStyle() {
  return {
    fontSize: 38,
    textColor: [255, 255, 255, 255],
    borderColor: [255, 255, 255, 255],
    backgroundColor: [0, 0, 0, 220],
    minimapIcon: null,
    playEffect: null,
    alertSound: null,
    raw: [],
  };
}

const state = {
  doc: { header: [], rules: [] },
  filename: null,
  dirty: false,
  parseWarnings: [],
  warnings: [],
  selection: new Set(),   // rule ids
  anchorId: null,         // shift-click anchor
  catalogSel: new Set(),  // catalog entry ids
  catalogQuery: '',
  expanded: new Set(['currency']),
  pending: { action: 'Show', style: defaultPendingStyle() },
};

let dragId = null;
let dropIndex = null;

// ---- tiny DOM helpers -------------------------------------------------------

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return n;
}

// ---- color utils --------------------------------------------------------------

const rgbaCss = (c) => `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
const hex2 = (n) => n.toString(16).padStart(2, '0');
const rgbToHex = (c) => '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
const hexToRgb = (hx) => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
function alertCss(name) {
  const c = ALERT_COLORS[name] || [200, 200, 200];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function clampInt(v, lo, hi, dflt) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

// ---- selection / target helpers ---------------------------------------------

function selectedRules() {
  return state.doc.rules.filter((r) => state.selection.has(r.id));
}

// What the style panel is editing: first selected rule, or the pending style.
function panelTarget() {
  const sel = selectedRules();
  if (sel.length) return { action: sel[0].action, style: sel[0].style, rule: sel[0], count: sel.length };
  return { action: state.pending.action, style: state.pending.style, rule: null, count: 0 };
}

function previewText(rule) {
  for (const c of rule.conditions) if (c.type === 'BaseType' && c.values.length) return c.values[0];
  for (const c of rule.conditions) if (c.type === 'Class' && c.values.length) return c.values[0];
  const rar = rule.conditions.find((c) => c.type === 'Rarity');
  if (rar) return rar.values.join('/') + ' item';
  return rule.name || 'Item';
}

// Label chip CSS from a Style. Game fontSize 1-45 → px scaled /div, min 9px.
function chipCss(style, div) {
  const fs = style.fontSize ?? 32;
  const px = Math.max(9, Math.round(fs / div));
  return [
    `font-size:${px}px`,
    `color:${style.textColor ? rgbaCss(style.textColor) : '#c8c8c8'}`,
    `background:${style.backgroundColor ? rgbaCss(style.backgroundColor) : 'rgba(0,0,0,0.62)'}`,
    `border:1px solid ${style.borderColor ? rgbaCss(style.borderColor) : 'transparent'}`,
  ].join(';');
}

// ---- persistence ----------------------------------------------------------------

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      doc: state.doc,
      filename: state.filename,
      dirty: state.dirty,
      pending: state.pending,
    }));
  } catch { /* storage full/blocked — non-fatal */ }
}

function restore() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d.doc || !Array.isArray(d.doc.rules) || !Array.isArray(d.doc.header)) return false;
    state.doc = d.doc;
    // remap ids so restored rules can never collide with fresh engine ids ('rN')
    state.doc.rules.forEach((r, i) => { r.id = 'ls' + i; });
    state.filename = d.filename ?? null;
    state.dirty = !!d.dirty;
    if (d.pending && d.pending.style) state.pending = d.pending;
    return true;
  } catch {
    return false;
  }
}

// ---- doc lifecycle ---------------------------------------------------------------

function newDoc(silent = false) {
  if (!silent && state.dirty && !confirm('Discard unsaved changes and start a new filter?')) return;
  const date = new Date().toISOString().slice(0, 10);
  state.doc = {
    header: ['# New filter', '# generated by POE2 Filter Studio', `# ${date}`],
    rules: [createRule({ name: 'Catch-all (everything else)' })],
  };
  state.filename = null;
  state.dirty = false;
  state.parseWarnings = [];
  state.selection.clear();
  state.anchorId = null;
  refresh();
}

function touch() {
  state.dirty = true;
  refresh();
}

function refresh() {
  // prune selection of rules that no longer exist
  const ids = new Set(state.doc.rules.map((r) => r.id));
  state.selection = new Set([...state.selection].filter((id) => ids.has(id)));
  state.warnings = validateDoc(state.doc);
  persist();
  renderTopbar();
  renderRules();
  renderPanel();
  renderWarnings();
}

// ---- toasts ---------------------------------------------------------------------

function toast(msg, kind = 'ok') {
  const t = h('div', { class: 'toast ' + kind }, msg);
  $('#toasts').append(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 350);
  }, 3800);
}

// ---- server ops -------------------------------------------------------------------

async function refreshFilterList() {
  try {
    const res = await fetch('/api/filters');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.dir) $('#topbar .brand').title = 'Filter folder: ' + data.dir;
    const sel = $('#filter-select');
    const prev = sel.value;
    sel.textContent = '';
    for (const f of data.files.sort((a, b) => a.name.localeCompare(b.name))) {
      sel.append(h('option', { value: f.name }, f.name));
    }
    if (prev && data.files.some((f) => f.name === prev)) sel.value = prev;
    else if (state.filename && data.files.some((f) => f.name === state.filename)) sel.value = state.filename;
  } catch (err) {
    toast('Could not list filters: ' + err.message, 'error');
  }
}

async function loadSelected() {
  const name = $('#filter-select').value;
  if (!name) { toast('No filter selected in the dropdown', 'error'); return; }
  if (state.dirty && !confirm(`Discard unsaved changes and load "${name}"?`)) return;
  try {
    const res = await fetch('/api/filter?name=' + encodeURIComponent(name));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const parsed = parseFilter(text);
    state.doc = { header: parsed.header, rules: parsed.rules };
    state.parseWarnings = parsed.warnings;
    state.filename = name;
    state.dirty = false;
    state.selection.clear();
    state.anchorId = null;
    refresh();
    $('#rules-pane').scrollTop = 0;
    toast(`Loaded ${name} · ${parsed.rules.length} rules`);
    if (parsed.warnings.length) toast(`${parsed.warnings.length} parse warning(s) — see ⚠`, 'error');
  } catch (err) {
    toast('Load failed: ' + err.message, 'error');
  }
}

async function doSave(name) {
  try {
    const text = serializeFilter(state.doc);
    const res = await fetch('/api/filter?name=' + encodeURIComponent(name), { method: 'POST', body: text });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'HTTP ' + res.status);
    state.filename = name;
    state.dirty = false;
    refresh();
    toast(data.backedUp ? `Saved · backup ${data.backedUp}` : `Saved ${name} (new file)`);
    refreshFilterList();
  } catch (err) {
    toast('Save failed: ' + err.message, 'error');
  }
}

function saveCurrent() {
  if (state.filename) doSave(state.filename);
  else openNamePrompt();
}

function openNamePrompt() {
  const p = $('#name-prompt');
  const inp = $('#name-input');
  if (!p.hidden) { inp.focus(); return; }  // don't wipe a name mid-typing
  p.hidden = false;
  inp.value = state.filename || '';
  inp.focus();
  inp.select();
}

function closeNamePrompt() {
  $('#name-prompt').hidden = true;
}

function confirmNamePrompt() {
  let name = $('#name-input').value.trim();
  if (!name) return;
  if (!/\.filter$/i.test(name)) name += '.filter';
  if (!NAME_RE.test(name)) {
    toast('Invalid name — letters, digits, spaces, _ . - only', 'error');
    return;
  }
  const exists = [...$('#filter-select').options].some((o) => o.value.toLowerCase() === name.toLowerCase());
  if (exists && name.toLowerCase() !== (state.filename || '').toLowerCase()) {
    if (!confirm(`${name} already exists — overwrite it? (a backup is made)`)) return;
  }
  closeNamePrompt();
  doSave(name);
}

function exportFilter() {
  const text = serializeFilter(state.doc);
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = state.filename || 'untitled.filter';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Exported ' + a.download);
}

// ---- top bar / warnings drawer ------------------------------------------------------

function renderTopbar() {
  $('#dirty-dot').hidden = !state.dirty;
  $('#tb-file').textContent = state.filename || 'unsaved filter';
}

function renderWarnings() {
  const n = state.warnings.length;
  $('#warn-count').textContent = n;
  $('#btn-warn').classList.toggle('has', n > 0);
  const d = $('#warn-drawer');
  d.textContent = '';
  d.append(h('div', { class: 'drawer-title' }, `Validation warnings (${n})`));
  if (!n) d.append(h('div', { class: 'drawer-empty' }, 'No validation warnings.'));
  for (const w of state.warnings) d.append(h('div', { class: 'drawer-item' }, w));
  if (state.parseWarnings.length) {
    d.append(h('div', { class: 'drawer-title' }, `Parse warnings — last load (${state.parseWarnings.length})`));
    for (const w of state.parseWarnings) d.append(h('div', { class: 'drawer-item' }, w));
  }
}

// ---- catalog pane -------------------------------------------------------------------

function entryMatches(e, q) {
  if (e.label.toLowerCase().includes(q)) return true;
  if (e.baseTypes && e.baseTypes.some((b) => b.toLowerCase().includes(q))) return true;
  if (e.classes && e.classes.some((c) => c.toLowerCase().includes(q))) return true;
  if (e.class && e.class.toLowerCase().includes(q)) return true;
  return false;
}

function entryTitle(e) {
  if (e.kind === 'class') return 'Class: ' + e.classes.join(', ');
  if (e.kind === 'basetype') return e.baseTypes.join(', ');
  return describeConditions({ conditions: e.conditions });
}

function toggleEntry(id, on) {
  if (on) state.catalogSel.add(id);
  else state.catalogSel.delete(id);
  renderCatalog();
}

function renderCatalog() {
  const list = $('#catalog-list');
  const q = state.catalogQuery.trim().toLowerCase();
  list.textContent = '';

  for (const g of CATALOG) {
    const visible = q ? g.entries.filter((e) => entryMatches(e, q)) : g.entries;
    if (q && visible.length === 0) continue;
    const open = q ? true : state.expanded.has(g.id);
    const selCount = g.entries.filter((e) => state.catalogSel.has(e.id)).length;

    const cb = h('input', { type: 'checkbox', title: 'Select whole group' });
    cb.checked = visible.length > 0 && visible.every((e) => state.catalogSel.has(e.id));
    cb.indeterminate = !cb.checked && visible.some((e) => state.catalogSel.has(e.id));
    cb.addEventListener('click', (ev) => ev.stopPropagation());
    cb.addEventListener('change', () => {
      for (const e of visible) {
        if (cb.checked) state.catalogSel.add(e.id);
        else state.catalogSel.delete(e.id);
      }
      renderCatalog();
    });

    list.append(h('div', {
      class: 'cat-group-head',
      onclick: () => {
        if (state.expanded.has(g.id)) state.expanded.delete(g.id);
        else state.expanded.add(g.id);
        renderCatalog();
      },
    },
      h('span', { class: 'cat-caret' }, open ? '▾' : '▸'),
      cb,
      h('span', { class: 'cat-group-label' }, g.label),
      h('span', { class: 'cat-group-count' }, selCount ? `${selCount}/${g.entries.length}` : `${g.entries.length}`),
    ));

    if (!open) continue;
    for (const e of visible) {
      const checked = state.catalogSel.has(e.id);
      const ecb = h('input', { type: 'checkbox' });
      ecb.checked = checked;
      ecb.addEventListener('change', () => toggleEntry(e.id, ecb.checked));
      const iconBox = h('span', { class: 'cat-icon' },
        h('span', { class: 'icon-glyph' }, KIND_GLYPHS[e.kind] || '◆'));
      const iconUrl = entryIconUrl(e);
      if (iconUrl) {
        const img = iconImg(iconUrl, () => img.remove()); // dead URL → glyph shows through
        iconBox.append(img);
      }
      list.append(h('div', {
        class: 'cat-entry' + (checked ? ' checked' : ''),
        title: entryTitle(e),
        onclick: (ev) => {
          if (ev.target === ecb) return;
          toggleEntry(e.id, !state.catalogSel.has(e.id));
        },
      },
        ecb,
        iconBox,
        h('span', { class: 'cat-entry-label' }, e.label),
        e.kind === 'class' ? h('span', { class: 'cat-kind' }, 'class') : null,
        e.kind === 'special' ? h('span', { class: 'cat-kind' }, '✦') : null,
      ));
    }
  }

  if (!list.children.length) list.append(h('div', { class: 'cat-empty' }, 'No matches'));
  renderCatalogFooter();
}

function renderCatalogFooter() {
  const n = state.catalogSel.size;
  $('#catalog-count').textContent = `${n} selected`;
  $('#btn-add-rules').disabled = n === 0;
}

// ---- selection → rules bucketing (per CONTRACT.md) -----------------------------------

function buildRulesFromSelection() {
  const selected = state.catalogSel;
  const consumed = new Set();

  // fully-checked group whose entries all share one class → single Class rule
  const groupRules = [];
  for (const g of CATALOG) {
    if (!g.entries.length || !g.entries.every((e) => selected.has(e.id))) continue;
    const classes = new Set();
    let uniform = true;
    for (const e of g.entries) {
      if (e.kind === 'class' && e.classes && e.classes.length === 1) classes.add(e.classes[0]);
      else if (e.kind === 'basetype' && e.class) classes.add(e.class);
      else { uniform = false; break; }
    }
    if (uniform && classes.size === 1) {
      groupRules.push(createRule({
        name: `All ${g.label}`,
        conditions: [{ type: 'Class', op: '==', values: [...classes] }],
      }));
      for (const e of g.entries) consumed.add(e.id);
    }
  }

  const rest = [];
  for (const g of CATALOG) {
    for (const e of g.entries) {
      if (selected.has(e.id) && !consumed.has(e.id)) rest.push(e);
    }
  }

  // kind:'class' entries → one rule with Class == all those classes
  const classRules = [];
  const classEntries = rest.filter((e) => e.kind === 'class');
  if (classEntries.length) {
    const classes = [...new Set(classEntries.flatMap((e) => e.classes))];
    classRules.push(createRule({
      name: classEntries.length === 1 ? classEntries[0].label : classes.join(' + '),
      conditions: [{ type: 'Class', op: '==', values: classes }],
    }));
  }

  // kind:'basetype' entries → one rule per class: Class== + BaseType==
  const baseRules = [];
  const byClass = new Map();
  for (const e of rest) {
    if (e.kind !== 'basetype') continue;
    if (!byClass.has(e.class)) byClass.set(e.class, []);
    byClass.get(e.class).push(e);
  }
  for (const [cls, entries] of byClass) {
    const bases = [...new Set(entries.flatMap((e) => e.baseTypes))];
    let name = entries.length === 1 ? entries[0].label : `${cls}: ${entries.map((e) => e.label).join(', ')}`;
    if (name.length > 64) name = name.slice(0, 61) + '…';
    baseRules.push(createRule({
      name,
      conditions: [
        { type: 'Class', op: '==', values: [cls] },
        { type: 'BaseType', op: '==', values: bases },
      ],
    }));
  }

  // kind:'special' entries → one rule each from the condition template
  const specialRules = [];
  for (const e of rest) {
    if (e.kind !== 'special') continue;
    specialRules.push(createRule({ name: e.label, conditions: structuredClone(e.conditions) }));
  }

  // specific rules before broad class rules — first match wins, so a class
  // catch-all above its own basetypes/specials would dead-rule them
  return [...baseRules, ...specialRules, ...classRules, ...groupRules];
}

function addRulesForSelection() {
  const rules = buildRulesFromSelection();
  if (!rules.length) { toast('Nothing selected in the catalog', 'error'); return; }
  const src = panelTarget();
  for (const r of rules) {
    r.action = src.action;
    r.style = { ...structuredClone(src.style), raw: [] };
  }
  state.doc.rules.unshift(...rules);
  state.selection = new Set(rules.map((r) => r.id));
  state.anchorId = rules[0].id;
  touch();
  $('#rules-pane').scrollTop = 0;
  toast(`Added ${rules.length} rule(s) at the top`);
}

// ---- rules pane ------------------------------------------------------------------------

function handleCardClick(id, ev) {
  if (ev.target.closest('button, input, select')) return;
  const sel = state.selection;
  if (ev.shiftKey && state.anchorId) {
    const ids = state.doc.rules.map((r) => r.id);
    const a = ids.indexOf(state.anchorId);
    const b = ids.indexOf(id);
    if (a !== -1 && b !== -1) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      state.selection = new Set(ids.slice(lo, hi + 1));
    }
  } else if (ev.ctrlKey || ev.metaKey) {
    if (sel.has(id)) sel.delete(id);
    else sel.add(id);
    state.anchorId = id;
  } else {
    state.selection = new Set([id]);
    state.anchorId = id;
  }
  renderRules();
  renderPanel();
}

function beginRename(rule, span) {
  const input = h('input', { class: 'rule-name-input', value: rule.name });
  span.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    if (save && input.value.trim() !== rule.name) { rule.name = input.value.trim(); touch(); }
    else renderRules();
  };
  input.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') finish(true);
    else if (ev.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', (ev) => ev.stopPropagation());
}

function moveRule(from, to) {
  const rules = state.doc.rules;
  if (to < 0 || to >= rules.length) return;
  const [r] = rules.splice(from, 1);
  rules.splice(to, 0, r);
  touch();
}

function duplicateRule(rule) {
  const idx = state.doc.rules.indexOf(rule);
  const copy = structuredClone(rule);
  delete copy.id;
  const fresh = createRule(copy);
  if (fresh.name) fresh.name += ' (copy)';
  state.doc.rules.splice(idx + 1, 0, fresh);
  state.selection = new Set([fresh.id]);
  state.anchorId = fresh.id;
  touch();
}

function deleteRule(rule) {
  state.doc.rules = state.doc.rules.filter((r) => r !== rule);
  state.selection.delete(rule.id);
  touch();
}

function deleteSelected() {
  const sel = selectedRules();
  if (!sel.length) return;
  if (sel.length > 1 && !confirm(`Delete ${sel.length} rules?`)) return;
  state.doc.rules = state.doc.rules.filter((r) => !state.selection.has(r.id));
  state.selection.clear();
  touch();
}

function clearDropMarks() {
  $$('.rule-card.drop-before, .rule-card.drop-after').forEach((c) => {
    c.classList.remove('drop-before', 'drop-after');
  });
}

function ruleCard(rule, i, n) {
  const s = rule.style;

  const grip = h('span', { class: 'rule-grip', title: 'Drag to reorder' }, '⡇⡇');

  const nameSpan = h('span', {
    class: 'rule-name' + (rule.name ? '' : ' unnamed'),
    title: 'Click to rename',
  }, rule.name || 'unnamed');
  nameSpan.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!state.selection.has(rule.id)) {
      state.selection = new Set([rule.id]);
      state.anchorId = rule.id;
      renderRules();
      renderPanel();
    }
    const span = $(`.rule-card[data-id="${rule.id}"] .rule-name`);
    if (span) beginRename(rule, span);
  });

  const btn = (label, title, fn, disabled = false) => {
    const b = h('button', { class: 'icon-btn', title, disabled });
    b.append(label);
    b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); });
    return b;
  };

  const controls = h('span', { class: 'rule-btns' },
    btn(rule.enabled ? 'On' : 'Off', rule.enabled ? 'Disable rule (kept in file, commented out)' : 'Enable rule',
      () => { rule.enabled = !rule.enabled; touch(); }),
    btn('⧉', 'Duplicate rule', () => duplicateRule(rule)),
    btn('↑', 'Move up', () => moveRule(i, i - 1), i === 0),
    btn('↓', 'Move down', () => moveRule(i, i + 1), i === n - 1),
    btn('✕', 'Delete rule', () => deleteRule(rule)),
  );

  const inds = h('span', { class: 'rule-inds' });
  if (s.minimapIcon) {
    const mi = s.minimapIcon;
    inds.append(h('span', {
      class: `ind ind-icon s${mi.size}`,
      title: `MinimapIcon ${mi.size} ${mi.color} ${mi.shape}`,
      style: `color:${alertCss(mi.color)}`,
    }, shapeSvg(mi.shape)));
  }
  if (s.playEffect) {
    inds.append(h('span', {
      class: 'ind ind-beam' + (s.playEffect.temp ? ' temp' : ''),
      title: `PlayEffect ${s.playEffect.color}${s.playEffect.temp ? ' Temp' : ''}`,
      style: `color:${alertCss(s.playEffect.color)}`,
    }, h('span', { class: 'beam-bar' })));
  }
  if (s.alertSound) {
    const a = h('button', {
      class: 'ind-sound',
      title: `PlayAlertSound ${s.alertSound.id} ${s.alertSound.volume} — click to preview`,
    }, `♪ ${s.alertSound.id}`);
    a.addEventListener('click', (ev) => {
      ev.stopPropagation();
      playAlertPreview(s.alertSound.id, s.alertSound.volume);
    });
    inds.append(a);
  }

  // card icon — resolved from conditions; unresolved → no element (current look)
  let ruleIcon = null;
  const iconUrl = ruleIconUrl(rule);
  if (iconUrl) {
    ruleIcon = h('span', { class: 'rule-icon' });
    const img = iconImg(iconUrl, () => ruleIcon.remove()); // dead URL → collapse to current look
    ruleIcon.append(img);
  }

  // [drag handle] [icon] [main] [controls]
  const card = h('div', {
    class: 'rule-card'
      + (state.selection.has(rule.id) ? ' selected' : '')
      + (rule.enabled ? '' : ' disabled'),
    dataset: { id: rule.id },
  },
    grip,
    ruleIcon,
    h('div', { class: 'rule-main' },
      h('div', { class: 'rule-row1' },
        h('span', { class: 'badge ' + rule.action.toLowerCase() }, rule.action),
        nameSpan,
      ),
      h('div', { class: 'rule-conds', title: describeConditions(rule) }, describeConditions(rule)),
      h('div', { class: 'rule-row3' },
        h('span', { class: 'label-chip', style: chipCss(s, 1.6) }, previewText(rule)),
        inds,
      ),
    ),
    controls,
  );

  card.addEventListener('click', (ev) => handleCardClick(rule.id, ev));
  grip.addEventListener('mousedown', () => { card.draggable = true; });
  card.addEventListener('dragstart', (ev) => {
    dragId = rule.id;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', rule.id);
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => {
    dragId = null;
    dropIndex = null;
    card.draggable = false;
    card.classList.remove('dragging');
    clearDropMarks();
  });
  return card;
}

function renderRules() {
  const list = $('#rules-list');
  list.textContent = '';
  const rules = state.doc.rules;
  if (!rules.length) {
    list.append(h('div', { class: 'empty-state' }, 'No rules — select items on the left and add rules.'));
    return;
  }
  rules.forEach((rule, i) => list.append(ruleCard(rule, i, rules.length)));
}

function wireRulesDnd() {
  const pane = $('#rules-pane');
  pane.addEventListener('dragover', (ev) => {
    if (!dragId) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    clearDropMarks();
    const over = ev.target.closest('.rule-card');
    if (over) {
      const rect = over.getBoundingClientRect();
      const before = ev.clientY < rect.top + rect.height / 2;
      const idx = state.doc.rules.findIndex((r) => r.id === over.dataset.id);
      dropIndex = before ? idx : idx + 1;
      over.classList.add(before ? 'drop-before' : 'drop-after');
    } else {
      dropIndex = state.doc.rules.length;
      const cards = $$('.rule-card');
      if (cards.length) cards[cards.length - 1].classList.add('drop-after');
    }
  });
  pane.addEventListener('drop', (ev) => {
    ev.preventDefault();
    if (dragId == null || dropIndex == null) return;
    const from = state.doc.rules.findIndex((r) => r.id === dragId);
    if (from === -1) return;
    let to = dropIndex;
    if (from < to) to--;
    dragId = null;
    dropIndex = null;
    if (to === from) { clearDropMarks(); return; }  // dropped in place — not a change
    const [moved] = state.doc.rules.splice(from, 1);
    state.doc.rules.splice(to, 0, moved);
    touch();
  });
}

// ---- style panel -----------------------------------------------------------------------

function setSeg(sel, v) {
  $$(sel + ' button').forEach((b) => b.classList.toggle('active', b.dataset.v == v));
}

function currentSeg(sel) {
  return $(sel + ' button.active')?.dataset.v;
}

function wireSeg(sel, onPick) {
  $(sel).addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    onPick(b.dataset.v);
  });
}

function dim(sel, off) {
  $(sel).classList.toggle('dim', off);
}

// Apply a style mutation to every selected rule, or to the pending style.
function applyStyle(fn) {
  const sel = selectedRules();
  if (sel.length) {
    for (const r of sel) fn(r.style);
    touch();
  } else {
    fn(state.pending.style);
    persist();
    renderPanel();
  }
}

function applyPreset(p) {
  const sel = selectedRules();
  if (sel.length) {
    for (const r of sel) {
      r.action = p.action;
      r.style = { ...structuredClone(p.style), raw: r.style.raw }; // keep unrecognized action lines
    }
    touch();
  } else {
    state.pending.action = p.action;
    state.pending.style = structuredClone(p.style);
    persist();
    renderPanel();
  }
}

function syncColorRow(prefix, val, fallbackHex) {
  $(`#${prefix}-on`).checked = !!val;
  const c = val || [...hexToRgb(fallbackHex), 255];
  $(`#${prefix}-color`).value = rgbToHex(c);
  $(`#${prefix}-alpha`).value = c[3] ?? 255;
  $(`#${prefix}-read`).textContent = `${rgbToHex(c)} · ${c[0]},${c[1]},${c[2]},${c[3] ?? 255}`;
  dim(`#${prefix}-row`, !val);
}

function renderPanel() {
  const t = panelTarget();
  const s = t.style;

  $('#style-scope').textContent =
    t.count === 0 ? 'New-rule style'
    : t.count === 1 ? `Editing: ${t.rule.name || describeConditions(t.rule)}`
    : `Editing ${t.count} rules`;

  const chip = $('#preview-chip');
  chip.textContent = t.rule ? previewText(t.rule) : 'Divine Orb';
  chip.style.cssText = chipCss(s, 1.2);

  // live-preview extras: item icon, beam line, minimap shape, sound pill
  const pvIcon = $('#pv-icon');
  const pvUrl = t.rule ? ruleIconUrl(t.rule) : (ICONS.baseTypes['Divine Orb'] || null);
  pvIcon.textContent = '';
  pvIcon.hidden = !pvUrl;
  if (pvUrl) pvIcon.append(iconImg(pvUrl, () => { pvIcon.hidden = true; }));

  const pvBeam = $('#pv-beam');
  pvBeam.hidden = !s.playEffect;
  if (s.playEffect) {
    pvBeam.style.background = `linear-gradient(0deg, ${alertCss(s.playEffect.color)}, transparent)`;
    pvBeam.style.opacity = s.playEffect.temp ? '0.5' : '0.9';
  }

  const pvShape = $('#pv-shape');
  pvShape.textContent = '';
  pvShape.hidden = !s.minimapIcon;
  pvShape.classList.remove('s0', 's1', 's2');
  if (s.minimapIcon) {
    pvShape.append(shapeSvg(s.minimapIcon.shape));
    pvShape.style.color = alertCss(s.minimapIcon.color);
    pvShape.classList.add('s' + s.minimapIcon.size);
  }

  const pvSound = $('#pv-sound');
  pvSound.hidden = !s.alertSound;
  if (s.alertSound) pvSound.textContent = `♪ ${s.alertSound.id} · ${s.alertSound.volume}`;

  setSeg('#seg-action', t.action);

  $('#fs-on').checked = s.fontSize != null;
  const fsv = s.fontSize ?? 38;
  $('#fs-range').value = fsv;
  $('#fs-num').value = fsv;
  dim('#fs-row', s.fontSize == null);

  syncColorRow('tc', s.textColor, '#ffffff');
  syncColorRow('bc', s.borderColor, '#ffffff');
  syncColorRow('bg', s.backgroundColor, '#000000');

  const mi = s.minimapIcon;
  $('#mi-on').checked = !!mi;
  if (mi) {
    setSeg('#seg-mi-size', mi.size);
    $('#mi-color').value = mi.color;
    $('#mi-shape').value = mi.shape;
  }
  const miSw = $('#mi-swatch');
  miSw.textContent = '';
  miSw.append(shapeSvg($('#mi-shape').value));
  miSw.style.color = alertCss($('#mi-color').value);
  dim('#mi-row', !mi);

  const pe = s.playEffect;
  $('#pe-on').checked = !!pe;
  if (pe) {
    $('#pe-color').value = pe.color;
    $('#pe-temp').checked = pe.temp;
  }
  $('#pe-swatch').style.color = alertCss($('#pe-color').value);
  dim('#pe-row', !pe);

  const as = s.alertSound;
  $('#as-on').checked = !!as;
  if (as) {
    $('#as-id').value = String(as.id);
    $('#as-vol').value = as.volume;
  }
  $('#as-vol-read').textContent = $('#as-vol').value;
  dim('#as-row', !as);
}

function wirePanel() {
  // dropdown options
  const miColor = $('#mi-color');
  const peColor = $('#pe-color');
  for (const name of Object.keys(ALERT_COLORS)) {
    for (const sel of [miColor, peColor]) {
      const opt = h('option', { value: name }, `● ${name}`);
      opt.style.color = alertCss(name);
      sel.append(opt);
    }
  }
  const miShape = $('#mi-shape');
  for (const sh of MINIMAP_SHAPES) {
    miShape.append(h('option', { value: sh }, `${SHAPE_GLYPHS[sh] || ''} ${sh}`));
  }
  const asId = $('#as-id');
  for (const snd of SOUNDS) {
    asId.append(h('option', { value: String(snd.id) }, snd.label));
  }
  setSeg('#seg-mi-size', 1);

  // presets — tier color as a 3px left border (most vivid of the preset's colors)
  const presetEdgeColor = (p) => {
    let best = null;
    let bestChroma = -1;
    for (const c of [p.style.textColor, p.style.borderColor, p.style.backgroundColor]) {
      if (!c) continue;
      const chroma = Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
      if (chroma > bestChroma) { bestChroma = chroma; best = c; }
    }
    if (!best || bestChroma < 20) return 'rgba(255,255,255,0.18)';
    return `rgb(${best[0]},${best[1]},${best[2]})`;
  };
  const row = $('#presets');
  for (const p of PRESETS) {
    const b = h('button', {
      class: 'preset',
      title: `Apply "${p.label}" preset`,
      style: `border-left:3px solid ${presetEdgeColor(p)}`,
    }, p.label);
    b.addEventListener('click', () => applyPreset(p));
    row.append(b);
  }

  // action
  wireSeg('#seg-action', (v) => {
    const sel = selectedRules();
    if (sel.length) {
      for (const r of sel) r.action = v;
      touch();
    } else {
      state.pending.action = v;
      persist();
      renderPanel();
    }
  });

  // font size
  $('#fs-on').addEventListener('change', (ev) => {
    const on = ev.target.checked;
    applyStyle((s) => { s.fontSize = on ? clampInt($('#fs-num').value, 1, 45, 38) : null; });
  });
  const fsSet = (v) => applyStyle((s) => { s.fontSize = clampInt(v, 1, 45, 38); });
  $('#fs-range').addEventListener('input', (ev) => fsSet(ev.target.value));
  $('#fs-num').addEventListener('input', (ev) => { if (ev.target.value !== '') fsSet(ev.target.value); });

  // colors
  const wireColor = (prefix, key) => {
    const on = $(`#${prefix}-on`);
    const col = $(`#${prefix}-color`);
    const al = $(`#${prefix}-alpha`);
    const build = () => [...hexToRgb(col.value), clampInt(al.value, 0, 255, 255)];
    on.addEventListener('change', () => applyStyle((s) => { s[key] = on.checked ? build() : null; }));
    col.addEventListener('input', () => applyStyle((s) => { s[key] = build(); }));
    al.addEventListener('input', () => applyStyle((s) => { s[key] = build(); }));
  };
  wireColor('tc', 'textColor');
  wireColor('bc', 'borderColor');
  wireColor('bg', 'backgroundColor');

  // minimap icon
  const miBuild = () => ({
    size: clampInt(currentSeg('#seg-mi-size') ?? 1, 0, 2, 1),
    color: $('#mi-color').value,
    shape: $('#mi-shape').value,
  });
  $('#mi-on').addEventListener('change', (ev) => {
    const on = ev.target.checked;
    applyStyle((s) => { s.minimapIcon = on ? miBuild() : null; });
  });
  wireSeg('#seg-mi-size', (v) => {
    setSeg('#seg-mi-size', v);
    applyStyle((s) => { s.minimapIcon = miBuild(); });
  });
  $('#mi-color').addEventListener('change', () => applyStyle((s) => { s.minimapIcon = miBuild(); }));
  $('#mi-shape').addEventListener('change', () => applyStyle((s) => { s.minimapIcon = miBuild(); }));

  // beam
  const peBuild = () => ({ color: $('#pe-color').value, temp: $('#pe-temp').checked });
  $('#pe-on').addEventListener('change', (ev) => {
    const on = ev.target.checked;
    applyStyle((s) => { s.playEffect = on ? peBuild() : null; });
  });
  $('#pe-color').addEventListener('change', () => applyStyle((s) => { s.playEffect = peBuild(); }));
  $('#pe-temp').addEventListener('change', () => applyStyle((s) => { s.playEffect = peBuild(); }));

  // alert sound
  const asBuild = () => ({ id: clampInt($('#as-id').value, 1, 16, 1), volume: clampInt($('#as-vol').value, 0, 300, 300) });
  $('#as-on').addEventListener('change', (ev) => {
    const on = ev.target.checked;
    applyStyle((s) => { s.alertSound = on ? asBuild() : null; });
  });
  $('#as-id').addEventListener('change', () => applyStyle((s) => { s.alertSound = asBuild(); }));
  $('#as-vol').addEventListener('input', () => {
    $('#as-vol-read').textContent = $('#as-vol').value;
    applyStyle((s) => { s.alertSound = asBuild(); });
  });
  $('#as-play').addEventListener('click', () => {
    playAlertPreview(clampInt($('#as-id').value, 1, 16, 1), clampInt($('#as-vol').value, 0, 300, 300));
  });
}

// ---- top bar wiring / keyboard --------------------------------------------------------

function wireTopbar() {
  $('#btn-load').addEventListener('click', loadSelected);
  $('#btn-new').addEventListener('click', () => newDoc(false));
  $('#btn-save').addEventListener('click', saveCurrent);
  $('#btn-saveas').addEventListener('click', openNamePrompt);
  $('#btn-export').addEventListener('click', exportFilter);
  $('#name-ok').addEventListener('click', confirmNamePrompt);
  $('#name-input').addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') confirmNamePrompt();
    else if (ev.key === 'Escape') closeNamePrompt();
  });
  $('#btn-warn').addEventListener('click', () => {
    const d = $('#warn-drawer');
    d.hidden = !d.hidden;
  });
}

function wireCatalog() {
  $('#catalog-search').addEventListener('input', (ev) => {
    state.catalogQuery = ev.target.value;
    renderCatalog();
  });
  $('#btn-clear-sel').addEventListener('click', () => {
    state.catalogSel.clear();
    renderCatalog();
  });
  $('#btn-add-rules').addEventListener('click', addRulesForSelection);
}

function wireKeyboard() {
  window.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      saveCurrent();
      return;
    }
    const tag = ev.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ev.target.isContentEditable;
    if (typing) return;
    if (ev.key === 'Delete') {
      deleteSelected();
    } else if (ev.key === 'Escape') {
      closeNamePrompt();
      $('#warn-drawer').hidden = true;
      if (state.selection.size) {
        state.selection.clear();
        state.anchorId = null;
        renderRules();
        renderPanel();
      }
    }
  });
}

// ---- init ------------------------------------------------------------------------------

function init() {
  wireTopbar();
  wireCatalog();
  wireRulesDnd();
  wirePanel();
  wireKeyboard();

  if (!restore()) newDoc(true);
  else refresh();

  renderCatalog();
  refreshFilterList();
  loadIconManifest();
}

init();
