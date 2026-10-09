import type { Value } from '../lesson';
import type { BadgeOrigin, Snapshot } from '../state';
import { formatValue, isReference } from '../values';

type VariableOrigin = Extract<BadgeOrigin, { kind: 'var' }>;
type SourceState = Pick<Snapshot, 'vars' | 'frames' | 'heap'>;

/** Resolve an already validated origin in its exact frame, not by active-scope lookup. */
function sourceValue(state: SourceState, origin: VariableOrigin, fail: (message: string) => never): Value {
  const scope = origin.frameId === 0 ? state.vars : state.frames.find(frame => frame.id === origin.frameId)?.vars;
  const variable = scope?.find(item => item.name === origin.name) ?? fail(`source variable \`${origin.name}\` is missing from frame ${origin.frameId}.`);
  const stored = variable.value;
  if (isReference(stored)) {
    const object = state.heap.find(item => item.id === stored.ref) ?? fail(`source object \`${stored.ref}\` has not been allocated.`);
    if ('fields' in object) {
      const field = origin.attribute ?? origin.key;
      if (field === undefined) fail('a named-field source needs a key or attribute.');
      return object.fields[field];
    }
    return origin.index === undefined ? object.value : object.value[origin.index];
  }
  return stored;
}

/** Flat lists compare element by element; scalar comparison never coerces types. */
function equalValues(left: Value, right: Value): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
  return left === right;
}

export function checkBadgeSourceValue(state: SourceState, origin: VariableOrigin, value: Value, language: string, fail: (message: string) => never) {
  const actual = sourceValue(state, origin, fail);
  if (equalValues(value, actual)) return;
  const target = origin.name + (origin.attribute !== undefined ? `.${origin.attribute}`
    : origin.key !== undefined ? `[${JSON.stringify(origin.key)}]`
    : origin.index !== undefined ? `[${origin.index}]` : '');
  fail(`badge value ${formatValue(value, language)} doesn't match \`${target}\`, which currently holds ${formatValue(actual, language)}. A badge read from a variable must show that variable's value.`);
}
