import { isAlias, isMap, isNode, isScalar, isSeq, parseDocument, stringify, visit, type Document } from 'yaml';
import { parseLesson, type ScalarValue, type Value } from 'code-loupe/lesson';
import { buildSnapshots, type Snapshot } from 'code-loupe/state';

export type Action = 'highlight' | 'badge' | 'assign' | 'print' | 'write' | 'input' | 'convert' | 'update' | 'select' | 'append' | 'remove';
export type ValueKind = 'Number' | 'Text' | 'Boolean' | 'None' | 'List';
export interface ListItemForm { kind: Exclude<ValueKind, 'List'>; value: string; originalIndex?: number }
export interface StepForm {
  action: Action; line: string; caption: string; over: string; nth: string;
  source: string; name: string; kind: ValueKind; value: string; numericType: string; items?: ListItemForm[]; selection?: string;
}
export const actionLabels: Record<Action, string> = { highlight: 'Highlight a line', badge: 'Show a value', assign: 'Store a value', print: 'Print', write: 'Show a prompt', input: 'Show entered text', convert: 'Convert a value', update: 'Update a list element', select: 'Select a list element', append: 'Append an item', remove: 'Remove a list element' };
export const newLesson = 'title: New lesson\nlanguage: python\ncode: |\n  # Write your code here.\nsteps: []\n';
export const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const scalar = (value: unknown): value is ScalarValue => value === null || ['string', 'number', 'boolean'].includes(typeof value);
const list = (value: unknown): value is ScalarValue[] => Array.isArray(value) && value.every(scalar);
const listAddress = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z_]\w*\[\d+\]$/.test(value) && Number.isSafeInteger(Number(value.slice(value.indexOf('[') + 1, -1)));
const kindOf = (value: ScalarValue): ListItemForm['kind'] => value === null ? 'None' : typeof value === 'boolean' ? 'Boolean' : typeof value === 'string' ? 'Text' : 'Number';
const knownKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));

/** Edit the YAML document, never the player's normalized Lesson projection. */
export function readDocument(source: string) {
  const doc = parseDocument(source);
  if (doc.errors.length) throw new Error('Repair the YAML syntax before using Builder. Your source is preserved.');
  if (!isMap(doc.contents) || !isSeq(doc.get('steps', true))) throw new Error('Builder needs a lesson mapping with a steps list. Use YAML to repair it.');
  let unsupported = doc.warnings.length > 0;
  visit(doc, (_key, node) => {
    if (isAlias(node) || (isNode(node) && (node.anchor || (node.tag && !node.tag.startsWith('tag:yaml.org,2002:'))))) unsupported = true;
    if (isMap(node) && node.items.some(pair => !isScalar(pair.key) || typeof pair.key.value !== 'string')) unsupported = true;
  });
  if (unsupported) throw new Error('This draft uses anchors, aliases, tags, or mapping keys Builder cannot safely edit yet. Use YAML; nothing has been changed.');
  return doc;
}

export function stepsOf(doc: Document): Record<string, unknown>[] {
  const steps = doc.get('steps', true);
  if (!isSeq(steps)) return [];
  return steps.items.map(node => isMap(node) ? node.toJSON() as Record<string, unknown> : { unsupported: true });
}

export function formOf(step: Record<string, unknown>): StepForm | null {
  const combinedSelection = 'badge' in step && 'select' in step;
  if (combinedSelection && step.select !== null && !listAddress(step.select)) return null;
  const actions = Object.keys(step).filter(key => key !== 'line' && key !== 'caption' && !(combinedSelection && key === 'select'));
  if (actions.length > 1 || (actions.length && !['badge', 'assign', 'print', 'write', 'input', 'convert', 'update', 'select', 'append', 'remove'].includes(actions[0]))) return null;
  const action = (actions[0] ?? 'highlight') as Action;
  const spec = step[action];
  if (action === 'badge' && (!record(spec) || !knownKeys(spec, ['over', 'value', 'type', 'nth', 'from']) || !(scalar(spec.value) || list(spec.value))
    || (spec.from !== undefined && !(typeof spec.from === 'string' && (/^[A-Za-z_]\w*$/.test(spec.from) || listAddress(spec.from)))))) return null;
  if (action === 'badge' && record(spec) && spec.from === 'console' && typeof spec.value !== 'string') return null;
  if (action === 'convert' && (!record(spec) || !knownKeys(spec, ['over', 'value', 'type', 'nth']) || !scalar(spec.value) || (spec.over !== undefined && (typeof spec.over !== 'string' || !spec.over.length)) || (spec.over === undefined && spec.nth !== undefined))) return null;
  if (action === 'select' && spec !== null && !listAddress(spec)) return null;
  if (action === 'remove' && !listAddress(spec)) return null;
  if (action === 'append' && (!record(spec) || !knownKeys(spec, ['target', 'value', 'from']) || typeof spec.target !== 'string' || !/^[A-Za-z_]\w*$/.test(spec.target) || (spec.from === 'badge' ? 'value' in spec : spec.from !== undefined || !scalar(spec.value)))) return null;
  if (action === 'update' && (!record(spec) || !knownKeys(spec, ['target', 'value', 'from']) || !listAddress(spec.target) || (spec.from === 'badge' ? 'value' in spec : spec.from !== undefined || !scalar(spec.value)))) return null;
  if (action === 'input' && typeof spec !== 'string') return null;
  if (action === 'assign' && (!record(spec) || !knownKeys(spec, ['var', 'value', 'type', 'from']) || (spec.from !== 'badge' && !(scalar(spec.value) || list(spec.value))))) return null;
  if (action === 'assign' && record(spec) && ((spec.from !== undefined && spec.from !== 'badge') || (spec.from === 'badge' && ('value' in spec || 'type' in spec)))) return null;
  if (['print', 'write'].includes(action) && !(typeof spec === 'string' || (record(spec) && knownKeys(spec, ['text', 'from']) && typeof spec.text === 'string' && (spec.from === undefined || spec.from === 'badge')))) return null;
  const obj = record(spec) ? spec : {};
  if (obj.type !== undefined && !['int', 'float', 'str', 'bool', 'NoneType'].includes(String(obj.type))) return null;
  const value = obj.value;
  const kind: ValueKind = list(value) ? 'List' : kindOf(value as ScalarValue);
  if ('value' in obj && obj.type !== undefined && !({ Number: ['int', 'float'], Text: ['str'], Boolean: ['bool'], None: ['NoneType'], List: [] as string[] }[kind].includes(String(obj.type)))) return null;
  return { action, line: step.line === undefined ? '' : String(step.line), caption: String(step.caption ?? ''),
    over: String(obj.over ?? ''), nth: String(obj.nth ?? 1), name: ['select', 'remove'].includes(action) ? String(spec ?? '') : String(obj.target ?? obj.var ?? ''),
    source: action === 'convert' ? 'badge' : ['print', 'write'].includes(action) ? (obj.from === 'badge' ? 'badge' : 'literal') : String(obj.from ?? 'literal'),
    kind: action === 'input' ? 'Text' : kind, value: action === 'input' ? String(spec) : ['print', 'write'].includes(action) ? String(typeof spec === 'string' ? spec : obj.text) : value === null ? '' : String(value ?? ''),
    ...(list(value) ? { items: value.map((item, originalIndex) => ({ kind: kindOf(item), value: item === null ? '' : String(item), originalIndex })) } : {}),
    ...(combinedSelection ? { selection: step.select === null ? 'clear' : String(step.select) } : {}),
    numericType: obj.type === 'float' ? 'float' : obj.type === 'int' ? 'int' : 'auto' };
}

export function prefixSnapshot(source: string, index: number): Snapshot {
  const doc = readDocument(source), data = doc.toJS() as Record<string, unknown>;
  const steps = stepsOf(doc).slice(0, index);
  return buildSnapshots(parseLesson(stringify({ ...data, steps }))).at(-1)!;
}

export function scalarBindings(snapshot: Snapshot) {
  const seen = new Set<string>();
  // Match the player's active-frame lookup; paused callers are not visible scope.
  return [...(snapshot.frames.at(-1)?.vars ?? []), ...snapshot.vars].filter(variable => {
    if (seen.has(variable.name)) return false;
    seen.add(variable.name);
    return scalar(variable.value) && variable.name !== 'console';
  });
}

/** Active bindings and flat-list addresses available to introductory badge forms. */
export function badgeSources(snapshot: Snapshot): { name: string; value: Value; type?: string }[] {
  const seen = new Set<string>(), result: { name: string; value: Value; type?: string }[] = [];
  for (const variable of [...(snapshot.frames.at(-1)?.vars ?? []), ...snapshot.vars]) {
    if (seen.has(variable.name)) continue;
    seen.add(variable.name);
    const reserved = ['console', 'literal'].includes(variable.name);
    if (scalar(variable.value)) {
      if (!reserved) result.push({ name: variable.name, value: variable.value, type: variable.type });
    }
    else if (record(variable.value) && typeof variable.value.ref === 'string') {
      const ref = variable.value.ref;
      const object = snapshot.heap.find(item => item.id === ref);
      if (object && 'value' in object) {
        if (!reserved) result.push({ name: variable.name, value: [...object.value] });
        object.value.forEach((value, index) => result.push({ name: `${variable.name}[${index}]`, value }));
      }
    }
  }
  return result;
}

/** List targets include empty lists and reserved badge-source names. */
export function listBindings(snapshot: Snapshot) {
  const seen = new Set<string>();
  return [...(snapshot.frames.at(-1)?.vars ?? []), ...snapshot.vars].filter(variable => {
    if (seen.has(variable.name)) return false;
    seen.add(variable.name);
    if (!record(variable.value) || typeof variable.value.ref !== 'string') return false;
    const ref = variable.value.ref;
    return snapshot.heap.some(object => object.id === ref && 'value' in object);
  });
}

/** Input is always text, including empty input and digit-looking strings. */
export function latestConsoleInput(snapshot: Snapshot): string | undefined {
  return snapshot.console.findLast(chunk => chunk.kind === 'in')?.text;
}

/** Explicit Save refreshes a source read without evaluating the displayed code. */
function badgeSourceValue(source: string, index: number, form: StepForm, old: unknown): { value: Value; type?: string } {
  const snapshot = prefixSnapshot(source, index);
  if (form.source === 'console') {
    const value = latestConsoleInput(snapshot);
    if (value === undefined) throw new Error('Add an entered-text step before reading console input.');
    return { value, type: record(old) && old.from === 'console' && old.type === 'str' ? 'str' : undefined };
  }
  const address = form.source.replace(/\[(\d+)\]$/, (_match, index: string) => `[${Number(index)}]`);
  const variable = badgeSources(snapshot).find(item => item.name === address);
  if (!variable || !(scalar(variable.value) || list(variable.value))) throw new Error('That variable or list element is not available before this step.');
  const type = record(old) && old.from === form.source && typeof old.type === 'string' ? old.type : variable.type;
  return { value: variable.value, type };
}

function formValue(form: StepForm): Value {
  if (form.kind === 'List') return (form.items ?? []).map(item => formValue({ ...form, ...item, numericType: 'auto' }) as ScalarValue);
  if (form.kind === 'None') return null;
  if (form.kind === 'Text') return form.value;
  if (form.kind === 'Boolean') {
    if (!['true', 'false'].includes(form.value)) throw new Error('Choose True or False.');
    return form.value === 'true';
  }
  if (!form.value.trim() || !Number.isFinite(Number(form.value))) throw new Error('Enter a finite number.');
  const value = Number(form.value);
  if (form.numericType === 'int' && !Number.isInteger(value)) throw new Error('An integer cannot have a fractional part.');
  return value;
}

function setOptional(doc: Document, path: (string | number)[], value: unknown) {
  if (value === undefined) doc.deleteIn(path); else doc.setIn(path, value);
}

export function editStep(source: string, index: number, form: StepForm, expected: string): string {
  const doc = readDocument(source), steps = stepsOf(doc), step = steps[index];
  if (!step || JSON.stringify(step) !== expected) throw new Error('This step changed in YAML. Discard its form edits before saving changes.');
  if (!formOf(step)) throw new Error('Use YAML to edit this advanced action.');
  const sourced = form.action === 'badge' && form.source !== 'literal' ? badgeSourceValue(source, index, form, step.badge) : undefined;
  if (JSON.stringify(form) === JSON.stringify(formOf(step)) && (!sourced || (record(step.badge) && JSON.stringify(step.badge.value) === JSON.stringify(sourced.value)))) return source;
  const base = ['steps', index];
  if (form.line && (!Number.isInteger(Number(form.line)) || Number(form.line) < 1)) throw new Error('Choose a positive code line number.');
  setOptional(doc, [...base, 'line'], form.line ? Number(form.line) : undefined);
  setOptional(doc, [...base, 'caption'], form.caption || undefined);
  const previous = Object.keys(step).find(key => key !== 'line' && key !== 'caption' && !(key === 'select' && 'badge' in step));
  if (previous && previous !== form.action) doc.deleteIn([...base, previous]);
  if (form.action !== 'badge' && form.action !== 'select') doc.deleteIn([...base, 'select']);
  if (form.action === 'highlight') return doc.toString();
  if (form.action === 'badge') setOptional(doc, [...base, 'select'], !form.selection ? undefined : form.selection === 'clear' ? null : form.selection);
  else doc.deleteIn([...base, 'select']);
  const path = [...base, form.action];
  if (form.action === 'select' || form.action === 'remove') {
    if (form.action === 'remove' && !form.name) throw new Error('Choose a list element to remove.');
    if (form.name && !listAddress(form.name)) throw new Error('Choose a list element address, such as numbers[0].');
    doc.setIn(path, form.name || null); return doc.toString();
  }
  if (form.action === 'input') {
    const old = doc.getIn(path, true);
    // Updating the scalar in place retains quotes and attached comments.
    if (isScalar(old)) old.value = form.value;
    else doc.setIn(path, form.value);
    return doc.toString();
  }
  if (!isMap(doc.getIn(path, true))) {
    const old = doc.getIn(path, true), next = doc.createNode({});
    if (isNode(old)) { next.comment = old.comment; next.commentBefore = old.commentBefore; }
    doc.setIn(path, next);
  }
  if (['print', 'write'].includes(form.action)) {
    doc.setIn([...path, 'text'], form.value);
    setOptional(doc, [...path, 'from'], form.source === 'badge' ? 'badge' : undefined);
    return doc.toString();
  }
  if (form.action === 'append') {
    if (!/^[A-Za-z_]\w*$/.test(form.name)) throw new Error('Choose a list to append to.');
    doc.setIn([...path, 'target'], form.name);
    if (form.kind === 'List' && form.source !== 'badge') throw new Error('List items must be scalar values.');
  } else if (form.action === 'update') {
    if (!listAddress(form.name)) throw new Error('Choose a list element address, such as numbers[0].');
    doc.setIn([...path, 'target'], form.name);
    if (form.kind === 'List' && form.source !== 'badge') throw new Error('List elements must be scalar values.');
  } else if (['badge', 'convert'].includes(form.action)) {
    if (form.action === 'badge' && !form.over) throw new Error('Enter the expression text to place the badge over.');
    if ((form.action === 'badge' || form.over) && (!Number.isInteger(Number(form.nth)) || Number(form.nth) < 1)) throw new Error('Occurrence must be a positive integer.');
    setOptional(doc, [...path, 'over'], form.over || undefined);
    setOptional(doc, [...path, 'nth'], !form.over || Number(form.nth) === 1 ? undefined : Number(form.nth));
  } else {
    if (!/^[A-Za-z_]\w*$/.test(form.name)) throw new Error('Enter a variable name, such as score.');
    doc.setIn([...path, 'var'], form.name);
  }
  let value: Value | undefined, type: string | undefined;
  if (sourced) {
    value = sourced.value; type = sourced.type;
  } else if (['assign', 'update', 'append'].includes(form.action) && form.source === 'badge') {
    doc.deleteIn([...path, 'value']); doc.deleteIn([...path, 'type']);
    doc.setIn([...path, 'from'], 'badge');
    return doc.toString();
  } else {
    value = formValue(form);
    if (!['update', 'append'].includes(form.action) && form.kind === 'Number' && form.numericType !== 'auto') type = form.numericType;
    const old = step[form.action];
    if (record(old) && ((form.kind === 'Text' && old.type === 'str') || (form.kind === 'Boolean' && old.type === 'bool') || (form.kind === 'None' && old.type === 'NoneType'))) type = String(old.type);
  }
  const oldValue = doc.getIn([...path, 'value'], true);
  if (Array.isArray(value) && isSeq(oldValue)) {
    const originalItems = [...oldValue.items];
    const tracked = !sourced && form.items?.some(item => item.originalIndex !== undefined);
    oldValue.items = value.map((item, index) => {
      const originalIndex = tracked ? form.items?.[index].originalIndex : index;
      const node = originalIndex === undefined ? undefined : originalItems[originalIndex];
      if (isScalar(node)) { node.value = item; return node; }
      return doc.createNode(item);
    });
  } else doc.setIn([...path, 'value'], value);
  setOptional(doc, [...path, 'type'], type);
  if (form.action !== 'convert') setOptional(doc, [...path, 'from'], form.source === 'literal' ? undefined : form.source);
  return doc.toString();
}

export function editCaption(source: string, index: number, caption: string, expected: string): string {
  const doc = readDocument(source), steps = doc.get('steps', true);
  if (!isSeq(steps) || !isMap(steps.items[index])) throw new Error('Use YAML to repair this step.');
  if (JSON.stringify(stepsOf(doc)[index]) !== expected) throw new Error('This step changed in YAML. Discard its form edits before saving changes.');
  if (caption === String(stepsOf(doc)[index].caption ?? '')) return source;
  setOptional(doc, ['steps', index, 'caption'], caption || undefined);
  return doc.toString();
}

export function editDetails(source: string, values: { title: string; language: string; code: string }) {
  const doc = readDocument(source);
  if (!values.language.trim()) throw new Error('Enter a highlighting language, such as python.');
  if (values.title === String(doc.get('title') ?? '') && values.language === String(doc.get('language') ?? '') && values.code === String(doc.get('code') ?? '')) return source;
  setOptional(doc, ['title'], values.title || undefined);
  doc.set('language', values.language); doc.set('code', values.code);
  return doc.toString();
}

export function addStep(source: string, action: Action) {
  const doc = readDocument(source), steps = doc.get('steps', true);
  if (!isSeq(steps)) throw new Error('Use YAML to repair the steps list.');
  const specs: Record<Action, unknown> = { highlight: { line: 1 }, badge: { badge: { over: '', value: 0 } }, assign: { assign: { var: '', value: 0 } }, print: { print: '' }, write: { write: '' }, input: { input: '' }, convert: { convert: { value: 0 } }, update: { update: { target: 'numbers[0]', value: 0 } }, select: { select: null }, append: { append: { target: 'numbers', value: 0 } }, remove: { remove: 'numbers[0]' } };
  steps.add(doc.createNode(specs[action]));
  return doc.toString();
}

/** Removing a card preserves the authored data of every other step. */
export function deleteStep(source: string, index: number, expected: string) {
  const doc = readDocument(source), steps = doc.get('steps', true);
  if (!isSeq(steps) || !Number.isInteger(index) || index < 0 || index >= steps.items.length) throw new Error('That step is no longer available.');
  if (JSON.stringify(stepsOf(doc)[index]) !== expected) throw new Error('This step changed in YAML. Select it again before deleting it.');
  steps.items.splice(index, 1);
  return doc.toString();
}


export function newStepForm(action: Action): StepForm {
  return { action, line: '1', caption: '', over: '', nth: '1', name: '',
    source: action === 'convert' ? 'badge' : 'literal', kind: action === 'input' ? 'Text' : 'Number', value: ['print', 'write', 'input'].includes(action) ? '' : '0', numericType: 'auto' };
}

/** Build and validate a candidate without touching the shared draft. */
export function appendStepForm(source: string, form: StepForm): string {
  if (form.action === 'badge' && !form.over) throw new Error('Enter the expression text to place the badge over.');
  const candidate = addStep(source, form.action), index = stepsOf(readDocument(source)).length;
  const next = editStep(candidate, index, form, JSON.stringify(stepsOf(readDocument(candidate))[index]));
  buildSnapshots(parseLesson(next));
  return next;
}

/** Insert a validated introductory card at a saved-step boundary. */
export function insertStepForm(source: string, index: number, form: StepForm, expectedSteps?: string): string {
  const doc = readDocument(source), steps = doc.get('steps', true);
  if (!isSeq(steps) || !Number.isInteger(index) || index < 0 || index > steps.items.length) throw new Error('That insertion position is no longer available.');
  if (expectedSteps !== undefined && JSON.stringify(stepsOf(doc)) !== expectedSteps) throw new Error('Steps changed in YAML. Cancel this new card and choose its position again.');
  // Reuse the same form conversion as an appended card, but validate in place:
  // later steps can depend on the badge, line, or bindings this card changes.
  const candidate = readDocument(addStep(source, form.action));
  const items = candidate.get('steps', true);
  if (!isSeq(items)) throw new Error('Use YAML to repair the steps list.');
  items.items.splice(index, 0, items.items.pop()!);
  const next = editStep(candidate.toString(), index, form, JSON.stringify(stepsOf(candidate)[index]));
  buildSnapshots(parseLesson(next));
  return next;
}

/** Copy the saved YAML node, preserving comments, quoted values and advanced actions. */
export function duplicateStep(source: string, index: number, expected: string): string {
  const doc = readDocument(source), steps = doc.get('steps', true);
  if (!isSeq(steps) || !Number.isInteger(index) || index < 0 || index >= steps.items.length) throw new Error('That step is no longer available.');
  if (JSON.stringify(stepsOf(doc)[index]) !== expected) throw new Error('This step changed in YAML. Select it again before duplicating it.');
  const node = steps.items[index];
  if (!isMap(node)) throw new Error('Use YAML to repair this step.');
  steps.items.splice(index + 1, 0, node.clone());
  return doc.toString();
}

/** Reorder saved YAML nodes without rewriting actions or repairing dependencies. */
export function moveStep(source: string, index: number, direction: -1 | 1, expected: string): string {
  const doc = readDocument(source), steps = doc.get('steps', true), target = index + direction;
  if (!isSeq(steps) || !Number.isInteger(index) || ![-1, 1].includes(direction) || index < 0 || index >= steps.items.length || target < 0 || target >= steps.items.length) throw new Error('That step cannot move further in this direction.');
  if (JSON.stringify(stepsOf(doc)[index]) !== expected) throw new Error('This step changed in YAML. Select it again before moving it.');
  const [node] = steps.items.splice(index, 1);
  steps.items.splice(target, 0, node);
  return doc.toString();
}
