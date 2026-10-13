import { isAlias, isMap, isNode, isScalar, isSeq, parseDocument, stringify, visit, type Document } from 'yaml';
import { parseLesson, type ScalarValue } from 'code-loupe/lesson';
import { buildSnapshots, type Snapshot } from 'code-loupe/state';

export type Action = 'highlight' | 'badge' | 'assign' | 'print';
export type ValueKind = 'Number' | 'Text' | 'Boolean' | 'None';
export interface StepForm {
  action: Action; line: string; caption: string; over: string; nth: string;
  source: string; name: string; kind: ValueKind; value: string; numericType: string;
}
export const actionLabels: Record<Action, string> = { highlight: 'Highlight a line', badge: 'Show a value', assign: 'Store a value', print: 'Print' };
export const newLesson = 'title: New lesson\nlanguage: python\ncode: |\n  # Write your code here.\nsteps: []\n';
export const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const scalar = (value: unknown): value is ScalarValue => value === null || ['string', 'number', 'boolean'].includes(typeof value);
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
  const actions = Object.keys(step).filter(key => key !== 'line' && key !== 'caption');
  if (actions.length > 1 || (actions.length && !['badge', 'assign', 'print'].includes(actions[0]))) return null;
  const action = (actions[0] ?? 'highlight') as Action;
  const spec = step[action];
  if (action === 'badge' && (!record(spec) || !knownKeys(spec, ['over', 'value', 'type', 'nth', 'from']) || !scalar(spec.value)
    || (spec.from !== undefined && !(typeof spec.from === 'string' && /^[A-Za-z_]\w*$/.test(spec.from) && spec.from !== 'console')))) return null;
  if (action === 'assign' && (!record(spec) || !knownKeys(spec, ['var', 'value', 'type', 'from']) || (spec.from !== 'badge' && !scalar(spec.value)))) return null;
  if (action === 'assign' && record(spec) && ((spec.from !== undefined && spec.from !== 'badge') || (spec.from === 'badge' && ('value' in spec || 'type' in spec)))) return null;
  if (action === 'print' && !(typeof spec === 'string' || (record(spec) && knownKeys(spec, ['text', 'from']) && typeof spec.text === 'string' && (spec.from === undefined || spec.from === 'badge')))) return null;
  const obj = record(spec) ? spec : {};
  if (obj.type !== undefined && !['int', 'float', 'str', 'bool', 'NoneType'].includes(String(obj.type))) return null;
  const value = obj.value;
  const kind: ValueKind = value === null ? 'None' : typeof value === 'boolean' ? 'Boolean' : typeof value === 'string' ? 'Text' : 'Number';
  if ('value' in obj && obj.type !== undefined && !({ Number: ['int', 'float'], Text: ['str'], Boolean: ['bool'], None: ['NoneType'] }[kind].includes(String(obj.type)))) return null;
  return { action, line: step.line === undefined ? '' : String(step.line), caption: String(step.caption ?? ''),
    over: String(obj.over ?? ''), nth: String(obj.nth ?? 1), name: String(obj.var ?? ''),
    source: action === 'print' ? (obj.from === 'badge' ? 'badge' : 'literal') : String(obj.from ?? 'literal'),
    kind, value: action === 'print' ? String(typeof spec === 'string' ? spec : obj.text) : value === null ? '' : String(value ?? ''),
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

function formValue(form: StepForm): ScalarValue {
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
  if (JSON.stringify(form) === JSON.stringify(formOf(step))) return source;
  const base = ['steps', index];
  if (form.line && (!Number.isInteger(Number(form.line)) || Number(form.line) < 1)) throw new Error('Choose a positive code line number.');
  setOptional(doc, [...base, 'line'], form.line ? Number(form.line) : undefined);
  setOptional(doc, [...base, 'caption'], form.caption || undefined);
  const previous = Object.keys(step).find(key => key !== 'line' && key !== 'caption');
  if (previous && previous !== form.action) doc.deleteIn([...base, previous]);
  if (form.action === 'highlight') return doc.toString();
  const path = [...base, form.action];
  if (!isMap(doc.getIn(path, true))) {
    const old = doc.getIn(path, true), next = doc.createNode({});
    if (isNode(old)) { next.comment = old.comment; next.commentBefore = old.commentBefore; }
    doc.setIn(path, next);
  }
  if (form.action === 'print') {
    doc.setIn([...path, 'text'], form.value);
    setOptional(doc, [...path, 'from'], form.source === 'badge' ? 'badge' : undefined);
    return doc.toString();
  }
  if (form.action === 'badge') {
    if (!form.over) throw new Error('Enter the expression text to place the badge over.');
    if (!Number.isInteger(Number(form.nth)) || Number(form.nth) < 1) throw new Error('Occurrence must be a positive integer.');
    doc.setIn([...path, 'over'], form.over);
    setOptional(doc, [...path, 'nth'], Number(form.nth) === 1 ? undefined : Number(form.nth));
  } else {
    if (!/^[A-Za-z_]\w*$/.test(form.name)) throw new Error('Enter a variable name, such as score.');
    doc.setIn([...path, 'var'], form.name);
  }
  let value: ScalarValue | undefined, type: string | undefined;
  if (form.action === 'badge' && form.source !== 'literal') {
    const variable = scalarBindings(prefixSnapshot(source, index)).find(item => item.name === form.source);
    if (!variable || !scalar(variable.value)) throw new Error('That scalar variable is not available before this step.');
    value = variable.value; type = variable.type;
    const old = step.badge;
    if (record(old) && old.from === form.source && typeof old.type === 'string') type = old.type;
  } else if (form.action === 'assign' && form.source === 'badge') {
    doc.deleteIn([...path, 'value']); doc.deleteIn([...path, 'type']);
    doc.setIn([...path, 'from'], 'badge');
    return doc.toString();
  } else {
    value = formValue(form);
    if (form.kind === 'Number' && form.numericType !== 'auto') type = form.numericType;
    const old = step[form.action];
    if (record(old) && ((form.kind === 'Text' && old.type === 'str') || (form.kind === 'Boolean' && old.type === 'bool') || (form.kind === 'None' && old.type === 'NoneType'))) type = String(old.type);
  }
  doc.setIn([...path, 'value'], value);
  setOptional(doc, [...path, 'type'], type);
  setOptional(doc, [...path, 'from'], form.source === 'literal' ? undefined : form.source);
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
  const specs: Record<Action, unknown> = { highlight: { line: 1 }, badge: { badge: { over: '', value: 0 } }, assign: { assign: { var: '', value: 0 } }, print: { print: '' } };
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
    source: 'literal', kind: 'Number', value: action === 'print' ? '' : '0', numericType: 'auto' };
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
