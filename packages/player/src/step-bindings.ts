import type { AssignSpec, ObjectReference, ScalarValue, StoredValue, Value } from './lesson';
import { cloneValue, inferType, isReference, validateValue } from './values';
import type { BadgeState } from './state';
import type { StepContext } from './step-context';

type BindingSpec = Omit<AssignSpec, 'var'>;
interface LiteralResult { value: Value; type: string; fromBadge?: number }

/** Where a value comes from: its literal `value`, or the latest badge named by `from: badge`. */
function sourceOf(ctx: StepContext, spec: BindingSpec, label: string): { badge: BadgeState | undefined; value: StoredValue } {
  const { s, fail } = ctx;
  if (spec.from !== undefined && spec.from !== 'badge') fail(`${label} \`from\` must be \`badge\`.`);
  const badge = spec.from === 'badge' ? (s.badges.at(-1) ?? fail(`${label} uses \`from: badge\` but there is no badge.`)) : undefined;
  const value = spec.value !== undefined ? spec.value : badge?.value;
  if (value === undefined) return fail(`${label} needs a \`value\` (or \`from: badge\`).`);
  return { badge, value };
}

/** Validate and copy a scalar or flat list, inferring its type unless the lesson names one. */
function finishLiteral(ctx: StepContext, spec: BindingSpec, label: string, { badge, value }: { badge: BadgeState | undefined; value: StoredValue }): LiteralResult {
  const { fail, lang } = ctx;
  validateValue(value, fail, label);
  if (spec.type !== undefined && (typeof spec.type !== 'string' || !spec.type.length)) fail(`${label} \`type\` must be nonempty text.`);
  return {
    value: cloneValue(value),
    type: spec.type ?? (spec.value !== undefined ? inferType(value as Value, lang) : badge!.type),
    fromBadge: badge?.id,
  };
}

/** An element or field value for `update` and `append`: a literal or the latest badge, never a reference. */
export function readValue(ctx: StepContext, spec: BindingSpec, label: string): LiteralResult {
  return finishLiteral(ctx, spec, label, sourceOf(ctx, spec, label));
}

/** A `return` value. A badge holding a list reference passes through, so the caller receives the same object. */
export function readResult(ctx: StepContext, spec: BindingSpec, label: string): { value: StoredValue; type: string; fromBadge?: number } {
  const { s, fail } = ctx;
  const source = sourceOf(ctx, spec, label);
  const { badge, value } = source;
  if (badge && spec.value === undefined && isReference(value) && s.heap.some(object => object.id === value.ref && 'value' in object)) {
    if (spec.type !== undefined) fail('reference bindings cannot override the object type.');
    return { value: { ...value }, type: badge.type, fromBadge: badge.id };
  }
  return finishLiteral(ctx, spec, label, source);
}

/** What `assign` or a call parameter will hold: a scalar, or a reference (a list literal allocates its object). */
export function readBinding(ctx: StepContext, spec: BindingSpec, label: string): { value: ScalarValue | ObjectReference; type: string; fromBadge?: number } {
  const { s, fail, build } = ctx;
  if (spec.ref !== undefined) return bindExplicitReference(ctx, spec, label);
  const source = sourceOf(ctx, spec, label);
  if (source.badge && spec.value === undefined && isReference(source.value)) {
    if (spec.type !== undefined) fail('reference bindings cannot override the object type.');
    const object = s.heap.find(item => item.id === (source.value as { ref: string }).ref)!;
    return { value: cloneValue(source.value), type: object.type, fromBadge: source.badge.id };
  }
  const result = finishLiteral(ctx, spec, label, source);
  if (!Array.isArray(result.value)) return { ...result, value: result.value };
  let n = 1;
  while (s.heap.some(object => object.id === `list-${n}`)) n++;
  const id = `list-${n}`;
  s.heap.push({ id, value: [...result.value], type: result.type });
  build.autoAllocated.add(id);
  return { ...result, value: { ref: id } };
}

/** `ref: id` binds an object the lesson allocated, and cannot be mixed with a value source. */
function bindExplicitReference({ s, fail }: StepContext, spec: BindingSpec, label: string): { value: ObjectReference; type: string } {
  if (typeof spec.ref !== 'string' || !spec.ref.length) fail(`${label} \`ref\` must be nonempty text.`);
  if (spec.value !== undefined || spec.from !== undefined || spec.type !== undefined) fail(`${label} \`ref\` cannot be combined with value, from, or type.`);
  const object = s.heap.find(item => item.id === spec.ref) ?? fail(`object \`${spec.ref}\` has not been allocated.`);
  return { value: { ref: object.id }, type: object.type };
}
