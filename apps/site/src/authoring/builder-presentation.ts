import { formatValue, isReference } from '../../../../packages/player/src/values';
import type { StoredValue } from 'code-loupe/lesson';
import type { Snapshot, BadgeState } from 'code-loupe/state';
import { actionDefinitions, record } from './actions';
import { formOf, type StepForm } from './lesson-document';

/** Only semantic validation errors with an existing step have a card target. */
export function problemStep(message: string, count: number): number | undefined {
  const match = /^Step ([1-9]\d*):/.exec(message), step = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(step) && step <= count && step > 0 ? step : undefined;
}

export function storedDisplay(snapshot: Snapshot, value: StoredValue, language: string, type?: string): string {
  if (isReference(value)) {
    const object = snapshot.heap.find(item => item.id === value.ref);
    return object && 'value' in object ? formatValue(object.value, language) : `→ ${value.ref}`;
  }
  return formatValue(value, language, type);
}
export function badgeDisplay(snapshot: Snapshot, badge: BadgeState, language: string): string {
  return storedDisplay(snapshot, badge.value, language, badge.type);
}

export function stepSummary(step: Record<string, unknown>, language: string): string {
  const form = formOf(step);
  if (!form) return `Advanced · ${Object.keys(step).filter(key => !['line', 'caption'].includes(key)).join(', ') || 'YAML'}`;
  const spec = step[form.action];
  const value = record(spec) ? spec.value : undefined;
  const shown = value === undefined ? 'latest badge' : formatValue(value as Parameters<typeof formatValue>[0], language, record(spec) ? spec.type as string | undefined : undefined);
  return actionDefinitions[form.action].summary(form, shown);
}

/** Compare the controls relevant to an action, avoiding warnings for no-op edits. */
function formSignature(form: StepForm) {
  const fields = actionDefinitions[form.action].fields;
  const result: Record<string, unknown> = { action:form.action, line:form.line, caption:form.caption };
  if (fields.over) {
    result.over = form.over;
    if (form.over) result.nth = form.nth;
  }
  if (fields.selection) result.selection = form.selection || '';
  if (fields.name) result.name = form.name;
  if (fields.source) result.source = form.source;
  if (fields.text) result.value = form.value;
  if (fields.typed === 'always' || (fields.typed === 'literal' && form.source === 'literal')) {
    result.kind = form.kind;
    if (form.kind === 'List') result.items = form.items ?? [];
    else if (form.kind !== 'None') result.value = form.value;
    if (form.kind === 'Number' && fields.numeric) result.numericType = form.numericType;
  }
  return JSON.stringify(result);
}
export function hasFormChanges(base: Record<string, unknown>, values: StepForm | { caption: string }): boolean {
  const form = formOf(base);
  return 'action' in values ? !form || formSignature(form) !== formSignature(values) : String(base.caption ?? '') !== values.caption;
}
