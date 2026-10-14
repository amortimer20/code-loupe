import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { parseLesson } from 'code-loupe/lesson';
import { buildSnapshots } from 'code-loupe/state';
import { insertStepForm, duplicateStep, moveStep, addStep, appendStepForm, newStepForm, deleteStep, editCaption, editDetails, editStep, formOf, newLesson, prefixSnapshot, latestConsoleInput, readDocument, scalarBindings, stepsOf, type StepForm } from '../src/authoring/lesson-document';

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
  const read = stepsOf(readDocument(source))[1];
  const refreshed = editStep(source, 1, formOf(read)!, JSON.stringify(read));
  assert.equal(parse(refreshed).steps[1].badge.value, 3);
});

test('unsafe documents, advanced actions, and stale forms cannot be silently simplified', () => {
  assert.throws(() => readDocument(fixture.replace('value: 0', 'value: &v 0')), /anchors/);
  assert.throws(() => readDocument(fixture + 'other: *missing\n'), /aliases/);
  assert.throws(() => readDocument('steps: [\n'), /syntax/);
  const step = stepsOf(readDocument(fixture))[0], form = formOf(step)!;
  const changed = edit(fixture, 0, { value: '2' });
  assert.throws(() => editStep(changed, 0, form, JSON.stringify(step)), /changed in YAML/);
  assert.equal(formOf({ assign: { var: 'x', value: [[1]] } }), null);
  assert.equal(formOf({ assign: { var: 'x', from: 'badge', value: 9 } }), null);
  assert.equal(formOf({ badge: { over: 'x', value: 1 }, assign: { var: 'x', from: 'badge' } }), null);
  assert.equal(formOf({ badge: { over: 'x', value: 1, from: 'numbers[0][1]' } }), null);
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


test('insertion validates at its position and preserves later authored steps', () => {
  const source = sample('naming-value'), before = parse(source);
  const form = { ...newStepForm('highlight'), line: '1', caption: 'Pause here.' };
  const next = insertStepForm(source, 1, form, JSON.stringify(before.steps));
  const expected = structuredClone(before); expected.steps.splice(1, 0, { line: 1, caption: 'Pause here.' });
  assert.deepEqual(parse(next), expected);
  assert.deepEqual(buildSnapshots(parseLesson(next)).at(-1)!.vars, buildSnapshots(parseLesson(source)).at(-1)!.vars);
  assert.throws(() => insertStepForm(source, 1, { ...newStepForm('assign'), name: 'score', value: '99' }), /doesn't match/);
  assert.throws(() => insertStepForm(source, 1, form, '[]'), /Steps changed/);
  assert.throws(() => insertStepForm(source, -1, form), /position/);
  assert.throws(() => insertStepForm(source, 99, form), /position/);
  assert.equal(parse(insertStepForm(newLesson, 0, form)).steps.length, 1);
});

test('duplication preserves saved YAML nodes, advanced actions and comments without sharing edits', () => {
  for (const name of readdirSync(corpus)) {
    const source = sample(name), before = parse(source);
    for (let index = 0; index < before.steps.length; index++) {
      const next = duplicateStep(source, index, JSON.stringify(before.steps[index]));
      const expected = structuredClone(before); expected.steps.splice(index + 1, 0, structuredClone(before.steps[index]));
      assert.deepEqual(parse(next), expected, `${name} step ${index + 1}`);
    }
  }
  const source = fixture.replace('  - line: 1', '  - line: 1 # teacher note').replace('value: 0', 'value: 5.0, type: float');
  const next = duplicateStep(source, 0, JSON.stringify(parse(source).steps[0]));
  assert.equal(next.match(/# teacher note/g)?.length, 2);
  assert.equal(next.match(/5\.0/g)?.length, 2);
  assert.equal(next.match(/type: float/g)?.length, 2);
  const revised = editCaption(next, 1, 'Only the copy changes.', JSON.stringify(parse(next).steps[1]));
  assert.equal(parse(revised).steps[0].caption, undefined);
  assert.equal(parse(revised).steps[1].caption, 'Only the copy changes.');
  assert.throws(() => duplicateStep(source, 0, '{}'), /changed in YAML/);
  assert.throws(() => duplicateStep(source, 99, '{}'), /no longer available/);
});


test('moving saved steps preserves every corpus action and reports bounds and stale cards', () => {
  for (const name of readdirSync(corpus)) {
    const source = sample(name), before = parse(source);
    for (let index = 0; index + 1 < before.steps.length; index++) {
      const next = moveStep(source, index, 1, JSON.stringify(before.steps[index]));
      const expected = structuredClone(before);
      [expected.steps[index], expected.steps[index + 1]] = [expected.steps[index + 1], expected.steps[index]];
      assert.deepEqual(parse(next), expected, `${name} step ${index + 1}`);
      const restored = moveStep(next, index + 1, -1, JSON.stringify(before.steps[index]));
      assert.deepEqual(parse(restored), before);
    }
  }
  const source = sample('naming-value'), steps = parse(source).steps;
  assert.throws(() => moveStep(source, 0, -1, JSON.stringify(steps[0])), /cannot move further/);
  assert.throws(() => moveStep(source, steps.length - 1, 1, JSON.stringify(steps.at(-1))), /cannot move further/);
  assert.throws(() => moveStep(source, 0, 1, '{}'), /changed in YAML/);
  const broken = moveStep(source, 1, -1, JSON.stringify(steps[1]));
  assert.throws(() => buildSnapshots(parseLesson(broken)), /score/);
});

test('moving nodes retains their attached comments, quoted strings and float spelling', () => {
  const source = 'language: python\ncode: |\n  x\nsteps:\n  - line: 1 # first\n    badge: { over: "x", value: 5.0, type: float }\n  - line: 1 # second\n    caption: "keep these quotes"\n';
  const next = moveStep(source, 0, 1, JSON.stringify(parse(source).steps[0]));
  assert.ok(next.indexOf('# second') < next.indexOf('# first'));
  assert.match(next, /value: 5\.0/);
  assert.match(next, /caption: "keep these quotes"/);
  assert.match(next, /over: "x"/);
});


test('numeric input can be built entirely from forms with the same snapshots as the canonical lesson', () => {
  const canonical = sample('numeric-input'), doc = readDocument(canonical);
  let source = editDetails(newLesson, { title: String(doc.get('title')), language: 'python', code: String(doc.get('code')) });
  for (const step of stepsOf(doc)) {
    const form = formOf(step); assert.ok(form, JSON.stringify(step));
    source = appendStepForm(source, form);
  }
  assert.deepEqual(buildSnapshots(parseLesson(source)), buildSnapshots(parseLesson(canonical)));
  assert.equal(parse(source).steps[1].input, '30');
  assert.equal(typeof parse(source).steps[2].badge.value, 'string');
  assert.equal(typeof parse(source).steps[5].convert.value, 'number');
  assert.equal(parse(source).steps[5].convert.from, undefined);
});

test('console reads use the latest authored input, including empty and whitespace text', () => {
  const base = editDetails(newLesson, { title: 'Input', language: 'python', code: 'input()\n' });
  assert.throws(() => appendStepForm(base, { ...newStepForm('badge'), source: 'console', over: 'input()' }), /entered-text/);
  for (const text of ['', '30', '  hello  ', 'True']) {
    let source = appendStepForm(base, { ...newStepForm('input'), value: 'earlier' });
    source = appendStepForm(source, { ...newStepForm('input'), value: text });
    source = appendStepForm(source, { ...newStepForm('badge'), source: 'console', over: 'input()', value: 'ignored' });
    const last = buildSnapshots(parseLesson(source)).at(-1)!;
    assert.equal(latestConsoleInput(last), text);
    assert.equal(last.badges.at(-1)!.value, text);
    assert.equal(last.badges.at(-1)!.type, 'str');
    const changed = edit(source, 1, { value: 'new response' });
    const read = stepsOf(readDocument(changed))[2];
    const refreshed = editStep(changed, 2, formOf(read)!, JSON.stringify(read));
    assert.equal(buildSnapshots(parseLesson(refreshed)).at(-1)!.badges.at(-1)!.value, 'new response');
  }
});

test('conversion keeps or changes a badge target, preserves typed results and rejects missing badges', () => {
  const base = editDetails(newLesson, { title: 'Convert', language: 'python', code: 'int(text) + int(text)\n' });
  assert.throws(() => appendStepForm(base, newStepForm('convert')), /needs a badge/);
  const badge = appendStepForm(base, { ...newStepForm('badge'), over: 'text', kind: 'Text', value: '30' });
  const unchangedTarget = appendStepForm(badge, { ...newStepForm('convert'), value: '30' });
  const kept = buildSnapshots(parseLesson(unchangedTarget)).at(-1)!.badges.at(-1)!;
  assert.equal(kept.over, 'text'); assert.equal(kept.value, 30);
  const moved = appendStepForm(badge, { ...newStepForm('convert'), over: 'int(text)', nth: '2', value: '30', numericType: 'float' });
  const result = buildSnapshots(parseLesson(moved)).at(-1)!.badges.at(-1)!;
  assert.equal(result.over, 'int(text)'); assert.equal(result.nth, 2); assert.equal(result.type, 'float');
  for (const [kind, value, expected] of [['Text','30','30'], ['Boolean','true',true], ['None','',null]] as const) {
    const next = appendStepForm(badge, { ...newStepForm('convert'), kind, value });
    assert.equal(buildSnapshots(parseLesson(next)).at(-1)!.badges.at(-1)!.value, expected);
  }
  assert.throws(() => appendStepForm(badge, { ...newStepForm('convert'), value: 'NaN' }), /finite number/);
  assert.equal(formOf({ convert: { value: 30, line: 2 } }), null);
  assert.equal(formOf({ convert: { value: [1] } }), null);
  assert.equal(formOf({ input: '30', assign: { var: 'x', value: 30 } }), null);
  assert.equal(formOf({ badge: { over:'x', from:'console', value:30 } }), null);
});

test('prompt and entered-text edits preserve whitespace, quotes and attached comments', () => {
  const source = 'language: python\ncode: |\n  input()\nsteps:\n  - line: 1\n    write: "Age: " # prompt\n  - input: "30" # response\n';
  const next = edit(source, 1, { value: ' 31 ', caption: 'Entered text.' });
  assert.equal(parse(next).steps[1].input, ' 31 ');
  assert.match(next, /# response/); assert.match(next, /# prompt/);
  const output = edit(next, 0, { value: 'Age please: ' });
  assert.equal(buildSnapshots(parseLesson(output))[1].console[0].text, 'Age please: ');
});


test('basic list lessons can be rebuilt from forms with identical snapshots', () => {
  for (const name of ['list-iteration', 'list-update']) {
    const canonical = sample(name), doc = readDocument(canonical);
    let source = editDetails(newLesson, { title: String(doc.get('title')), language: 'python', code: String(doc.get('code')) });
    for (const step of stepsOf(doc)) {
      const form = formOf(step); assert.ok(form, JSON.stringify(step));
      source = appendStepForm(source, form);
    }
    assert.deepEqual(buildSnapshots(parseLesson(source)), buildSnapshots(parseLesson(canonical)));
  }
});

test('list rows preserve scalar types, empty lists, comments and invalid pending numbers', () => {
  const source = 'language: python\ncode: |\n  numbers = [1, "1", True, None]\nsteps:\n  - line: 1\n    assign:\n      var: numbers\n      value:\n        - 1 # keep item comment\n        - "1"\n        - true\n        - null\n';
  const form = formOf(stepsOf(readDocument(source))[0])!;
  assert.equal(form.kind, 'List');
  assert.equal(editStep(source, 0, form, JSON.stringify(parse(source).steps[0])), source);
  const next = edit(source, 0, { items: [{ ...form.items![0], value:'2' }, ...form.items!.slice(1)] });
  assert.deepEqual(parse(next).steps[0].assign.value, [2, '1', true, null]);
  assert.match(next, /# keep item comment/);
  const removed = edit(source, 0, { items:form.items!.slice(1) });
  assert.deepEqual(parse(removed).steps[0].assign.value, ['1', true, null]);
  assert.doesNotMatch(removed, /# keep item comment/);
  assert.throws(() => edit(source, 0, { items:[{ kind:'Number', value:'oops' }] }), /finite number/);
  assert.deepEqual(parse(edit(source, 0, { items:[] })).steps[0].assign.value, []);
  assert.equal(formOf({ badge:{ over:'x', value:[[1]] } }), null);
  assert.equal(formOf({ update:{ target:'numbers[0]', value:[1] } }), null);
  assert.equal(formOf({ update:{ target:'numbers[0]', value:1, scope:'global' } }), null);
});

test('list source reads refresh contents and updates preserve identity through backward snapshots', () => {
  let source = 'language: python\ncode: |\n  numbers[0]\nsteps:\n  - line: 1\n    assign: { var: numbers, value: [1, 2] }\n';
  source = appendStepForm(source, { ...newStepForm('badge'), source:'numbers[0]', over:'numbers[0]' });
  assert.equal(parse(source).steps[1].badge.value, 1);
  source = appendStepForm(source, { ...newStepForm('update'), name:'numbers[1]', value:'8' });
  source = appendStepForm(source, { ...newStepForm('badge'), source:'numbers', over:'numbers' });
  assert.deepEqual(parse(source).steps[3].badge.value, [1, 8]);
  const changed = edit(source, 2, { value:'9' });
  const step = stepsOf(readDocument(changed))[3];
  const refreshed = editStep(changed, 3, formOf(step)!, JSON.stringify(step));
  const snapshots = buildSnapshots(parseLesson(refreshed));
  assert.deepEqual(snapshots[1].heap[0], { id:'list-1', value:[1, 2], type:'list' });
  assert.deepEqual(snapshots.at(-1)!.heap[0], { id:'list-1', value:[1, 9], type:'list' });
  assert.throws(() => appendStepForm(source, { ...newStepForm('badge'), source:'numbers[9]', over:'numbers' }), /not available/);
  const combined = stepsOf(readDocument(sample('list-iteration')))[2];
  const onlyBadge = editStep(sample('list-iteration'), 2, { ...formOf(combined)!, selection:'', caption:'Read.' }, JSON.stringify(combined));
  assert.equal(parse(onlyBadge).steps[2].select, undefined);
  const highlighted = editStep(sample('list-iteration'), 2, { ...formOf(combined)!, action:'highlight' }, JSON.stringify(combined));
  assert.equal(parse(highlighted).steps[2].badge, undefined);
  assert.equal(parse(highlighted).steps[2].select, undefined);
});


test('whole-list source badges bind the same object through builder forms', () => {
  let source = 'language: python\ncode: |\n  numbers\nsteps:\n  - line: 1\n    assign: { var: numbers, value: [1, 2] }\n';
  source = appendStepForm(source, { ...newStepForm('badge'), source:'numbers', over:'numbers' });
  source = appendStepForm(source, { ...newStepForm('assign'), name:'other', source:'badge' });
  source = appendStepForm(source, { ...newStepForm('update'), name:'other[0]', value:'9' });
  const last = buildSnapshots(parseLesson(source)).at(-1)!;
  assert.deepEqual(last.vars.map(variable => variable.value), [{ ref:'list-1' }, { ref:'list-1' }]);
  assert.equal(last.heap.length, 1);
  assert.deepEqual(last.heap[0], { id:'list-1', value:[9, 2], type:'list' });
});
