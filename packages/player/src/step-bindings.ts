import type { AssignSpec, ObjectReference, ScalarValue, StoredValue, Value } from './lesson';
import { cloneValue, inferType, isReference, validateValue } from './values';
import type { StepContext } from './step-context';

type BindingSpec = Omit<AssignSpec, 'var'>;

/** Read a literal or the latest badge. List references pass through only when `allowListReference` is set. */
export function readValue(ctx: StepContext, spec: BindingSpec, label: string): { value: Value; type: string; fromBadge?: number };
export function readValue(ctx: StepContext, spec: BindingSpec, label: string, allowListReference: true): { value: StoredValue; type: string; fromBadge?: number };
export function readValue(ctx: StepContext, spec: BindingSpec, label: string, allowListReference = false): { value: StoredValue; type: string; fromBadge?: number } {
  const { s, fail, lang } = ctx;
  if (spec.from !== undefined && spec.from !== 'badge') fail(`${label} \`from\` must be \`badge\`.`);
  const badge = spec.from === 'badge' ? (s.badges.at(-1) ?? fail(`${label} uses \`from: badge\` but there is no badge.`)) : undefined;
  const value = spec.value !== undefined ? spec.value : badge?.value;
  if (value === undefined) return fail(`${label} needs a \`value\` (or \`from: badge\`).`);
  if (allowListReference && badge && spec.value === undefined && isReference(value) && s.heap.some(object => object.id === value.ref && 'value' in object)) {
    if (spec.type !== undefined) fail('reference bindings cannot override the object type.');
    return { value: { ...value }, type: badge.type, fromBadge: badge.id };
  }
  validateValue(value, fail, label);
  if (spec.type !== undefined && (typeof spec.type !== 'string' || !spec.type.length)) fail(`${label} \`type\` must be nonempty text.`);
  return {
    value: cloneValue(value),
    type: spec.type ?? (spec.value !== undefined ? inferType(value as Value, lang) : badge!.type),
    fromBadge: badge?.id,
  };
}

/** Read what a variable or parameter will hold: a scalar, or a reference (allocating a list for a list literal). */
export function readBinding(ctx: StepContext, spec: BindingSpec, label: string): { value: ScalarValue | ObjectReference; type: string; fromBadge?: number } {
  const { s, fail, build } = ctx;
  const badge = spec.from === 'badge' && spec.value === undefined ? s.badges.at(-1) : undefined;
  if (spec.ref === undefined && badge && isReference(badge.value)) {
    if (spec.type !== undefined) fail('reference bindings cannot override the object type.');
    const object = s.heap.find(item => item.id === (badge.value as { ref: string }).ref)!;
    return { value: cloneValue(badge.value), type: object.type, fromBadge: badge.id };
  }
  if (spec.ref === undefined) {
    const result = readValue(ctx, spec, label);
    if (!Array.isArray(result.value)) return { ...result, value: result.value };
    let n = 1;
    while (s.heap.some(object => object.id === `list-${n}`)) n++;
    const id = `list-${n}`;
    s.heap.push({ id, value: [...result.value], type: result.type });
    build.autoAllocated.add(id);
    return { ...result, value: { ref: id } };
  }
  if (typeof spec.ref !== 'string' || !spec.ref.length) fail(`${label} \`ref\` must be nonempty text.`);
  if (spec.value !== undefined || spec.from !== undefined || spec.type !== undefined) fail(`${label} \`ref\` cannot be combined with value, from, or type.`);
  const object = s.heap.find(item => item.id === spec.ref) ?? fail(`object \`${spec.ref}\` has not been allocated.`);
  return { value: { ref: object.id }, type: object.type };
}
