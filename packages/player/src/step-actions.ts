import type { OutputSpec } from './lesson';
import { normalizeAddress } from './address';
import { checkKeys, isRecord } from './validation';
import { cloneValue, formatValue, inferType, isReference, validateValue } from './values';
import { readBinding, readValue } from './step-bindings';
import { applyCall, applyReturn } from './step-calls';
import type { StepContext } from './step-context';
import type { BadgeState, ConsoleChunk } from './state';
import { appendCollectionElement, checkCollectionIndex, removeCollectionElement, replaceCollectionElement } from './visuals/collection-state';
import { activeScope, findVariable } from './visuals/call-stack-state';
import { badgeDisplayValue, collectionVariable, referenceIdentity, replaceObjectField, selectionMatches, storeCollectionValue } from './visuals/heap-state';
import { dictionaryField } from './visuals/dictionary-state';
import { instanceAttribute } from './visuals/instance-state';
import { programError } from './visuals/error-state';
import { checkBadgeSourceValue, resolveOrigin } from './visuals/source-value';

/** An unhandled program error ends execution; it is always a step of its own. */
export function applyError(ctx: StepContext) {
  const { step, s, previous, index, fail, checkLine, checkTarget } = ctx;
  if (Object.keys(step).some(key => key !== 'error' && key !== 'caption')) fail('`error` must be its own step (with an optional caption).');
  const error = programError(step.error, checkLine, checkTarget, fail);
  if (error.kind === 'syntax' && index !== 0) fail('a syntax error must be the first step: the program never starts.');
  s.error = error;
  s.line = error.line;
  s.badges = [];
  s.events.lineChanged = s.line !== previous.line;
}

/** Reject action combinations whose meaning would depend on processing order. */
export function validateStepShape({ step, fail }: StepContext) {
  if (step.call !== undefined || step.return !== undefined) {
    const action = step.call !== undefined ? 'call' : 'return';
    if (Object.keys(step).some(key => key !== action && key !== 'caption')) {
      fail(`\`${action}\` must be its own step (with an optional caption).`);
    }
  }
  if ([step.update, step.append, step.remove].filter(action => action !== undefined).length > 1) {
    fail('use only one collection mutation (`update`, `append`, or `remove`) per step.');
  }
  for (const action of ['print', 'write'] as const) {
    const spec = step[action];
    if (isRecord(spec) && spec.from === 'badge' && (step.badge !== undefined || step.convert !== undefined)) {
      fail(`\`${action}\` with \`from: badge\` can't share a step with \`badge\` or \`convert\`; put the ${action} in its own step so it uses the finished badge.`);
    }
  }
}

/** Create a list or flat dictionary with an author-chosen identity. */
function applyAllocate({ step, s, lang, build, fail }: StepContext) {
  if (step.allocate === undefined) return;
  const object = step.allocate;
  if (!isRecord(object)) fail('`allocate` needs a mapping with id and value.');
  checkKeys(object, ['id', 'value', 'fields', 'class'], 'allocate', fail);
  if (typeof object.id !== 'string' || !object.id.length) fail('`allocate.id` must be nonempty text.');
  if (s.heap.some(item => item.id === object.id)) fail(`object \`${object.id}\` already exists${build.autoAllocated.has(object.id) ? ' (created automatically by a list binding)' : ''}; allocate a new id.`);
  if ('class' in object && (typeof object.class !== 'string' || !object.class.length)) fail('`allocate.class` must be nonempty text.');
  if ('class' in object && !('fields' in object)) fail('class instances require `fields`, not list values.');
  if ('fields' in object) {
    if ('value' in object) fail('`allocate` accepts either value or fields, not both.');
    if (!isRecord(object.fields)) fail('`allocate.fields` must be a mapping of string keys to scalar values.');
    for (const [key, value] of Object.entries(object.fields)) {
      if (!key.length) fail('dictionary keys must be nonempty text.');
      validateValue(value, fail, 'dictionary field');
      if (Array.isArray(value)) fail('dictionary fields must be scalars; nested values are not supported.');
    }
    s.heap.push({ id: object.id, fields: { ...object.fields }, type: object.class ?? (['python', 'py'].includes(lang.toLowerCase()) ? 'dict' : 'object'), ...('class' in object ? { class: object.class } : {}) });
  } else {
    validateValue(object.value, fail, 'allocate');
    if (!Array.isArray(object.value)) fail('`allocate.value` must be a flat list.');
    s.heap.push({ id: object.id, value: [...object.value], type: inferType(object.value, lang) });
  }
}

/** Move the execution arrow; badges belong to the line being executed. */
function applyLine({ step, s, checkLine }: StepContext) {
  if (step.line === undefined) return;
  checkLine(step.line);
  if (step.line !== s.line) {
    s.badges = [];
    s.events.lineChanged = true;
  }
  s.line = step.line;
}

/** Mark one list cell until another selection or `select: null`. */
function applySelect({ step, s, fail }: StepContext) {
  if (step.select === undefined) return;
  if (step.select === null) s.selection = null;
  else {
    const target = normalizeAddress(step.select, 'select', fail);
    if (target.index === undefined) fail('`select` needs an index accessor, e.g. numbers[1].');
    const origin = resolveOrigin(target, s, fail);
    if (origin?.kind === 'var' && origin.index !== undefined) {
      s.selection = { name: origin.name, frameId: origin.frameId, index: origin.index, ref: origin.ref! };
    } else fail('`select` needs a variable and index.');
  }
}

/** `write`, `print`, and `input` change the console, in that order. */
function applyConsole(ctx: StepContext) {
  const { step, s, lang, fail } = ctx;
  const output = (spec: OutputSpec, newline: string) => {
    if (isRecord(spec)) checkKeys(spec, ['text', 'from'], 'output', fail);
    const { text, from } = typeof spec === 'object' && spec !== null ? spec : { text: spec, from: undefined };
    if (text === undefined) fail('output needs `text`, e.g. `print: { text: Hi, from: badge }`.');
    const chunk: ConsoleChunk = { kind: 'out', text: `${text}${newline}` };
    if (from === 'badge') {
      const badge = s.badges.at(-1) ?? fail('`from: badge` but there is no badge to print.');
      const value = badgeDisplayValue(s, badge.value);
      if (isReference(value)) fail('printing reference badges is not supported; read a scalar attribute first.');
      const printed = typeof value === 'string' ? value : formatValue(value, lang, badge.type);
      if (!String(text).includes(printed)) {
        fail(`output badge holds ${formatValue(value, lang, badge.type)}, but the given text ${JSON.stringify(String(text))} does not contain its printed form ${JSON.stringify(printed)}.`);
      }
      chunk.fromBadge = badge.id;
    }
    else if (from !== undefined) fail('output `from` must be `badge`.');
    s.console.push(chunk);
  };
  if (step.write !== undefined) output(step.write, '');
  if (step.print !== undefined) output(step.print, '\n');
  if (step.input !== undefined) s.console.push({ kind: 'in', text: String(step.input) });
}

/** Float a value above code, validating it against any variable it is read from. */
function applyBadge({ step, s, lang, build, fail, checkTarget }: StepContext) {
  if (step.badge === undefined) return;
  if (!isRecord(step.badge)) fail('`badge` needs a mapping with over and value.');
  checkKeys(step.badge, ['over', 'value', 'type', 'line', 'nth', 'from'], 'badge', fail);
  const { over, value } = step.badge;
  if (typeof over !== 'string') fail('`badge` needs `over`: the code the value floats above.');
  if (value === undefined) return fail('`badge` needs a `value`.');
  validateValue(value, fail, 'badge');
  const line = step.badge.line ?? s.line ?? fail('`badge` needs a `line` because no line is active yet.');
  const nth = step.badge.nth ?? 1;
  checkTarget(line, over, nth);
  const source = step.badge.from;
  const origin = resolveOrigin(source === undefined || source === 'console' ? source : normalizeAddress(source, 'from', fail), s, fail);
  if (origin?.kind === 'var') checkBadgeSourceValue(s, origin, value, lang, fail);
  const badge: BadgeState = { id: build.nextBadgeId++, line, over, nth, value: origin?.kind === 'var' && origin.ref !== undefined && origin.index === undefined && origin.key === undefined && origin.attribute === undefined
    ? { ref: origin.ref } : cloneValue(value), type: step.badge.type ?? inferType(value, lang) };
  s.badges.push(badge);
  s.events.badgeAdded = { id: badge.id, from: origin };
}

/** Change the latest badge into a new value, optionally moving it. */
function applyConvert({ step, s, lang, fail, checkTarget }: StepContext) {
  if (step.convert === undefined) return;
  if (!isRecord(step.convert)) fail('`convert` needs a mapping with value.');
  checkKeys(step.convert, ['value', 'type', 'over', 'line', 'nth'], 'convert', fail);
  const badge = s.badges.at(-1) ?? fail('`convert` needs a badge to convert. Add a `badge` step first.');
  if (isReference(badge.value)) fail('`convert` cannot transform an object reference badge.');
  if (step.convert.value === undefined) fail('`convert` needs a `value`.');
  validateValue(step.convert.value, fail, 'convert');
  const from = { ...badge, value: cloneValue(badge.value) };
  badge.value = cloneValue(step.convert.value);
  badge.type = step.convert.type ?? inferType(step.convert.value, lang);
  if (step.convert.over !== undefined) {
    badge.over = step.convert.over;
    badge.line = step.convert.line ?? badge.line;
    badge.nth = step.convert.nth ?? 1;
    checkTarget(badge.line, badge.over, badge.nth);
  }
  s.events.converted = { id: badge.id, from };
}

/** Bind a name in the active scope. */
function applyAssign(ctx: StepContext) {
  const { step, s, fail } = ctx;
  if (step.assign === undefined) return;
  if (!isRecord(step.assign)) fail('`assign` needs a mapping with var and value, from, or ref.');
  checkKeys(step.assign, ['var', 'value', 'type', 'from', 'ref'], 'assign', fail);
  const name = step.assign.var;
  if (typeof name !== 'string') fail('`assign` needs `var`: the variable name.');
  const { value, type, fromBadge } = readBinding(ctx, step.assign, 'assign');
  const { vars, frameId } = activeScope(s);
  if (s.selection?.name === name && s.selection.frameId === frameId) s.selection = null;
  const existing = vars.find((v) => v.name === name);
  if (existing) Object.assign(existing, { value, type });
  else vars.push({ name, value, type });
  s.events.assigned = { name, frameId, fromBadge, isNew: !existing };
}

/** Replace one existing list element, dictionary field, or instance attribute. */
function applyUpdate(ctx: StepContext) {
  const { step, s, fail } = ctx;
  if (step.update === undefined) return;
  if (!isRecord(step.update)) fail('`update` needs a mapping with target and value or from.');
  const update = { ...normalizeAddress(step.update, 'update', fail, ['value', 'from']), value: step.update.value, from: step.update.from };
  if (update.index === undefined && update.key === undefined && update.attribute === undefined) fail('`update` needs an accessor; use assign to rebind a name.');
  const found = findVariable(s, update.var, update.scope === 'global') ?? fail(`no variable named ${update.var} in the active scope or globals.`);
  const { value, fromBadge } = readValue(ctx, update, 'update');
  if ('attribute' in update) {
    if ('key' in update || 'index' in update) fail('`update.attribute` cannot combine with key or index.');
    const object = instanceAttribute(s, found.variable, update.attribute, false, fail);
    if (Array.isArray(value)) return fail('instance attributes need scalar values.');
    replaceObjectField(object, update.attribute!, value);
    s.events.updated = { name: update.var, frameId: found.frameId, attribute: update.attribute!, ref: object.id, fromBadge };
  } else if ('key' in update) {
    if ('index' in update) fail('`update` cannot combine key and index.');
    const object = dictionaryField(s, found.variable, update.key, fail);
    if (Array.isArray(value)) return fail('dictionary updates need a scalar field value.');
    replaceObjectField(object, update.key!, value);
    s.events.updated = { name: update.var, frameId: found.frameId, key: update.key!, ref: object.id, fromBadge };
  } else {
    checkCollectionIndex(collectionVariable(s, found.variable), update.index, fail);
    storeCollectionValue(s, found.variable, replaceCollectionElement(collectionVariable(s, found.variable), update.index, value, fail));
    s.events.updated = { name: update.var, frameId: found.frameId, index: update.index, fromBadge, ref: referenceIdentity(found.variable).ref! };
  }
}

/** Grow or shrink a list: `append` adds at the end, `remove` deletes by index. */
function applyListLength(ctx: StepContext) {
  const { step, s, fail } = ctx;
  for (const action of ['append', 'remove'] as const) {
    const authored = step[action];
    if (authored === undefined) continue;
    if (action === 'append' && !isRecord(authored)) fail('`append` needs a mapping with target and value or from.');
    const spec = normalizeAddress(authored, action, fail, action === 'append' ? ['value', 'from'] : []);
    if (action === 'append' && (spec.index !== undefined || spec.key !== undefined || spec.attribute !== undefined)) fail('`append` needs a bare name, not an accessor.');
    if (action === 'remove' && spec.index === undefined) fail('`remove` needs an index accessor, e.g. numbers[1].');
    const found = findVariable(s, spec.var, spec.scope === 'global') ?? fail(`no variable named ${spec.var} in the active scope or globals.`);
    if (action === 'append') {
      const { value, fromBadge } = readValue(ctx, step.append!, 'append');
      const items = appendCollectionElement(collectionVariable(s, found.variable), value, fail);
      storeCollectionValue(s, found.variable, items);
      s.events.appended = { name: spec.var, frameId: found.frameId, index: items.length - 1, fromBadge, ref: referenceIdentity(found.variable).ref! };
    } else {
      const index = spec.index!;
      storeCollectionValue(s, found.variable, removeCollectionElement(collectionVariable(s, found.variable), index, fail));
      s.events.removed = { name: spec.var, frameId: found.frameId, index, ref: referenceIdentity(found.variable).ref! };
      if (selectionMatches(s.selection, found.variable) && s.selection) {
        if (s.selection.index === index) s.selection = null;
        else if (s.selection.index > index) s.selection.index--;
      }
    }
  }
}

/**
 * Actions run in this order within one step. YAML key order never matters, so a
 * step with `badge` and `assign: { from: badge }` assigns the finished badge,
 * and console output happens before a same-step `badge` is created.
 */
export const STEP_ACTIONS: readonly ((ctx: StepContext) => void)[] = [
  applyAllocate,
  applyCall,
  applyReturn,
  applyLine,
  applySelect,
  applyConsole,
  applyBadge,
  applyConvert,
  applyAssign,
  applyUpdate,
  applyListLength,
];
