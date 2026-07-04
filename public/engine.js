// POE2 Filter Studio — engine.js
// Parse / serialize PoE2 .filter files per CONTRACT.md.
// Pure ES module: works in browser and Node, no imports.

let idCounter = 0;
function nextId() {
  return 'r' + idCounter++;
}

const NUMERIC_CONDITIONS = new Set([
  'ItemLevel', 'AreaLevel', 'DropLevel', 'Quality', 'WaystoneTier',
  'StackSize', 'BaseArmour', 'BaseEvasion', 'BaseEnergyShield', 'Sockets',
]);
const OPS = new Set(['==', '<', '>', '<=', '>=']);
const DISABLED_RE = /^#!(\s|$)/;          // '#! ' prefix marks a disabled-rule line
const BLOCK_RE = /^(Show|Hide)\b\s*(.*)$/;

function emptyStyle() {
  return {
    fontSize: null,
    textColor: null,
    borderColor: null,
    backgroundColor: null,
    minimapIcon: null,
    playEffect: null,
    alertSound: null,
    raw: [],
  };
}

export function createRule(partial = {}) {
  const { style, ...rest } = partial;
  const rule = {
    id: nextId(),
    name: '',
    action: 'Show',
    enabled: true,
    comments: [],
    conditions: [],
    style: emptyStyle(),
  };
  Object.assign(rule, rest);
  if (style) rule.style = { ...emptyStyle(), ...style };
  return rule;
}

// --- parsing ---------------------------------------------------------------

function isInt(t) {
  return /^-?\d+$/.test(t);
}

// tokenize a value list: quoted strings become single values, bare words split
function tokenizeValues(s) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(s)) !== null) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

function isActionFamily(keyword) {
  return /^(Set|Play|Minimap|CustomAlertSound|DisableDropSound|EnableDropSound)/.test(keyword)
    || keyword === 'Continue';
}

// split an unquoted trailing '# comment' off a block line ('#' inside quoted
// values does not count)
function splitInlineComment(line) {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === '#' && !inQuotes) {
      return [line.slice(0, i).trim(), line.slice(i)];
    }
  }
  return [line, ''];
}

// parse one condition/action line inside a block; unrecognized lines are kept
// verbatim (Raw condition or style.raw) so round-trips are lossless
function parseBlockLine(original, rule, warnings = []) {
  const line = original.trim();
  const [trimmed, comment] = splitInlineComment(line);
  if (trimmed !== '' && parseTypedLine(trimmed, rule)) {
    if (comment) warnings.push(`Inline comment will not be preserved on save: "${line}"`);
    return;
  }
  // unrecognized (or pure in-block comment) — preserve verbatim
  const kw = line.split(/\s/)[0];
  if (isActionFamily(kw)) rule.style.raw.push(line);
  else rule.conditions.push({ type: 'Raw', line });
}

// returns true if the line parsed as a typed condition/action
function parseTypedLine(trimmed, rule) {
  const sp = trimmed.search(/\s/);
  const keyword = sp === -1 ? trimmed : trimmed.slice(0, sp);
  const rest = sp === -1 ? '' : trimmed.slice(sp + 1).trim();

  if (keyword === 'Class' || keyword === 'BaseType') {
    let tokens = tokenizeValues(rest);
    let op = '';
    if (tokens[0] === '==') { op = '=='; tokens = tokens.slice(1); }
    if (tokens.length && !tokens.some((t) => OPS.has(t))) {
      rule.conditions.push({ type: keyword, op, values: tokens });
      return true;
    }
  } else if (keyword === 'Rarity') {
    let tokens = tokenizeValues(rest);
    let op = '';
    if (tokens.length && OPS.has(tokens[0])) { op = tokens[0]; tokens = tokens.slice(1); }
    if (tokens.length && !tokens.some((t) => OPS.has(t))) {
      rule.conditions.push({ type: 'Rarity', op, values: tokens });
      return true;
    }
  } else if (NUMERIC_CONDITIONS.has(keyword)) {
    let tokens = rest ? rest.split(/\s+/) : [];
    let op = '';
    if (tokens.length && OPS.has(tokens[0])) { op = tokens[0]; tokens = tokens.slice(1); }
    if (tokens.length === 1 && isInt(tokens[0])) {
      rule.conditions.push({ type: keyword, op, value: parseInt(tokens[0], 10) });
      return true;
    }
  } else if (keyword === 'SetFontSize') {
    const tokens = rest.split(/\s+/).filter(Boolean);
    if (tokens.length === 1 && isInt(tokens[0])) {
      rule.style.fontSize = parseInt(tokens[0], 10);
      return true;
    }
  } else if (keyword === 'SetTextColor' || keyword === 'SetBorderColor' || keyword === 'SetBackgroundColor') {
    const tokens = rest.split(/\s+/).filter(Boolean);
    if ((tokens.length === 3 || tokens.length === 4) && tokens.every(isInt)) {
      const n = tokens.map((t) => parseInt(t, 10));
      const color = [n[0], n[1], n[2], tokens.length === 4 ? n[3] : 255];
      if (keyword === 'SetTextColor') rule.style.textColor = color;
      else if (keyword === 'SetBorderColor') rule.style.borderColor = color;
      else rule.style.backgroundColor = color;
      return true;
    }
  } else if (keyword === 'MinimapIcon') {
    const tokens = rest.split(/\s+/).filter(Boolean);
    if (tokens.length === 3 && isInt(tokens[0])) {
      rule.style.minimapIcon = { size: parseInt(tokens[0], 10), color: tokens[1], shape: tokens[2] };
      return true;
    }
  } else if (keyword === 'PlayEffect') {
    const tokens = rest.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      rule.style.playEffect = { color: tokens[0], temp: false };
      return true;
    }
    if (tokens.length === 2 && tokens[1] === 'Temp') {
      rule.style.playEffect = { color: tokens[0], temp: true };
      return true;
    }
  } else if (keyword === 'PlayAlertSound') {
    const tokens = rest.split(/\s+/).filter(Boolean);
    if (tokens.length === 2 && tokens.every(isInt)) {
      rule.style.alertSound = { id: parseInt(tokens[0], 10), volume: parseInt(tokens[1], 10) };
      return true;
    }
  }

  return false;
}

export function parseFilter(text) {
  const lines = String(text).split(/\r?\n/);
  const header = [];
  const rules = [];
  const warnings = [];
  let pendingComments = [];
  let current = null;
  let lastClosed = null;

  function closeCurrent() {
    if (current) {
      rules.push(current);
      lastClosed = current;
      current = null;
    }
  }

  // content = line with any '#! ' prefix already stripped; disabled = had that prefix
  function handle(content, disabled, originalLine) {
    const trimmed = content.trim();

    if (trimmed === '') {
      closeCurrent();
      // a blank line before the first rule ends the file header
      if (rules.length === 0 && pendingComments.length) {
        header.push(...pendingComments);
        pendingComments = [];
      }
      return;
    }

    const block = BLOCK_RE.exec(trimmed);
    if (block) {
      closeCurrent();
      const rest = block[2];
      let name = '';
      if (rest.startsWith('#')) name = rest.slice(1).trim();
      else if (rest) warnings.push(`Ignored trailing text after ${block[1]}: "${rest}"`);
      current = {
        id: nextId(),
        name,
        action: block[1],
        enabled: !disabled,
        comments: pendingComments,
        conditions: [],
        style: emptyStyle(),
      };
      pendingComments = [];
      return;
    }

    if (current) {
      if (disabled === current.enabled) {
        // enabled/disabled stream switch ends the block
        closeCurrent();
        handle(content, disabled, originalLine);
        return;
      }
      const indented = /^\s/.test(content);
      if (indented || !trimmed.startsWith('#')) {
        parseBlockLine(trimmed, current, warnings);
        return;
      }
      // column-0 comment ends the block and starts the next rule's comments
      closeCurrent();
      pendingComments.push(content);
      return;
    }

    if (trimmed.startsWith('#')) {
      pendingComments.push(content);
      return;
    }
    if (disabled) {
      // '#! something' that is not rule content — keep as a plain comment
      pendingComments.push(originalLine);
      return;
    }
    if (lastClosed) {
      // a blank line or column-0 comment split this block; reattach the
      // orphaned line to the previous rule instead of dropping it
      parseBlockLine(trimmed, lastClosed, warnings);
      warnings.push(`Line separated from its block was reattached to the previous rule: "${trimmed}"`);
      return;
    }
    warnings.push(`Stray line outside any block ignored: "${trimmed}"`);
  }

  for (const line of lines) {
    if (DISABLED_RE.test(line)) {
      handle(line.slice(2).replace(/^ /, ''), true, line);
    } else {
      handle(line, false, line);
    }
  }
  closeCurrent();
  const footer = [];
  if (pendingComments.length) {
    if (rules.length === 0) header.push(...pendingComments);
    else footer.push(...pendingComments);
  }

  return { header, rules, warnings, footer };
}

// --- serializing -------------------------------------------------------------

function quoteValues(values) {
  return values.map((v) => '"' + v + '"').join(' ');
}

function serializeCondition(cond) {
  if (cond.type === 'Raw') return cond.line;
  const op = cond.op ? ' ' + cond.op : '';
  if (cond.type === 'Class' || cond.type === 'BaseType') {
    return `${cond.type}${op} ${quoteValues(cond.values)}`;
  }
  if (cond.type === 'Rarity') return `Rarity${op} ${cond.values.join(' ')}`;
  return `${cond.type}${op} ${cond.value}`;
}

function colorTokens([r, g, b, a]) {
  return a !== 255 ? `${r} ${g} ${b} ${a}` : `${r} ${g} ${b}`;
}

function styleLines(style) {
  const out = [];
  if (style.fontSize != null) out.push(`SetFontSize ${style.fontSize}`);
  if (style.textColor) out.push(`SetTextColor ${colorTokens(style.textColor)}`);
  if (style.borderColor) out.push(`SetBorderColor ${colorTokens(style.borderColor)}`);
  if (style.backgroundColor) out.push(`SetBackgroundColor ${colorTokens(style.backgroundColor)}`);
  if (style.minimapIcon) {
    out.push(`MinimapIcon ${style.minimapIcon.size} ${style.minimapIcon.color} ${style.minimapIcon.shape}`);
  }
  if (style.playEffect) out.push(`PlayEffect ${style.playEffect.color}${style.playEffect.temp ? ' Temp' : ''}`);
  if (style.alertSound) out.push(`PlayAlertSound ${style.alertSound.id} ${style.alertSound.volume}`);
  out.push(...style.raw);
  return out;
}

export function serializeFilter(doc) {
  const chunks = [];
  if (doc.header && doc.header.length) chunks.push(doc.header.join('\n') + '\n');
  for (const rule of doc.rules) {
    const lines = [...rule.comments];
    lines.push(rule.action + (rule.name ? '  # ' + rule.name : ''));
    for (const cond of rule.conditions) lines.push('\t' + serializeCondition(cond));
    for (const s of styleLines(rule.style)) lines.push('\t' + s);
    const emitted = rule.enabled ? lines : lines.map((l) => '#! ' + l);
    chunks.push(emitted.join('\n') + '\n');
  }
  if (doc.footer && doc.footer.length) chunks.push(doc.footer.join('\n') + '\n');
  return chunks.join('\n');
}

// --- describe / validate ------------------------------------------------------

export function describeConditions(rule) {
  if (!rule.conditions.length) return 'Any item';
  return rule.conditions.map((c) => {
    switch (c.type) {
      case 'Class':
        return 'Class: ' + c.values.join(', ');
      case 'BaseType':
        return c.values.length > 3
          ? `${c.values.length} bases`
          : 'BaseType: ' + c.values.join(', ');
      case 'Rarity':
        return 'Rarity ' + (c.op ? c.op + ' ' : '') + c.values.join(' ');
      case 'Raw':
        return c.line;
      default:
        return `${c.type} ${c.op ? c.op + ' ' : ''}${c.value}`;
    }
  }).join(' · ');
}

export function validateDoc(doc) {
  const warnings = [];
  const label = (r, i) => `Rule ${i + 1}${r.name ? ` (${r.name})` : ''}`;

  doc.rules.forEach((rule, i) => {
    const who = label(rule, i);
    if (rule.action === 'Show' && rule.conditions.length === 0 && i < doc.rules.length - 1) {
      // as the last rule this is an intentional catch-all; earlier it swallows
      // every rule below it
      warnings.push(`${who}: Show with no conditions matches everything below it`);
    }
    const s = rule.style;
    if (s.fontSize != null && (s.fontSize < 1 || s.fontSize > 45)) {
      warnings.push(`${who}: SetFontSize ${s.fontSize} out of range 1..45`);
    }
    if (s.alertSound) {
      if (s.alertSound.id < 1 || s.alertSound.id > 16) {
        warnings.push(`${who}: PlayAlertSound id ${s.alertSound.id} out of range 1..16`);
      }
      if (s.alertSound.volume < 0 || s.alertSound.volume > 300) {
        warnings.push(`${who}: PlayAlertSound volume ${s.alertSound.volume} out of range 0..300`);
      }
    }
    if (s.minimapIcon && ![0, 1, 2].includes(s.minimapIcon.size)) {
      warnings.push(`${who}: MinimapIcon size ${s.minimapIcon.size} out of range 0..2`);
    }

    // basic shadowing: an earlier enabled Class-only rule whose values are a
    // superset of this rule's Class values fires first on every item this rule
    // could match, so this rule can never fire
    if (!rule.enabled) return;
    const myClass = rule.conditions.find((c) => c.type === 'Class');
    if (!myClass || !myClass.values.length) return;
    for (let j = 0; j < i; j++) {
      const earlier = doc.rules[j];
      if (!earlier.enabled) continue;
      if (earlier.conditions.length !== 1) continue;
      const ec = earlier.conditions[0];
      if (ec.type !== 'Class') continue;
      const superset = new Set(ec.values);
      if (myClass.values.every((v) => superset.has(v))) {
        warnings.push(`${who}: shadowed by earlier ${label(earlier, j)} — its Class-only condition matches everything this rule matches, so this rule can never fire`);
        break;
      }
    }
  });

  return warnings;
}
