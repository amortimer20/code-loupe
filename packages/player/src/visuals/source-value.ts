import type { Value } from '../lesson';
import type { BadgeOrigin, Snapshot } from '../state';
import { formatValue, isReference } from '../values';
import { checkKeys } from '../validation';
import { findVariable } from './call-stack-state';
import { checkCollectionIndex } from './collection-state';
import { dictionaryField } from './dictionary-state';
import { collectionVariable, referenceIdentity } from './heap-state';
import { instanceAttribute } from './instance-state';

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

/** Locate where a badge's value travels from, validating the source against the current snapshot. */
export function resolveOrigin(from: unknown, s: Snapshot, fail: (msg: string) => never): BadgeOrigin | undefined {
  if (from === undefined) return undefined;
  if (from === 'console') {
    const chunk = s.console.findLastIndex((c) => c.kind === 'in');
    if (chunk < 0) fail('`from: console` but the user hasn\'t typed anything yet. Add an `input` step first.');
    return { kind: 'console', chunk };
  }
  if (typeof from === 'object' && from !== null && 'var' in from && typeof from.var === 'string') {
    checkKeys(from, ['var', 'scope', 'index', 'key', 'attribute'], 'variable source', fail);
    const scope = 'scope' in from ? from.scope : undefined;
    if (scope !== undefined && scope !== 'global') fail('variable source `scope` must be `global` when supplied.');
    const found = findVariable(s, from.var, scope === 'global');
    if (!found) fail(`\`from: { var: ${from.var} }\` but there is no variable named ${from.var} in the active scope or globals.`);
    if ('attribute' in from) {
      if ('key' in from || 'index' in from) fail('attribute sources cannot combine with key or index.');
      const object = instanceAttribute(s, found!.variable, from.attribute, true, fail);
      return { kind: 'var', name: from.var, frameId: found!.frameId, attribute: from.attribute as string, ref: object.id };
    }
    if ('key' in from) {
      if ('index' in from) fail('variable source cannot combine key and index.');
      const object = dictionaryField(s, found!.variable, from.key, fail);
      return { kind: 'var', name: from.var, frameId: found!.frameId, key: from.key as string, ref: object.id };
    }
    if ('index' in from) {
      checkCollectionIndex(collectionVariable(s, found!.variable), from.index, fail);
      return { kind: 'var', name: from.var, frameId: found!.frameId, index: from.index, ...referenceIdentity(found!.variable) };
    }
    const resolved = collectionVariable(s, found!.variable).value;
    if (isReference(found!.variable.value)) {
      const ref = found!.variable.value.ref;
      const object = s.heap.find(item => item.id === ref)!;
      if ('fields' in object && object.class !== undefined) fail('instance sources require an `attribute`; whole-instance value badges are not supported.');
    }
    if (!Array.isArray(resolved) && typeof resolved === 'object' && resolved !== null) fail('dictionary sources require a `key`; whole-dictionary badges are not supported.');
    return { kind: 'var', name: from.var, frameId: found!.frameId, ...referenceIdentity(found!.variable) };
  }
  return fail('`from` must be `console` or `{ var: name }`.');
}
