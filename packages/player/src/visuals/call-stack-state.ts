import type { BadgeState, VarState } from '../state';
import { cloneValue } from '../values';

export interface CallFrame {
  id: number;
  name: string;
  vars: VarState[];
  returnTo: { line: number; over: string; nth: number };
  /** Suspended expression values to restore when the caller resumes. */
  callerBadges: BadgeState[];
}

interface Scopes { vars: VarState[]; frames: CallFrame[] }

export function cloneFrames(frames: CallFrame[]): CallFrame[] {
  return frames.map(frame => ({
    ...frame,
    vars: frame.vars.map(v => ({ ...v, value: cloneValue(v.value) })),
    returnTo: { ...frame.returnTo },
    callerBadges: frame.callerBadges.map(b => ({ ...b, value: cloneValue(b.value) })),
  }));
}

/** Assignments belong to the active function, or globals when no call is active. */
export function activeScope(state: Scopes): { vars: VarState[]; frameId: number } {
  const frame = state.frames.at(-1);
  return frame ? { vars: frame.vars, frameId: frame.id } : { vars: state.vars, frameId: 0 };
}

/** Look up locals, then globals. Suspended callers aren't a lexical scope. */
export function findVariable(state: Scopes, name: string, globalOnly = false) {
  const active = activeScope(state);
  const local = !globalOnly && active.vars.find(v => v.name === name);
  if (local) return { variable: local, frameId: active.frameId };
  const global = state.vars.find(v => v.name === name);
  return global ? { variable: global, frameId: 0 } : undefined;
}
