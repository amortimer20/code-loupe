import type { Snapshot, VarState } from '../state';
import { isReference } from '../values';
import type { DictionaryObject } from './heap-state';

export interface FieldTarget { name: string; frameId: number; ref: string; key: string }

/** Named fields belong to the referenced object, regardless of the name's scope. */
export function dictionaryField(state: Pick<Snapshot, 'heap'>, variable: VarState, key: unknown, fail: (message: string) => never): DictionaryObject {
  if (typeof key !== 'string' || !key.length) fail('dictionary `key` must be nonempty text.');
  const ref = isReference(variable.value) ? variable.value.ref : undefined;
  const object = state.heap.find(item => item.id === ref);
  if (!object || !('fields' in object) || object.class !== undefined) return fail(`variable \`${variable.name}\` is not a dictionary reference.`);
  if (!Object.hasOwn(object.fields, key as string)) fail(`key \`${String(key)}\` does not exist in \`${variable.name}\`.`);
  return object;
}
