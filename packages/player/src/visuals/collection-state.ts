import type { VarState } from '../state';

export interface CollectionSelection {
  name: string;
  frameId: number;
  index: number;
}

export function checkCollectionIndex(variable: VarState, index: unknown, fail: (message: string) => never): asserts index is number {
  if (!Array.isArray(variable.value)) fail(`variable \`${variable.name}\` is not a list.`);
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= variable.value.length) {
    fail(`index ${String(index)} is outside \`${variable.name}\` (length ${variable.value.length}); use a zero-based index.`);
  }
}
