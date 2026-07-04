import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseFilter,
  serializeFilter,
  createRule,
  describeConditions,
  validateDoc,
} from '../public/engine.js';

const FIXTURE = readFileSync(new URL('./fixtures/example-monk.filter', import.meta.url), 'utf8');

// semantic view of a doc: everything except ids (fresh per parse) and warnings
function sem(doc) {
  return {
    header: doc.header,
    rules: doc.rules.map(({ id, ...rest }) => rest),
  };
}

// normalize a filter line for the nothing-lost comparison: collapse whitespace,
// drop an explicit 255 alpha on color lines (serializer omits it; same meaning)
function normLine(line) {
  let s = line.trim().replace(/\s+/g, ' ');
  const m = /^(Set(?:Text|Border|Background)Color)((?: \d+){4})$/.exec(s);
  if (m) {
    const nums = m[2].trim().split(' ');
    if (nums[3] === '255') s = m[1] + ' ' + nums.slice(0, 3).join(' ');
  }
  return s;
}

// --- round-trip on the real filter -----------------------------------------

test('round-trip: parse -> serialize -> parse is semantically equal', () => {
  const doc1 = parseFilter(FIXTURE);
  assert.deepEqual(doc1.warnings, []);
  assert.equal(doc1.rules.length, 25);

  const out = serializeFilter(doc1);
  const doc2 = parseFilter(out);
  assert.deepEqual(doc2.warnings, []);
  assert.equal(doc2.rules.length, 25);

  assert.deepEqual(sem(doc2), sem(doc1));
  // serializer is stable: reserializing the reparse yields identical text
  assert.equal(serializeFilter(doc2), out);
});

test('round-trip: every non-comment line of the original survives semantically', () => {
  const doc2 = parseFilter(serializeFilter(parseFilter(FIXTURE)));
  const counts = new Map();
  for (const line of serializeFilter(doc2).split('\n')) {
    const n = normLine(line);
    if (n) counts.set(n, (counts.get(n) || 0) + 1);
  }
  for (const raw of FIXTURE.split(/\r?\n/)) {
    const t = raw.trim();
    if (t === '' || t.startsWith('#')) continue;
    const key = normLine(raw);
    const left = counts.get(key) || 0;
    assert.ok(left > 0, `line lost in round-trip: ${raw}`);
    counts.set(key, left - 1);
  }
});

test('fixture: header and per-rule comments split correctly', () => {
  const doc = parseFilter(FIXTURE);
  assert.equal(doc.header.length, 31);
  assert.ok(doc.header[0].startsWith('# ==='));
  assert.ok(doc.header[30].startsWith('# ==='));
  assert.equal(doc.rules[0].comments.length, 6);   // Gold banner
  assert.equal(doc.rules[1].comments.length, 5);   // CURRENCY section banner
  assert.deepEqual(doc.rules[2].comments, []);     // High tier: no banner
});

// --- parse specifics from the fixture ---------------------------------------

test('fixture: Gold rule — BaseType == "Gold", shown silent', () => {
  const gold = parseFilter(FIXTURE).rules[0];
  assert.equal(gold.action, 'Show');
  assert.equal(gold.name, '');
  assert.equal(gold.enabled, true);
  assert.deepEqual(gold.conditions, [{ type: 'BaseType', op: '==', values: ['Gold'] }]);
  assert.equal(gold.style.alertSound, null);
  assert.equal(gold.style.playEffect, null);
  assert.equal(gold.style.minimapIcon, null);
  assert.equal(gold.style.fontSize, 30);
  assert.deepEqual(gold.style.textColor, [200, 180, 120, 255]);
  assert.deepEqual(gold.style.backgroundColor, [20, 20, 0, 255]);
});

test('fixture: S-tier currency rule — icon, effect, sound', () => {
  const r = parseFilter(FIXTURE).rules[1];
  assert.ok(r.name.startsWith('S-tier'));
  assert.deepEqual(r.conditions[0], { type: 'Class', op: '==', values: ['Stackable Currency'] });
  assert.equal(r.conditions[1].type, 'BaseType');
  assert.equal(r.conditions[1].op, '==');
  assert.equal(r.conditions[1].values.length, 14);
  assert.ok(r.conditions[1].values.includes('Mirror of Kalandra'));
  assert.ok(r.conditions[1].values.includes("Hinekora's Lock"));
  assert.deepEqual(r.style.minimapIcon, { size: 0, color: 'Red', shape: 'Star' });
  assert.deepEqual(r.style.playEffect, { color: 'Red', temp: false });
  assert.deepEqual(r.style.alertSound, { id: 6, volume: 300 });
  assert.deepEqual(r.style.textColor, [255, 0, 0, 255]);
});

test('fixture: BaseType without == keeps op "" (substring match) — Soul Core/Idol', () => {
  const r = parseFilter(FIXTURE).rules[5];
  assert.deepEqual(r.conditions, [
    { type: 'Class', op: '==', values: ['Augment'] },
    { type: 'BaseType', op: '', values: ['Soul Core', 'Idol'] },
  ]);
});

test('fixture: assorted condition/style shapes', () => {
  const doc = parseFilter(FIXTURE);
  // PlayEffect with Temp (Greater runes)
  assert.deepEqual(doc.rules[6].style.playEffect, { color: 'White', temp: true });
  // two numeric conditions on one rule (Waystones T11-14)
  assert.deepEqual(doc.rules[9].conditions, [
    { type: 'Class', op: '==', values: ['Waystones'] },
    { type: 'WaystoneTier', op: '>=', value: 11 },
    { type: 'WaystoneTier', op: '<=', value: 14 },
  ]);
  // multi-value Class, multi-word Rarity, op '' numeric (rare evasion armour)
  assert.deepEqual(doc.rules[20].conditions, [
    { type: 'Class', op: '==', values: ['Body Armours', 'Helmets', 'Gloves', 'Boots'] },
    { type: 'Rarity', op: '', values: ['Rare'] },
    { type: 'BaseArmour', op: '', value: 0 },
    { type: 'BaseEvasion', op: '>', value: 0 },
    { type: 'ItemLevel', op: '>=', value: 65 },
  ]);
  // Rarity with two words (flasks)
  assert.deepEqual(doc.rules[17].conditions[1], { type: 'Rarity', op: '', values: ['Magic', 'Rare'] });
  // final bare Hide: zero conditions, all-null style
  const last = doc.rules[24];
  assert.equal(last.action, 'Hide');
  assert.deepEqual(last.conditions, []);
  assert.deepEqual(last.style, {
    fontSize: null, textColor: null, borderColor: null, backgroundColor: null,
    minimapIcon: null, playEffect: null, alertSound: null, raw: [],
  });
});

// --- serializer specifics ----------------------------------------------------

test('serializer: op "" emits no operator token, "==" emits "== "', () => {
  const doc = {
    header: [],
    rules: [
      createRule({ conditions: [{ type: 'BaseType', op: '', values: ['Soul Core', 'Idol'] }] }),
      createRule({
        conditions: [{ type: 'BaseType', op: '==', values: ['Gold'] }],
        style: { fontSize: 30, textColor: [255, 0, 0, 255], borderColor: [1, 2, 3, 100] },
      }),
    ],
  };
  const lines = serializeFilter(doc).split('\n');
  assert.ok(lines.includes('\tBaseType "Soul Core" "Idol"'));
  assert.ok(lines.includes('\tBaseType == "Gold"'));
  assert.ok(lines.includes('\tSetFontSize 30'));
  // alpha 255 omitted, other alphas kept
  assert.ok(lines.includes('\tSetTextColor 255 0 0'));
  assert.ok(lines.includes('\tSetBorderColor 1 2 3 100'));
});

test('serializer: rule name emitted on the Show line and reparsed', () => {
  const doc = {
    header: [],
    rules: [createRule({ name: 'top maps', conditions: [{ type: 'Class', op: '==', values: ['Waystones'] }] })],
  };
  const text = serializeFilter(doc);
  assert.ok(text.split('\n').includes('Show  # top maps'));
  assert.equal(parseFilter(text).rules[0].name, 'top maps');
});

// --- disabled rules ------------------------------------------------------------

test('disabled rule round-trips through the #! prefix', () => {
  const rule = createRule({
    name: 'muted tier',
    enabled: false,
    comments: ['# muted block'],
    conditions: [
      { type: 'Class', op: '==', values: ['Waystones'] },
      { type: 'WaystoneTier', op: '<=', value: 5 },
    ],
    style: { fontSize: 34, textColor: [1, 2, 3, 4] },
  });
  const text = serializeFilter({ header: [], rules: [rule] });
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    assert.ok(line.startsWith('#! '), `disabled line not prefixed: ${JSON.stringify(line)}`);
  }
  const r = parseFilter(text).rules[0];
  assert.equal(r.enabled, false);
  assert.equal(r.name, 'muted tier');
  assert.equal(r.action, 'Show');
  assert.deepEqual(r.comments, ['# muted block']);
  assert.deepEqual(r.conditions, rule.conditions);
  assert.equal(r.style.fontSize, 34);
  assert.deepEqual(r.style.textColor, [1, 2, 3, 4]);
});

test('disabling a fixture rule survives round-trip among enabled rules', () => {
  const doc1 = parseFilter(FIXTURE);
  doc1.rules[3].enabled = false;
  const doc2 = parseFilter(serializeFilter(doc1));
  assert.equal(doc2.rules.length, 25);
  assert.equal(doc2.rules[2].enabled, true);
  assert.equal(doc2.rules[3].enabled, false);
  assert.equal(doc2.rules[4].enabled, true);
  assert.deepEqual(sem(doc2), sem(doc1));
});

// --- lossless raw handling ------------------------------------------------------

test('unrecognized lines round-trip via Raw condition / style.raw', () => {
  const text = 'Show  # weird\n'
    + '\tHasExplicitMod "of the Parrot"\n'
    + '\tSockets > 2\n'
    + '\tSetFontSize 40\n'
    + '\tCustomAlertSound "pop.mp3" 300\n'
    + '\tPlayAlertSound 3\n'   // missing volume: not the contract shape, kept raw
    + '\tContinue\n';
  const doc = parseFilter(text);
  const r = doc.rules[0];
  assert.deepEqual(r.conditions[0], { type: 'Raw', line: 'HasExplicitMod "of the Parrot"' });
  assert.deepEqual(r.conditions[1], { type: 'Sockets', op: '>', value: 2 });
  assert.equal(r.style.fontSize, 40);
  assert.equal(r.style.alertSound, null);
  assert.deepEqual(r.style.raw, ['CustomAlertSound "pop.mp3" 300', 'PlayAlertSound 3', 'Continue']);
  const doc2 = parseFilter(serializeFilter(doc));
  assert.deepEqual(sem(doc2), sem(doc));
});

test('space-indented blocks parse the same as tab-indented', () => {
  const tabs = 'Show\n\tClass == "Quarterstaves"\n\tSetFontSize 32\n';
  const spaces = 'Show\n    Class == "Quarterstaves"\n    SetFontSize 32\n';
  assert.deepEqual(sem(parseFilter(spaces)), sem(parseFilter(tabs)));
});

// --- createRule ---------------------------------------------------------------

test('createRule: defaults, fresh unique ids, partial overrides', () => {
  const a = createRule();
  const b = createRule();
  assert.notEqual(a.id, b.id);
  assert.match(a.id, /^r\d+$/);
  assert.equal(a.name, '');
  assert.equal(a.action, 'Show');
  assert.equal(a.enabled, true);
  assert.deepEqual(a.comments, []);
  assert.deepEqual(a.conditions, []);
  assert.deepEqual(a.style, {
    fontSize: null, textColor: null, borderColor: null, backgroundColor: null,
    minimapIcon: null, playEffect: null, alertSound: null, raw: [],
  });
  const c = createRule({ action: 'Hide', name: 'junk', style: { fontSize: 18 } });
  assert.equal(c.action, 'Hide');
  assert.equal(c.name, 'junk');
  assert.equal(c.style.fontSize, 18);
  assert.equal(c.style.textColor, null);
  assert.deepEqual(c.style.raw, []);
});

// --- describeConditions ----------------------------------------------------------

test('describeConditions: contract example shape', () => {
  const doc = parseFilter(FIXTURE);
  assert.equal(describeConditions(doc.rules[1]), 'Class: Stackable Currency · 14 bases');
  assert.equal(describeConditions(doc.rules[8]), 'Class: Waystones · WaystoneTier >= 15');
  assert.equal(describeConditions(doc.rules[5]), 'Class: Augment · BaseType: Soul Core, Idol');
  assert.equal(describeConditions(doc.rules[24]), 'Any item');
});

// --- validateDoc -----------------------------------------------------------------

test('validateDoc: fixture is clean', () => {
  assert.deepEqual(validateDoc(parseFilter(FIXTURE)), []);
});

test('validateDoc: catches bad fontSize, sound id/volume, icon size, empty Show', () => {
  const doc = {
    header: [],
    rules: [
      createRule({ name: 'big', conditions: [{ type: 'Rarity', op: '', values: ['Unique'] }], style: { fontSize: 50 } }),
      createRule({ name: 'loud', conditions: [{ type: 'Rarity', op: '', values: ['Unique'] }], style: { alertSound: { id: 17, volume: 400 } } }),
      createRule({ name: 'icon', conditions: [{ type: 'Rarity', op: '', values: ['Unique'] }], style: { minimapIcon: { size: 3, color: 'Red', shape: 'Star' } } }),
      createRule({ name: 'all' }), // Show with zero conditions, not last -> warns
      createRule({ name: 'end', action: 'Hide' }), // zero-condition Hide never warns
    ],
  };
  const warns = validateDoc(doc);
  assert.ok(warns.some((w) => w.includes('SetFontSize 50') && w.includes('big')), warns.join('; '));
  assert.ok(warns.some((w) => w.includes('id 17') && w.includes('loud')));
  assert.ok(warns.some((w) => w.includes('volume 400') && w.includes('loud')));
  assert.ok(warns.some((w) => w.includes('MinimapIcon size 3') && w.includes('icon')));
  assert.ok(warns.some((w) => w.includes('matches everything') && w.includes('all')));
  assert.equal(warns.length, 5);
});

test('validateDoc: earlier Class-only catch-all shadows a later same-Class rule', () => {
  const catchAll = createRule({
    name: 'all waystones',
    conditions: [{ type: 'Class', op: '==', values: ['Waystones'] }],
  });
  const specific = createRule({
    name: 'top maps',
    conditions: [
      { type: 'Class', op: '==', values: ['Waystones'] },
      { type: 'WaystoneTier', op: '>=', value: 15 },
    ],
    style: { fontSize: 45 },
  });

  const shadowed = validateDoc({ header: [], rules: [catchAll, specific] });
  assert.ok(shadowed.some((w) => /shadowed/.test(w) && w.includes('top maps') && w.includes('all waystones')),
    shadowed.join('; '));

  // specific-first (the fixture's ordering) is fine
  assert.deepEqual(validateDoc({ header: [], rules: [specific, catchAll] }), []);

  // a disabled catch-all shadows nothing
  const disabledCatchAll = { ...catchAll, enabled: false };
  assert.deepEqual(validateDoc({ header: [], rules: [disabledCatchAll, specific] }), []);
});

// --- review-pass regression tests --------------------------------------------

test('inline # comment on condition/style lines is stripped, not parsed as values', () => {
  const doc = parseFilter(
    'Show\n\tClass == "Stackable Currency" # only currency\n\tBaseType "Exalted Orb" # gold tier stuff\n\tSetFontSize 40 # big\n'
  );
  const [r] = doc.rules;
  assert.deepEqual(r.conditions[0], { type: 'Class', op: '==', values: ['Stackable Currency'] });
  assert.deepEqual(r.conditions[1], { type: 'BaseType', op: '', values: ['Exalted Orb'] });
  assert.equal(r.style.fontSize, 40);
  assert.equal(doc.warnings.filter((w) => w.includes('Inline comment')).length, 3);
  // and none of it leaks into the serialized output
  const out = serializeFilter(doc);
  assert.ok(!out.includes('only currency') && !out.includes('"#"'), out);
});

test('# inside quoted values is part of the value, not a comment', () => {
  const doc = parseFilter('Show\n\tBaseType == "The # Base"\n');
  assert.deepEqual(doc.rules[0].conditions[0].values, ['The # Base']);
  assert.equal(doc.warnings.length, 0);
});

test('blank line inside a block reattaches the orphaned lines instead of dropping them', () => {
  const doc = parseFilter('Show\n\tClass == "Waystones"\n\n\tWaystoneTier >= 15\n\tSetFontSize 45\n');
  assert.equal(doc.rules.length, 1);
  const r = doc.rules[0];
  assert.ok(r.conditions.some((c) => c.type === 'WaystoneTier' && c.value === 15));
  assert.equal(r.style.fontSize, 45);
  assert.ok(doc.warnings.some((w) => w.includes('reattached')));
  const out = serializeFilter(doc);
  assert.ok(out.includes('WaystoneTier >= 15') && out.includes('SetFontSize 45'));
});

test('comments after the last rule survive as footer and re-serialize', () => {
  const src = 'Show\n\tClass == "Waystones"\n\n# footer note 1\n# footer note 2\n';
  const doc = parseFilter(src);
  assert.deepEqual(doc.footer, ['# footer note 1', '# footer note 2']);
  const out = serializeFilter(doc);
  assert.ok(out.includes('# footer note 1\n# footer note 2'));
  assert.deepEqual(parseFilter(out).footer, doc.footer);
});

test('validateDoc: zero-condition Show warns only when it is not the last rule', () => {
  const catchAll = createRule({ name: 'catch' });
  const other = createRule({
    name: 'x', action: 'Hide',
    conditions: [{ type: 'Class', op: '==', values: ['Jewels'] }],
  });
  assert.deepEqual(validateDoc({ header: [], rules: [other, catchAll] }), []);
  assert.ok(validateDoc({ header: [], rules: [catchAll, other] })
    .some((w) => w.includes('matches everything')));
});
