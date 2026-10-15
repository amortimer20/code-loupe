import type { Lesson, ObjectReference, ScalarValue, StoredValue } from './lesson';
import { applyError, STEP_ACTIONS, validateStepShape } from './step-actions';
import { createStepContext, type BuildState } from './step-context';
import type { CollectionSelection } from './visuals/collection-state';
import type { CallFrame } from './visuals/call-stack-state';
import type { HeapObject } from './visuals/heap-state';
import type { FieldTarget } from './visuals/dictionary-state';
import type { AttributeTarget } from './visuals/instance-state';
import type { ProgramError } from './visuals/error-state';

export type { CallFrame } from './visuals/call-stack-state';

export interface BadgeState {
  id: number;
  line: number;
  over: string;
  nth: number;
  value: StoredValue;
  type: string;
}

export interface VarState {
  name: string;
  value: ScalarValue | ObjectReference;
  type: string;
}

export interface ConsoleChunk {
  kind: 'out' | 'in';
  text: string;
  /** Badge whose value flies into this output when it's printed. */
  fromBadge?: number;
}

export type BadgeOrigin = { kind: 'console'; chunk: number } | { kind: 'var'; name: string; frameId: number; index?: number; key?: string; attribute?: string; ref?: string };

/** What changed in the step that produced a snapshot; used only to animate forward steps. */
export interface StepEvents {
  lineChanged: boolean;
  consoleFrom: number;
  badgeAdded?: { id: number; from?: BadgeOrigin };
  converted?: { id: number; from: BadgeState };
  assigned?: { name: string; frameId: number; fromBadge?: number; isNew: boolean };
  updated?: (CollectionSelection | FieldTarget | AttributeTarget) & { fromBadge?: number };
  appended?: CollectionSelection & { fromBadge?: number };
  removed?: CollectionSelection;
  called?: { frameId: number; args: { name: string; fromBadge?: number }[] };
  returned?: { frameId: number; badgeId: number; fromBadge?: number };
}

/** The complete picture at one point in the lesson. Snapshot i is the state after i steps. */
export interface Snapshot {
  error: ProgramError | null;
  line: number | null;
  caption: string | null;
  vars: VarState[];
  frames: CallFrame[];
  badges: BadgeState[];
  console: ConsoleChunk[];
  selection: CollectionSelection | null;
  heap: HeapObject[];
  events: StepEvents;
}

/**
 * Precompute every snapshot so any step can be shown instantly (stepping backwards
 * and scrubbing are just lookups). Also validates that badge targets exist in the code.
 */
export function buildSnapshots(lesson: Lesson): Snapshot[] {
  const build: BuildState = { codeLines: lesson.code.split('\n'), lang: lesson.language, nextBadgeId: 1, nextFrameId: 1, autoAllocated: new Set() };

  let current: Snapshot = { error: null, line: null, caption: null, vars: [], frames: [], badges: [], console: [], selection: null, heap: [], events: { lineChanged: false, consoleFrom: 0 } };
  const snapshots = [current];

  lesson.steps.forEach((step, i) => {
    const ctx = createStepContext(build, step, i, current);
    if (current.error) ctx.fail('an unhandled program error ends execution; no later steps are allowed.');
    if (step.error !== undefined) applyError(ctx);
    else {
      validateStepShape(ctx);
      for (const action of STEP_ACTIONS) action(ctx);
    }
    snapshots.push(ctx.s);
    current = ctx.s;
  });

  return snapshots;
}

export { findNth } from './validation';
