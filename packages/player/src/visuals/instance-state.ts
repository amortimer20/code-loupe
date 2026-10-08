import type { Snapshot, VarState } from '../state';
import { isReference } from '../values';
import type { FieldObject } from './heap-state';

export interface AttributeTarget { name: string; frameId: number; ref: string; attribute: string }

/** Constructor calls target an explicitly allocated instance, never a dictionary. */
export function constructedInstance(state: Pick<Snapshot, 'heap'>, ref: unknown, fail: (message: string) => never): FieldObject & { class: string } {
  if (typeof ref !== 'string' || !ref.length) return fail('`construct` needs a nonempty instance id.');
  const object = state.heap.find(item => item.id === ref);
  if (!object || !('fields' in object) || object.class === undefined) return fail(`object \`${ref}\` is not an allocated class instance.`);
  return object as FieldObject & { class: string };
}

export function instanceAttribute(state: Pick<Snapshot, 'heap'>, variable: VarState, attribute: unknown, mustExist: boolean, fail: (message: string) => never) {
  if (typeof attribute !== 'string' || !attribute.length) return fail('`attribute` must be nonempty text.');
  if (!isReference(variable.value)) return fail(`variable \`${variable.name}\` is not an instance reference.`);
  const object = constructedInstance(state, variable.value.ref, fail);
  if (mustExist && !Object.hasOwn(object.fields, attribute)) fail(`attribute \`${attribute}\` does not exist in \`${variable.name}\`.`);
  return object;
}
