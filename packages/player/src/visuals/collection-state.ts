import type { ScalarValue, Value } from '../lesson';

export interface CollectionSelection {
  name: string;
  frameId: number;
  index: number;
  ref?: string;
}

interface CollectionVariable { name: string; value: unknown }

/** Copy on update so earlier snapshots and other variable values stay intact. */
export function replaceCollectionElement(variable: CollectionVariable, index: number, value: Value, fail: (message: string) => never): ScalarValue[] {
  checkCollectionIndex(variable, index, fail);
  if (Array.isArray(value)) return fail('`update` needs a scalar element value; nested lists are not supported.');
  const items = [...variable.value as ScalarValue[]];
  items[index] = value;
  return items;
}

export function appendCollectionElement(variable: CollectionVariable, value: Value, fail: (message: string) => never): ScalarValue[] {
  if (!Array.isArray(variable.value)) return fail(`variable \`${variable.name}\` is not a list.`);
  if (Array.isArray(value)) return fail('`append` needs a scalar element value; nested lists are not supported.');
  return [...variable.value, value];
}

export function removeCollectionElement(variable: CollectionVariable, index: number, fail: (message: string) => never): ScalarValue[] {
  checkCollectionIndex(variable, index, fail);
  return (variable.value as ScalarValue[]).filter((_, position) => position !== index);
}

export function checkCollectionIndex(variable: CollectionVariable, index: unknown, fail: (message: string) => never): asserts index is number {
  if (!Array.isArray(variable.value)) fail(`variable \`${variable.name}\` is not a list.`);
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= variable.value.length) {
    fail(`index ${String(index)} is outside \`${variable.name}\` (length ${variable.value.length}); use a zero-based index.`);
  }
}
