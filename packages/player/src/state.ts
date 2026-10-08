import { LessonError, type AssignSpec, type Lesson, type OutputSpec, type Value } from './lesson';
import { cloneValue, inferType, validateValue } from './values';
import { appendCollectionElement, checkCollectionIndex, removeCollectionElement, replaceCollectionElement, type CollectionSelection } from './visuals/collection-state';
import { activeScope, cloneFrames, findVariable, type CallFrame } from './visuals/call-stack-state';

export type { CallFrame } from './visuals/call-stack-state';

export interface BadgeState {
  id: number;
  line: number;
  over: string;
  nth: number;
  value: Value;
  type: string;
}

export interface VarState {
  name: string;
  value: Value;
  type: string;
}

export interface ConsoleChunk {
  kind: 'out' | 'in';
  text: string;
  /** Badge whose value flies into this output when it's printed. */
  fromBadge?: number;
}

export type BadgeOrigin = { kind: 'console'; chunk: number } | { kind: 'var'; name: string; frameId: number; index?: number };

/** What changed in the step that produced a snapshot; used only to animate forward steps. */
export interface StepEvents {
  lineChanged: boolean;
  consoleFrom: number;
  badgeAdded?: { id: number; from?: BadgeOrigin };
  converted?: { id: number; from: BadgeState };
  assigned?: { name: string; frameId: number; fromBadge?: number; isNew: boolean };
  updated?: CollectionSelection & { fromBadge?: number };
  appended?: CollectionSelection & { fromBadge?: number };
  removed?: CollectionSelection;
  called?: { frameId: number; args: { name: string; fromBadge?: number }[] };
  returned?: { frameId: number; badgeId: number; fromBadge?: number };
}

/** The complete picture at one point in the lesson. Snapshot i is the state after i steps. */
export interface Snapshot {
  line: number | null;
  caption: string | null;
  vars: VarState[];
  frames: CallFrame[];
  badges: BadgeState[];
  console: ConsoleChunk[];
  selection: CollectionSelection | null;
  events: StepEvents;
}

/**
 * Precompute every snapshot so any step can be shown instantly (stepping backwards
 * and scrubbing are just lookups). Also validates that badge targets exist in the code.
 */
export function buildSnapshots(lesson: Lesson): Snapshot[] {
  const codeLines = lesson.code.split('\n');
  const lang = lesson.language;
  let nextBadgeId = 1;
  let nextFrameId = 1;

  let current: Snapshot = { line: null, caption: null, vars: [], frames: [], badges: [], console: [], selection: null, events: { lineChanged: false, consoleFrom: 0 } };
  const snapshots = [current];

  lesson.steps.forEach((step, i) => {
    const fail = (msg: string): never => {
      throw new LessonError(`Step ${i + 1}: ${msg}`);
    };
    const checkLine = (line: number) => {
      if (!Number.isInteger(line) || line < 1 || line > codeLines.length) {
        fail(`line ${line} doesn't exist (the code has ${codeLines.length} lines).`);
      }
    };
    const checkTarget = (line: number, over: string, nth: number) => {
      checkLine(line);
      if (typeof over !== 'string' || !over.length) fail('a code target must be nonempty text.');
      if (!Number.isInteger(nth) || nth < 1) fail('`nth` must be a positive integer.');
      if (findNth(codeLines[line - 1], over, nth) < 0) {
        fail(`couldn't find \`${over}\`${nth > 1 ? ` (occurrence ${nth})` : ''} on line ${line}: ${codeLines[line - 1].trim()}`);
      }
    };

    const s: Snapshot = {
      line: current.line,
      caption: step.caption ?? null,
      vars: current.vars.map((v) => ({ ...v, value: cloneValue(v.value) })),
      frames: cloneFrames(current.frames),
      badges: current.badges.map((b) => ({ ...b, value: cloneValue(b.value) })),
      console: [...current.console],
      selection: current.selection ? { ...current.selection } : null,
      events: { lineChanged: false, consoleFrom: current.console.length },
    };

    if (step.call !== undefined || step.return !== undefined) {
      const action = step.call !== undefined ? 'call' : 'return';
      if (Object.keys(step).some(key => key !== action && key !== 'caption')) {
        fail(`\`${action}\` must be its own step (with an optional caption).`);
      }
    }
    if ([step.update, step.append, step.remove].filter(action => action !== undefined).length > 1) {
      fail('use only one collection mutation (`update`, `append`, or `remove`) per step.');
    }

    const readValue = (spec: Omit<AssignSpec, 'var'>, label: string) => {
      if (spec.from !== undefined && spec.from !== 'badge') fail(`${label} \`from\` must be \`badge\`.`);
      const badge = spec.from === 'badge' ? (s.badges.at(-1) ?? fail(`${label} uses \`from: badge\` but there is no badge.`)) : undefined;
      const value = spec.value !== undefined ? spec.value : badge?.value;
      if (value === undefined) fail(`${label} needs a \`value\` (or \`from: badge\`).`);
      validateValue(value, fail, label);
      if (spec.type !== undefined && (typeof spec.type !== 'string' || !spec.type.length)) fail(`${label} \`type\` must be nonempty text.`);
      return {
        value: cloneValue(value),
        type: spec.type ?? (spec.value !== undefined ? inferType(value as Value, lang) : badge!.type),
        fromBadge: badge?.id,
      };
    };

    if (step.call !== undefined) {
      const call = step.call;
      if (!isRecord(call)) fail('`call` needs a mapping with name, line, and over.');
      checkKeys(call, ['name', 'line', 'over', 'nth', 'args'], 'call', fail);
      if (typeof call.name !== 'string' || !call.name.length) fail('`call` needs a nonempty function `name`.');
      checkLine(call.line);
      const callerLine = s.line ?? fail('`call` needs an active caller line.');
      const nth = call.nth ?? 1;
      checkTarget(callerLine, call.over, nth);
      if (call.args !== undefined && !Array.isArray(call.args)) fail('`call.args` must be a list.');
      const names = new Set<string>();
      const args = (call.args ?? []).map(arg => {
        if (!isRecord(arg)) fail('each call argument must be a mapping.');
        checkKeys(arg, ['var', 'value', 'type', 'from'], 'call argument', fail);
        if (typeof arg.var !== 'string' || !arg.var.length) fail('each call argument needs a nonempty `var` parameter name.');
        if (names.has(arg.var)) fail(`duplicate parameter \`${arg.var}\`.`);
        names.add(arg.var);
        return { name: arg.var, ...readValue(arg, 'call argument') };
      });
      const frame: CallFrame = {
        id: nextFrameId++, name: call.name,
        vars: args.map(({ name, value, type }) => ({ name, value, type })),
        returnTo: { line: callerLine, over: call.over, nth },
        callerBadges: s.badges.map(b => ({ ...b, value: cloneValue(b.value) })),
      };
      s.frames.push(frame);
      s.badges = [];
      s.line = call.line;
      s.events.lineChanged = s.line !== current.line;
      s.events.called = { frameId: frame.id, args: args.map(({ name, fromBadge }) => ({ name, fromBadge })) };
    }

    if (step.return !== undefined) {
      if (!isRecord(step.return)) fail('`return` needs a mapping with value or from.');
      checkKeys(step.return, ['value', 'type', 'from'], 'return', fail);
      const frame = s.frames.at(-1) ?? fail('`return` needs an active function call.');
      const result = readValue(step.return, 'return');
      s.frames.pop();
      if (s.selection?.frameId === frame.id) s.selection = null;
      const badge: BadgeState = { id: nextBadgeId++, ...frame.returnTo, value: result.value, type: result.type };
      const callerCode = codeLines[frame.returnTo.line - 1];
      const callStart = findNth(callerCode, frame.returnTo.over, frame.returnTo.nth);
      const callEnd = callStart + frame.returnTo.over.length;
      const surroundingBadges = frame.callerBadges.filter(b => {
        if (b.line !== frame.returnTo.line) return true;
        const start = findNth(callerCode, b.over, b.nth);
        return start < callStart || start + b.over.length > callEnd;
      });
      // The call's result replaces its argument/expression badges, while values
      // elsewhere in the caller's expression survive. Older snapshots stay intact.
      s.badges = [...surroundingBadges, badge];
      s.line = frame.returnTo.line;
      s.events.lineChanged = s.line !== current.line;
      s.events.returned = { frameId: frame.id, badgeId: badge.id, fromBadge: result.fromBadge };
    }

    if (step.line !== undefined) {
      checkLine(step.line);
      if (step.line !== s.line) {
        s.badges = []; // badges belong to the line being executed
        s.events.lineChanged = true;
      }
      s.line = step.line;
    }

    if (step.select !== undefined) {
      if (step.select === null) s.selection = null;
      else {
        if (!isRecord(step.select)) fail('`select` needs a mapping with var and index, or null.');
        checkKeys(step.select, ['var', 'index', 'scope'], 'select', fail);
        const origin = resolveOrigin(step.select, s, fail);
        if (origin?.kind === 'var' && origin.index !== undefined) {
          s.selection = { name: origin.name, frameId: origin.frameId, index: origin.index };
        } else fail('`select` needs a variable and index.');
      }
    }

    const output = (spec: OutputSpec, newline: string) => {
      const { text, from } = typeof spec === 'object' && spec !== null ? spec : { text: spec, from: undefined };
      if (text === undefined) fail('output needs `text`, e.g. `print: { text: Hi, from: badge }`.');
      const chunk: ConsoleChunk = { kind: 'out', text: `${text}${newline}` };
      if (from === 'badge') chunk.fromBadge = (s.badges.at(-1) ?? fail('`from: badge` but there is no badge to print.')).id;
      else if (from !== undefined) fail('output `from` must be `badge`.');
      s.console.push(chunk);
    };
    if (step.write !== undefined) output(step.write, '');
    if (step.print !== undefined) output(step.print, '\n');
    if (step.input !== undefined) s.console.push({ kind: 'in', text: String(step.input) });

    if (step.badge) {
      const { over, value } = step.badge;
      if (typeof over !== 'string') fail('`badge` needs `over`: the code the value floats above.');
      if (value === undefined) fail('`badge` needs a `value`.');
      validateValue(value, fail, 'badge');
      const line = step.badge.line ?? s.line ?? fail('`badge` needs a `line` because no line is active yet.');
      const nth = step.badge.nth ?? 1;
      checkTarget(line, over, nth);
      const badge: BadgeState = { id: nextBadgeId++, line, over, nth, value: cloneValue(value), type: step.badge.type ?? inferType(value, lang) };
      s.badges.push(badge);
      s.events.badgeAdded = { id: badge.id, from: resolveOrigin(step.badge.from, s, fail) };
    }

    if (step.convert) {
      const badge = s.badges.at(-1) ?? fail('`convert` needs a badge to convert. Add a `badge` step first.');
      if (step.convert.value === undefined) fail('`convert` needs a `value`.');
      validateValue(step.convert.value, fail, 'convert');
      const from = { ...badge, value: cloneValue(badge.value) };
      badge.value = cloneValue(step.convert.value);
      badge.type = step.convert.type ?? inferType(step.convert.value, lang);
      if (step.convert.over !== undefined) {
        badge.over = step.convert.over;
        badge.line = step.convert.line ?? badge.line;
        badge.nth = step.convert.nth ?? 1;
        checkTarget(badge.line, badge.over, badge.nth);
      }
      s.events.converted = { id: badge.id, from };
    }

    if (step.assign) {
      const name = step.assign.var;
      if (typeof name !== 'string') fail('`assign` needs `var`: the variable name.');
      const { value, type, fromBadge } = readValue(step.assign, 'assign');
      const { vars, frameId } = activeScope(s);
      if (s.selection?.name === name && s.selection.frameId === frameId) s.selection = null;
      const existing = vars.find((v) => v.name === name);
      if (existing) Object.assign(existing, { value, type });
      else vars.push({ name, value, type });
      s.events.assigned = { name, frameId, fromBadge, isNew: !existing };
    }

    if (step.update !== undefined) {
      const update = step.update;
      if (!isRecord(update)) fail('`update` needs a mapping with var, index, and value or from.');
      checkKeys(update, ['var', 'index', 'value', 'from', 'scope'], 'update', fail);
      if (typeof update.var !== 'string' || !update.var.length) fail('`update` needs a nonempty `var` name.');
      if (update.scope !== undefined && update.scope !== 'global') fail('`update.scope` must be `global` when supplied.');
      const found = findVariable(s, update.var, update.scope === 'global') ?? fail(`no variable named ${update.var} in the active scope or globals.`);
      const { value, fromBadge } = readValue(update, 'update');
      found.variable.value = replaceCollectionElement(found.variable, update.index, value, fail);
      s.events.updated = { name: update.var, frameId: found.frameId, index: update.index, fromBadge };
    }

    for (const action of ['append', 'remove'] as const) {
      const spec = step[action];
      if (spec === undefined) continue;
      if (!isRecord(spec)) fail(`\`${action}\` needs a mapping with var${action === 'remove' ? ' and index' : ' and value or from'}.`);
      checkKeys(spec, action === 'append' ? ['var', 'value', 'from', 'scope'] : ['var', 'index', 'scope'], action, fail);
      if (typeof spec.var !== 'string' || !spec.var.length) fail(`\`${action}\` needs a nonempty \`var\` name.`);
      if (spec.scope !== undefined && spec.scope !== 'global') fail(`\`${action}.scope\` must be \`global\` when supplied.`);
      const found = findVariable(s, spec.var, spec.scope === 'global') ?? fail(`no variable named ${spec.var} in the active scope or globals.`);
      if (action === 'append') {
        const { value, fromBadge } = readValue(step.append!, 'append');
        found.variable.value = appendCollectionElement(found.variable, value, fail);
        s.events.appended = { name: spec.var, frameId: found.frameId, index: found.variable.value.length - 1, fromBadge };
      } else {
        const index = step.remove!.index;
        found.variable.value = removeCollectionElement(found.variable, index, fail);
        s.events.removed = { name: spec.var, frameId: found.frameId, index };
        if (s.selection?.name === spec.var && s.selection.frameId === found.frameId) {
          if (s.selection.index === index) s.selection = null;
          else if (s.selection.index > index) s.selection.index--;
        }
      }
    }

    snapshots.push(s);
    current = s;
  });

  return snapshots;
}

function resolveOrigin(from: unknown, s: Snapshot, fail: (msg: string) => never): BadgeOrigin | undefined {
  if (from === undefined) return undefined;
  if (from === 'console') {
    const chunk = s.console.findLastIndex((c) => c.kind === 'in');
    if (chunk < 0) fail('`from: console` but the user hasn\'t typed anything yet. Add an `input` step first.');
    return { kind: 'console', chunk };
  }
  if (typeof from === 'object' && from !== null && 'var' in from && typeof from.var === 'string') {
    checkKeys(from, ['var', 'scope', 'index'], 'variable source', fail);
    const scope = 'scope' in from ? from.scope : undefined;
    if (scope !== undefined && scope !== 'global') fail('variable source `scope` must be `global` when supplied.');
    const found = findVariable(s, from.var, scope === 'global');
    if (!found) fail(`\`from: { var: ${from.var} }\` but there is no variable named ${from.var} in the active scope or globals.`);
    if ('index' in from) {
      checkCollectionIndex(found!.variable, from.index, fail);
      return { kind: 'var', name: from.var, frameId: found!.frameId, index: from.index };
    }
    return { kind: 'var', name: from.var, frameId: found!.frameId };
  }
  return fail('`from` must be `console` or `{ var: name }`.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkKeys(value: object, allowed: string[], label: string, fail: (msg: string) => never) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`unknown ${label} key \`${key}\`.`);
  }
}

/** Index of the nth (1-based) occurrence of needle in text, or -1. */
export function findNth(text: string, needle: string, nth: number): number {
  let index = -1;
  for (let k = 0; k < nth; k++) {
    index = text.indexOf(needle, index + 1);
    if (index < 0) return -1;
  }
  return index;
}
