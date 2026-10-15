import { LessonError, type Step } from './lesson';
import { cloneValue } from './values';
import { cloneFrames } from './visuals/call-stack-state';
import { findNth } from './validation';
import type { Snapshot } from './state';

/** Counters and lookups that persist across every step of one lesson. */
export interface BuildState {
  codeLines: string[];
  lang: string;
  nextBadgeId: number;
  nextFrameId: number;
  /** List ids created implicitly by a binding, so a colliding `allocate` can explain itself. */
  autoAllocated: Set<string>;
}

/**
 * Everything one step's actions share: the snapshot being built (`s`), the
 * previous snapshot for change detection, and error/target checking that
 * reports `Step N:` messages.
 */
export interface StepContext {
  step: Step;
  index: number;
  build: BuildState;
  lang: string;
  s: Snapshot;
  previous: Snapshot;
  fail: (msg: string) => never;
  checkLine: (line: number) => void;
  checkTarget: (line: number, over: string, nth: number) => void;
}

export function createStepContext(build: BuildState, step: Step, index: number, previous: Snapshot): StepContext {
  const { codeLines } = build;
  const fail = (msg: string): never => {
    throw new LessonError(`Step ${index + 1}: ${msg}`);
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

  // Every snapshot is a full copy, so earlier snapshots are never touched by later steps.
  const s: Snapshot = {
    error: previous.error ? { ...previous.error } : null,
    line: previous.line,
    caption: step.caption ?? null,
    vars: previous.vars.map((v) => ({ ...v, value: cloneValue(v.value) })),
    frames: cloneFrames(previous.frames),
    badges: previous.badges.map((b) => ({ ...b, value: cloneValue(b.value) })),
    console: [...previous.console],
    selection: previous.selection ? { ...previous.selection } : null,
    heap: previous.heap.map(object => 'fields' in object ? { ...object, fields: { ...object.fields } } : { ...object, value: [...object.value] }),
    events: { lineChanged: false, consoleFrom: previous.console.length },
  };

  return { step, index, build, lang: build.lang, s, previous, fail, checkLine, checkTarget };
}
