import { LessonError, type Lesson, type OutputSpec, type Value } from './lesson';
import { inferType } from './values';

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

export type BadgeOrigin = { kind: 'console'; chunk: number } | { kind: 'var'; name: string };

/** What changed in the step that produced a snapshot; used only to animate forward steps. */
export interface StepEvents {
  lineChanged: boolean;
  consoleFrom: number;
  badgeAdded?: { id: number; from?: BadgeOrigin };
  converted?: { id: number; from: BadgeState };
  assigned?: { name: string; fromBadge?: number; isNew: boolean };
}

/** The complete picture at one point in the lesson. Snapshot i is the state after i steps. */
export interface Snapshot {
  line: number | null;
  caption: string | null;
  vars: VarState[];
  badges: BadgeState[];
  console: ConsoleChunk[];
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

  let current: Snapshot = { line: null, caption: null, vars: [], badges: [], console: [], events: { lineChanged: false, consoleFrom: 0 } };
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
      if (findNth(codeLines[line - 1], over, nth) < 0) {
        fail(`couldn't find \`${over}\`${nth > 1 ? ` (occurrence ${nth})` : ''} on line ${line}: ${codeLines[line - 1].trim()}`);
      }
    };

    const s: Snapshot = {
      line: current.line,
      caption: step.caption ?? null,
      vars: current.vars.map((v) => ({ ...v })),
      badges: current.badges.map((b) => ({ ...b })),
      console: [...current.console],
      events: { lineChanged: false, consoleFrom: current.console.length },
    };

    if (step.line !== undefined) {
      checkLine(step.line);
      if (step.line !== s.line) {
        s.badges = []; // badges belong to the line being executed
        s.events.lineChanged = true;
      }
      s.line = step.line;
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
      const line = step.badge.line ?? s.line ?? fail('`badge` needs a `line` because no line is active yet.');
      const nth = step.badge.nth ?? 1;
      checkTarget(line, over, nth);
      const badge: BadgeState = { id: nextBadgeId++, line, over, nth, value, type: step.badge.type ?? inferType(value, lang) };
      s.badges.push(badge);
      s.events.badgeAdded = { id: badge.id, from: resolveOrigin(step.badge.from, s, fail) };
    }

    if (step.convert) {
      const badge = s.badges.at(-1) ?? fail('`convert` needs a badge to convert. Add a `badge` step first.');
      if (step.convert.value === undefined) fail('`convert` needs a `value`.');
      const from = { ...badge };
      badge.value = step.convert.value;
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
      let value: Value;
      let type: string;
      let fromBadge: number | undefined;
      if (step.assign.from === 'badge') {
        const badge = s.badges.at(-1) ?? fail('`assign` uses `from: badge` but there is no badge.');
        value = step.assign.value ?? badge.value;
        type = step.assign.type ?? badge.type;
        fromBadge = badge.id;
      } else {
        if (step.assign.value === undefined) fail('`assign` needs a `value` (or `from: badge`).');
        value = step.assign.value!;
        type = step.assign.type ?? inferType(value, lang);
      }
      const existing = s.vars.find((v) => v.name === name);
      if (existing) Object.assign(existing, { value, type });
      else s.vars.push({ name, value, type });
      s.events.assigned = { name, fromBadge, isNew: !existing };
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
    if (!s.vars.some((v) => v.name === from.var)) fail(`\`from: { var: ${from.var} }\` but there is no variable named ${from.var} yet.`);
    return { kind: 'var', name: from.var };
  }
  return fail('`from` must be `console` or `{ var: name }`.');
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
