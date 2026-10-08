import type { ScalarValue, Value } from '../lesson';
import type { Snapshot, VarState } from '../state';
import { isReference } from '../values';
import type { CollectionSelection } from './collection-state';

export interface SharedList { id: string; value: ScalarValue[]; type: string }
export interface FieldObject { id: string; fields: Record<string, ScalarValue>; type: string; class?: string }
export type DictionaryObject = FieldObject;
export type HeapObject = SharedList | FieldObject;

/** Copy a named field on either a dictionary or instance, preserving older snapshots. */
export function replaceObjectField(object: FieldObject, key: string, value: ScalarValue) {
  object.fields = { ...object.fields, [key]: value };
}

/** Variables store references; object contents live once in the heap. */
export function resolveVariableValue(state: Pick<Snapshot, 'heap'>, variable: VarState): Value | DictionaryObject['fields'] {
  if (!isReference(variable.value)) return variable.value;
  const ref = variable.value.ref;
  const object = state.heap.find(item => item.id === ref);
  if (!object) throw new Error(`Unknown shared list ${ref}.`);
  return 'fields' in object ? object.fields : object.value;
}

export function collectionVariable(state: Pick<Snapshot, 'heap'>, variable: VarState) {
  return { ...variable, value: resolveVariableValue(state, variable) };
}

export function storeCollectionValue(state: Pick<Snapshot, 'heap'>, variable: VarState, value: ScalarValue[]) {
  if (isReference(variable.value)) {
    const ref = variable.value.ref;
    const object = state.heap.find(item => item.id === ref)!;
    if ('fields' in object) throw new Error('Cannot store a list in a dictionary object.');
    object.value = value;
  } else variable.value = value;
}

export function referenceIdentity(variable: VarState): { ref?: string } {
  return isReference(variable.value) ? { ref: variable.value.ref } : {};
}

export function selectionMatches(selection: CollectionSelection | null, variable: VarState, name: string, frameId: number) {
  if (!selection) return false;
  return isReference(variable.value) ? selection.ref === variable.value.ref : selection.ref === undefined && selection.name === name && selection.frameId === frameId;
}
