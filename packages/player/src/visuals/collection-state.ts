import type { VarState } from '../state';
import type { ScalarValue, Value } from '../lesson';

export interface CollectionSelection {
  name: string;
  frameId: number;
  index: number;
}

/** Copy on update so earlier snapshots and other variable values stay intact. */
export function replaceCollectionElement(variable: VarState, index: number, value: Value, fail: (message: string) => never): ScalarValue[] {
  checkCollectionIndex(variable, index, fail);
  if (Array.isArray(value)) return fail('`update` needs a scalar element value; nested lists are not supported.');
  const items = [...variable.value as ScalarValue[]];
  items[index] = value;
  return items;
}

export function checkCollectionIndex(variable: VarState, index: unknown, fail: (message: string) => never): asserts index is number {
  if (!Array.isArray(variable.value)) fail(`variable \`${variable.name}\` is not a list.`);
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= variable.value.length) {
    fail(`index ${String(index)} is outside \`${variable.name}\` (length ${variable.value.length}); use a zero-based index.`);
  }
}
