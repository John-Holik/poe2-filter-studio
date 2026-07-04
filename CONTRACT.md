# POE2 Filter Studio — Module Contract

Shared contract for all modules. Do not deviate from exported names/shapes; other modules are built against these in parallel.

## Stack
- Zero npm dependencies. Node ESM (`"type": "module"`), vanilla JS frontend (ES modules), no build step.
- `server.js` (node:http, port **7444**, bind 127.0.0.1) serves `public/` and the API.
- POE2 filter dir: `<home>\Documents\My Games\Path of Exile 2` by default; override with `--dir=<path>` or the `POE2_FILTER_DIR` env var (see server.js)

## Layout
```
poe2-filter-studio/
  server.js
  package.json
  public/
    index.html  styles.css  app.js
    engine.js   catalog.js  sounds.js
  test/
    engine.test.js
    fixtures/example-monk.filter
  backups/            (gitignored; server writes timestamped backups here)
```

## Rule model (engine.js owns this)
```js
// FilterDoc
{ header: string[],        // leading comment lines of the file (verbatim, incl. '#')
  rules: Rule[],
  footer: string[] }       // trailing comment lines after the last rule (may be absent on hand-built docs)

// Rule
{ id: string,              // unique, e.g. 'r' + counter
  name: string,            // from trailing comment on the Show/Hide line, else ''
  action: 'Show' | 'Hide',
  enabled: boolean,        // parser: always true; serializer comments out disabled rules
  comments: string[],      // comment lines immediately above the block (verbatim)
  conditions: Condition[], // order preserved
  style: Style }

// Condition — one of:
{ type: 'Class'|'BaseType', op: '=='|'', values: string[] }
{ type: 'Rarity', op: ''|'=='|'<'|'>'|'<='|'>=', values: string[] }   // e.g. ['Magic','Rare']
{ type: 'ItemLevel'|'AreaLevel'|'DropLevel'|'Quality'|'WaystoneTier'|'StackSize'
       |'BaseArmour'|'BaseEvasion'|'BaseEnergyShield'|'Sockets',
  op: ''|'=='|'<'|'>'|'<='|'>=', value: number }
{ type: 'Raw', line: string }   // any unrecognized condition line, preserved verbatim
```
`op: ''` means the keyword's default (equals). Serialize `''` as no operator token.

```js
// Style — null field ⇒ omit that line entirely
{ fontSize: number|null,                        // 1..45
  textColor: [r,g,b,a]|null,                    // a optional-in-file; parser fills 255
  borderColor: [r,g,b,a]|null,
  backgroundColor: [r,g,b,a]|null,
  minimapIcon: { size: 0|1|2, color: string, shape: string }|null,
  playEffect: { color: string, temp: boolean }|null,
  alertSound: { id: number, volume: number }|null,  // id 1-16, volume 0-300
  raw: string[] }                               // unrecognized action lines, verbatim
```

## engine.js exports
```js
export function parseFilter(text) -> { header, rules, warnings: string[] }
export function serializeFilter(doc) -> string   // round-trip: parse(serialize(parse(x))) semantically equal
export function createRule(partial = {}) -> Rule // fresh id, defaults: Show, enabled, empty conditions, all-null style
export function describeConditions(rule) -> string  // short human summary, e.g. 'Class: Stackable Currency · 14 bases'
export function validateDoc(doc) -> string[]     // warnings: empty rules, fontSize out of range, sound id/volume range,
                                                 // rule fully shadowed by an earlier catch-all of same Class (basic check)
```
Serializer notes: tab-indent condition/action lines; `Show  # name` when rule.name set; blank line between rules;
disabled rule ⇒ every line prefixed `#! ` (parser recognizes `#! ` blocks and restores enabled:false).

## catalog.js exports
```js
export const CATALOG = [ Group ]
// Group: { id, label, entries: [Entry] }
// Entry: { id, label, kind: 'class'|'basetype'|'special',
//          classes?: string[],        // kind 'class'
//          class?: string,            // kind 'basetype' — the Class the base belongs to (for bucketing)
//          baseTypes?: string[],      // kind 'basetype' (usually length 1; tier packs allowed)
//          conditions?: Condition[] } // kind 'special' — template, e.g. All Uniques = [{type:'Rarity',op:'',values:['Unique']}]
export const RARITIES = ['Normal','Magic','Rare','Unique']
export const ALERT_COLORS = { Red:[r,g,b], Green:[...], Blue, Brown, White, Yellow, Cyan, Grey, Orange, Pink, Purple }
export const MINIMAP_SHAPES = ['Circle','Diamond','Hexagon','Square','Star','Triangle','Cross','Moon','Raindrop','Kite','Pentagon','UpsideDownHouse']
export const SOUNDS = [ { id: 1..16, label: 'Alert 1' ... } ]
```
Every class/basetype string MUST come from NeverSink's PoE2 filter or John's filter (fixture) — no invented names.

## sounds.js exports
```js
export function playAlertPreview(id, volume) // WebAudio synth approximation, distinct per id; volume 0-300 → gain
```

## server.js API (JSON unless noted)
- `GET  /api/filters`            → `{ files: [{name, size, mtime}] }` (*.filter in POE2 dir)
- `GET  /api/filter?name=X`      → raw text (text/plain)
- `POST /api/filter?name=X`      → body = raw text; backs up existing to backups/<name>.<ts>.bak, writes, → `{ok:true, backedUp}`
- name must match `^[A-Za-z0-9 _.-]+\.filter$`; static serving is traversal-safe.

## Item images (public/img/manifest.json)
- We do NOT bundle or redistribute game art. The manifest maps names → absolute image URLs on GGG's official CDN (`https://web.poecdn.com/...`), loaded client-side at runtime — same pattern as the official trade site. Repo ships only the URL manifest.
```json
{ "baseTypes": { "Divine Orb": "https://web.poecdn.com/image/Art/2DItems/..." },
  "classes":   { "Quarterstaves": "https://web.poecdn.com/..." },
  "specials":  { "<catalog entry id>": "https://web.poecdn.com/..." } }
```
- Every URL must come from a verifiable GGG source (trade2 static-data API, official site markup) and be verified live (HTTP 200 + image content-type) before inclusion. No guessed URLs. Only `web.poecdn.com` URLs.
- UI resolution order — catalog entry: `baseTypes[entry.baseTypes[0]]` → `specials[entry.id]` → `classes[entry.class ?? entry.classes[0]]` → glyph fallback. Rule card: first `BaseType` condition value in `baseTypes` → first `Class` condition value in `classes` → no icon.
- Missing manifest, missing key, offline, or a dead URL = graceful glyph fallback (`onerror` swap; no broken-image icons).
- `public/img/ATTRIBUTION.md`: images are © Grinding Gear Games, loaded from GGG's CDN at runtime, not distributed with this tool; tool is unaffiliated fan work.

## UI stability contract (do not rename — tests depend on these)
ids: topbar `#filter-select #btn-load #btn-new #btn-save #btn-saveas #btn-export #btn-warn #name-prompt #name-input #name-ok #tb-file #dirty-dot #warn-count #warn-drawer #platform-select #btn-import`,
import modal `#import-modal #import-title #import-steps #import-fallback #import-text #btn-copy-text #import-close`,
catalog `#catalog-search #catalog-list #catalog-footer #catalog-count #btn-clear-sel #btn-add-rules`,
panes `#rules-pane #rules-list #style-pane #style-scope #style-preview #preview-chip`,
style controls `#seg-action #fs-on #fs-range #fs-num #tc-on #tc-color #tc-alpha #bc-on #bc-color #bc-alpha #bg-on #bg-color #bg-alpha #mi-on #seg-mi-size #mi-color #mi-shape #pe-on #pe-color #pe-temp #as-on #as-id #as-vol #as-play #presets #toasts`.
classes: `.cat-group-head .cat-group-label .cat-entry .cat-entry-label .rule-card .rule-name .rule-conds .rule-btns .label-chip .ind-icon .ind-sound .toast .drop-before .drop-after .dragging` and `.rule-card` keeps `dataset.id`, selected state class `selected`, disabled state class `disabled`.

## Selection → rules semantics (app.js)
Selection = set of catalog entry ids (+ whole groups). "Create rule(s) from selection" buckets:
- whole group where all entries share one class, or kind:'class' entries → one rule with `Class ==` those classes
- kind:'basetype' entries → one rule **per class**: `Class == <class>` + `BaseType == <bases>`
- kind:'special' entries → one rule each from its condition template
New rules insert at the TOP of the rule list (first match wins). Applying the style panel to a multi-rule selection writes the same Style onto every selected rule.
