import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { parseLesson } from 'code-loupe/lesson';
import { buildSnapshots } from 'code-loupe/state';
import { addStep, appendStepForm, newStepForm, deleteStep, editCaption, editDetails, editStep, formOf, newLesson, prefixSnapshot, readDocument, scalarBindings, stepsOf, type StepForm } from '../src/authoring/lesson-document';

const corpus = new URL('../../../lessons/python/', import.meta.url);
const sample = (name: string) => readFileSync(new URL(`${name}/lesson.yaml`, corpus), 'utf8');
const fixture = 'language: python\ncode: |\n  x\nsteps:\n  - line: 1\n    badge: { over: x, value: 0 }\n';
function edit(source: string, index: number, fields: Partial<StepForm>) {
  const step = stepsOf(readDocument(source))[index];
  return editStep(source, index, { ...formOf(step)!, ...fields }, JSON.stringify(step));
}

test('all canonical lessons retain exact bytes on no-edit builder round trips', () => {
  const names = readdirSync(corpus); assert.equal(names.length, 24);
  for (const name of names) {
    const source = sample(name), doc = readDocument(source);
    assert.deepEqual(doc.toJS(), parse(source));
    assert.equal(editDetails(source, { title: String(doc.get('title') ?? ''), language: String(doc.get('language')), code: String(doc.get('code')) }), source);
    stepsOf(doc).forEach((step, index) => {
      const form = formOf(step);
      assert.equal(form ? editStep(source, index, form, JSON.stringify(step)) : editCaption(source, index, String(step.caption ?? ''), JSON.stringify(step)), source);
    });
  }
});

test('advanced captions preserve every action, comments, quoted text, code and float tags', () => {
  for (const name of readdirSync(corpus)) {
    const source = sample(name), before = parse(source), steps = stepsOf(readDocument(source));
    for (let index = 0; index < steps.length; index++) {
      const next = editCaption(source, index, 'A revised explanation.', JSON.stringify(steps[index]));
      const expected = structuredClone(before); expected.steps[index].caption = 'A revised explanation.';
      assert.deepEqual(parse(next), expected, `${name} step ${index + 1}`);
      const snapshots = buildSnapshots(parseLesson(next));
      assert.deepEqual(snapshots.map(s => ({ ...s, caption: null })), buildSnapshots(parseLesson(source)).map(s => ({ ...s, caption: null })));
    }
  }
  const source = '# teaching note\n' + fixture.replace('value: 0', 'value: 5.0, type: float') + '# final note\n';
  const next = edit(source, 0, { caption: 'Still a float.' });
  assert.match(next, /# teaching note/); assert.match(next, /# final note/);
  assert.equal(parse(next).steps[0].badge.type, 'float');
  assert.equal(parse(next).code, parse(source).code);
});

test('typed form values keep 1, "1", True and None distinct and preserve explicit floats', () => {
  for (const [kind, value, expected] of [['Number', '1', 1], ['Text', '1', '1'], ['Boolean', 'true', true], ['None', '', null]] as const) {
    const source = edit(fixture, 0, { kind, value });
    assert.equal(buildSnapshots(parseLesson(source)).at(-1)!.badges[0].value, expected);
  }
  assert.equal(parse(edit(fixture, 0, { value: '5', numericType: 'float' })).steps[0].badge.type, 'float');
  assert.throws(() => edit(fixture, 0, { value: '' }), /finite number/);
  assert.throws(() => edit(fixture, 0, { value: 'abc' }), /finite number/);
  assert.throws(() => edit(fixture, 0, { value: 'Infinity' }), /finite number/);
  assert.throws(() => edit(fixture, 0, { value: '1.5', numericType: 'int' }), /fractional/);
});

test('variable reads use authored prefix contents and active local scope, never later values', () => {
  const source = 'language: python\ncode: |\n  x = 3\n  print(x)\nsteps:\n  - line: 1\n    assign: { var: x, value: 3 }\n  - line: 2\n    badge: { over: x, value: 99, from: x }\n  - assign: { var: x, value: 9 }\n';
  const next = edit(source, 1, { caption: 'Read the current value.' });
  assert.equal(parse(next).steps[1].badge.value, 3);
  assert.equal(buildSnapshots(parseLesson(next))[2].badges[0].value, 3);
  const bindings = scalarBindings(prefixSnapshot(sample('nested-function-call'), 7));
  assert.ok(bindings.some(v => v.name === 'value'));
  assert.throws(() => edit(source, 1, { source: 'missing' }), /not available/);
});

test('unsafe documents, advanced actions, and stale forms cannot be silently simplified', () => {
  assert.throws(() => readDocument(fixture.replace('value: 0', 'value: &v 0')), /anchors/);
  assert.throws(() => readDocument(fixture + 'other: *missing\n'), /aliases/);
  assert.throws(() => readDocument('steps: [\n'), /syntax/);
  const step = stepsOf(readDocument(fixture))[0], form = formOf(step)!;
  const changed = edit(fixture, 0, { value: '2' });
  assert.throws(() => editStep(changed, 0, form, JSON.stringify(step)), /changed in YAML/);
  assert.equal(formOf({ assign: { var: 'x', value: [1] } }), null);
  assert.equal(formOf({ assign: { var: 'x', from: 'badge', value: 9 } }), null);
  assert.equal(formOf({ badge: { over: 'x', value: 1 }, assign: { var: 'x', from: 'badge' } }), null);
  assert.equal(formOf({ badge: { over: 'x', value: 1, from: 'numbers[0]' } }), null);
});

test('a blank lesson can become a complete arithmetic explanation through form edits', () => {
  let source = editDetails(newLesson, { title: 'Arithmetic', language: 'python', code: 'print(2 + 3)\n' });
  source = addStep(source, 'highlight');
  source = edit(source, 0, { caption: 'Evaluate the addition.' });
  source = addStep(source, 'badge');
  source = edit(source, 1, { over: '2 + 3', value: '5', caption: 'The sum is 5.' });
  source = addStep(source, 'print');
  source = edit(source, 2, { source: 'badge', value: '5', caption: 'Print the result.' });
  assert.equal(buildSnapshots(parseLesson(source)).at(-1)!.console.map(c => c.text).join(''), '5\n');
});


test('deleting steps preserves other actions and supports an empty list', () => {
  const source = sample('nested-function-call'), before = parse(source);
  const expected = structuredClone(before); expected.steps.splice(2, 1);
  const next = deleteStep(source, 2, JSON.stringify(before.steps[2]));
  assert.deepEqual(parse(next), expected);
  assert.throws(() => deleteStep(source, 2, '{}'), /changed in YAML/);
  assert.throws(() => deleteStep(source, -1, '{}'), /no longer available/);
  assert.throws(() => deleteStep(source, 999, '{}'), /no longer available/);
  const empty = deleteStep(fixture, 0, JSON.stringify(parse(fixture).steps[0]));
  assert.deepEqual(parse(empty).steps, []);
  assert.equal(buildSnapshots(parseLesson(empty)).length, 1);
});


test('new form candidates validate before becoming a single authored source edit', () => {
  const source = editDetails(newLesson, { title: 'Addition', language: 'python', code: 'print(2 + 3)\n' });
  assert.throws(() => appendStepForm(source, newStepForm('badge')), /expression text/);
  assert.throws(() => appendStepForm(source, { ...newStepForm('badge'), over: 'missing' }), /couldn't find/);
  assert.throws(() => appendStepForm(source, newStepForm('assign')), /variable name/);
  assert.throws(() => appendStepForm(source, { ...newStepForm('badge'), over: '2 + 3', value: 'NaN' }), /finite number/);
  assert.deepEqual(parse(source).steps, []);
  const next = appendStepForm(source, { ...newStepForm('badge'), over: '2 + 3', value: '5' });
  assert.equal(buildSnapshots(parseLesson(next)).at(-1)!.badges[0].value, 5);
  assert.equal(parse(next).steps.length, 1);
  assert.throws(() => appendStepForm(next, { ...newStepForm('print'), source: 'badge', value: 'unrelated' }), /badge/);
});
