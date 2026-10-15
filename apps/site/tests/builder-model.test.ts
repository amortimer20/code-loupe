import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { hasFormChanges, stepSummary } from '../src/authoring/builder-presentation';
import { actionLabels, addStep, formOf, newLesson, newStepForm, type Action, type StepForm } from '../src/authoring/lesson-document';

/**
 * Characterization fixture for the builder's per-action model: which steps each action
 * recognizes, how new steps start, how saved steps are summarized, and which form fields
 * count as a change for each action. Refactors of how actions are defined must leave it
 * unchanged. Regenerate only for an intentional builder change, with
 * `UPDATE_BUILDER_MODEL=1 npm test --workspace @code-loupe/site`, then review the diff.
 */
const lessons = new URL('../../../lessons/python/', import.meta.url);
const fixture = new URL('./fixtures/builder-model.json', import.meta.url);

type Step = Record<string, unknown>;

// Hand-written steps around each action's boundaries: valid shapes, shapes the builder must
// refuse and leave to YAML, and combinations that are not one introductory action.
const edgeSteps: Step[] = [
  { line: 1 }, { caption: 'Only a caption.' }, { line: 2, caption: 'Both.' }, {},
  { badge: { over: 'x', value: 1 } }, { badge: { over: 'x', value: 1, type: 'int', nth: 2 } },
  { badge: { over: 'x', value: 1.5, type: 'float' } }, { badge: { over: 'x', value: 'a', type: 'str' } },
  { badge: { over: 'x', value: 1, type: 'str' } }, { badge: { over: 'x', value: 'a', type: 'bogus' } },
  { badge: { over: 'x', value: true } }, { badge: { over: 'x', value: null } }, { badge: { over: 'x', value: [1, 'a', true, null] } },
  { badge: { over: 'x', value: [[1]] } }, { badge: { over: 'x', value: 1, typo: true } }, { badge: { over: 'x' } }, { badge: 'x' },
  { badge: { over: 'x', value: 1, from: 'x' } }, { badge: { over: 'x', value: 1, from: 'x[0]' } },
  { badge: { over: 'x', value: 'abc', from: 'console' } }, { badge: { over: 'x', value: 1, from: 'console' } },
  { badge: { over: 'x', value: 1, from: { target: 'x' } } }, { badge: { over: 'x', value: 1, from: 'x["k"]' } },
  { badge: { over: 'x', value: 1 }, select: 'x[0]' }, { badge: { over: 'x', value: 1 }, select: null }, { badge: { over: 'x', value: 1 }, select: 'x' },
  { convert: { value: 1 } }, { convert: { value: 1, over: 'x' } }, { convert: { value: 1, over: 'x', nth: 2 } },
  { convert: { value: 1, nth: 2 } }, { convert: { value: 1, over: '' } }, { convert: { value: [1] } }, { convert: { value: 1, type: 'str' } },
  { assign: { var: 'x', value: 1 } }, { assign: { var: 'x', value: 1, type: 'float' } }, { assign: { var: 'x', value: 'a' } },
  { assign: { var: 'x', value: [1, 2] } }, { assign: { var: 'x', from: 'badge' } }, { assign: { var: 'x', value: 1, from: 'badge' } },
  { assign: { var: 'x', from: 'other' } }, { assign: { var: 'x', ref: 'list-1' } }, { assign: { var: 'x', from: 'badge', type: 'int' } },
  { print: 'hi' }, { print: { text: 'hi' } }, { print: { text: 'hi', from: 'badge' } }, { print: { text: 'hi', from: 'x' } },
  { print: { text: 5 } }, { print: { text: 'hi', extra: 1 } }, { write: 'prompt: ' }, { write: { text: 'p', from: 'badge' } },
  { input: 'abc' }, { input: '' }, { input: 5 },
  { update: { target: 'x[0]', value: 1 } }, { update: { target: 'x[0]', from: 'badge' } }, { update: { target: 'x[0]', value: 1, from: 'badge' } },
  { update: { target: 'x', value: 1 } }, { update: { target: 'x["k"]', value: 1 } }, { update: { target: 'x[0]' } },
  { update: { target: 'x[0]', value: [1] } }, { update: { target: 'x[0]', value: 1, scope: 'global' } },
  { append: { target: 'x', value: 1 } }, { append: { target: 'x', from: 'badge' } }, { append: { target: 'x', value: 1, from: 'badge' } },
  { append: { target: 'x[0]', value: 1 } }, { append: { target: 'x', value: [1] } }, { append: { target: 'x' } },
  { select: 'x[0]' }, { select: null }, { select: 'x' }, { select: 'x["k"]' },
  { remove: 'x[0]' }, { remove: 'x' }, { remove: null },
  { call: { name: 'f', line: 1, over: 'f()' } }, { return: { value: 1 } }, { allocate: { id: 'a', value: [] } },
  { error: { kind: 'runtime', name: 'E', message: 'm', line: 1 } },
  { print: 'a', badge: { over: 'x', value: 1 } }, { assign: { var: 'x', value: 1 }, update: { target: 'x[0]', value: 1 } },
];

// One change to each field a form can show. Only the fields an action uses may count as a change.
const variants: ((form: StepForm) => StepForm)[] = [
  form => ({ ...form, line: String(Number(form.line || 0) + 1) }),
  form => ({ ...form, caption: `${form.caption}!` }),
  form => ({ ...form, over: `${form.over}x` }),
  form => ({ ...form, nth: String(Number(form.nth) + 1) }),
  form => ({ ...form, name: `${form.name}x` }),
  form => ({ ...form, source: form.source === 'literal' ? 'badge' : 'literal' }),
  form => ({ ...form, kind: form.kind === 'Number' ? 'Text' : 'Number' }),
  form => ({ ...form, value: `${form.value}1` }),
  form => ({ ...form, numericType: form.numericType === 'auto' ? 'float' : 'auto' }),
  form => ({ ...form, selection: form.selection === 'clear' ? '' : 'clear' }),
  form => ({ ...form, items: [...(form.items ?? []), { kind: 'Number', value: '0' }] }),
];

function describe(step: Step) {
  const form = formOf(step);
  return {
    form, summary: stepSummary(step, 'python'),
    unchanged: form ? hasFormChanges(step, form) : null,
    changes: form ? variants.map(variant => hasFormChanges(step, variant(form)) ? '1' : '0').join('') : null,
  };
}

function currentModel() {
  const actions = Object.keys(actionLabels) as Action[];
  const canonical: Record<string, unknown> = {};
  for (const name of readdirSync(lessons).sort()) {
    const steps = (parse(readFileSync(new URL(`${name}/lesson.yaml`, lessons), 'utf8')) as { steps: Step[] }).steps;
    steps.forEach((step, index) => { canonical[`${name}#${index + 1}`] = describe(step); });
  }
  return {
    labels: actionLabels,
    added: Object.fromEntries(actions.map(action => [action, addStep(newLesson, action)])),
    newForms: Object.fromEntries(actions.map(action => [action, newStepForm(action)])),
    canonical,
    edges: edgeSteps.map(step => ({ step, ...describe(step) })),
  };
}

test('the builder model matches the checked-in fixture', () => {
  const current = JSON.parse(JSON.stringify(currentModel()));
  assert.ok(Object.keys(current.canonical).length > 200);
  if (process.env.UPDATE_BUILDER_MODEL === '1') {
    writeFileSync(fixture, JSON.stringify(current, null, 1) + '\n');
    return;
  }
  const expected = JSON.parse(readFileSync(fixture, 'utf8'));
  for (const section of ['labels', 'added', 'newForms'] as const) assert.deepEqual(current[section], expected[section], section);
  for (const key of Object.keys(expected.canonical)) assert.deepEqual(current.canonical[key], expected.canonical[key], key);
  assert.deepEqual(Object.keys(current.canonical), Object.keys(expected.canonical), 'canonical step set changed');
  current.edges.forEach((edge: unknown, index: number) => assert.deepEqual(edge, expected.edges[index], JSON.stringify(edgeSteps[index])));
  assert.equal(current.edges.length, expected.edges.length);
});
