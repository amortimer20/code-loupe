import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLesson, type Lesson, type Step } from '../src/lesson';
import { buildSnapshots } from '../src/state';
import { resolveVariableValue } from '../src/visuals/heap-state';

const fixture = (steps: Step[]): Lesson => ({ language: 'python', code: 'change(numbers)\nreturn numbers', steps });
const create: Step = { line: 1, allocate: { id: 'shared', value: [2, 4] }, assign: { var: 'numbers', ref: 'shared' } };

test('the aliasing lesson has two bindings, one object, and an append visible through both names', () => {
  const lesson = parseLesson(readFileSync(new URL('../../../lessons/python/list-aliasing/lesson.yaml', import.meta.url), 'utf8'));
  const states = buildSnapshots(lesson);
  assert.equal(states.length, 8);
  assert.equal(states[1].vars.length, 1);
  assert.equal(states[2].vars.length, 2);
  assert.deepEqual(states[2].vars.map(v => v.value), [{ ref: 'list-1' }, { ref: 'list-1' }]);
  assert.equal(states[4].heap.length, 1);
  assert.deepEqual(states[3].heap[0].value, [2, 4]);
  assert.deepEqual(states[4].heap[0].value, [2, 4, 6]);
  for (const variable of states[4].vars) assert.deepEqual(resolveVariableValue(states[4], variable), [2, 4, 6]);
  assert.equal(states[4].events.appended?.ref, 'list-1');
  assert.deepEqual(states[5].selection, { name: 'numbers', frameId: 0, index: 2, ref: 'list-1' });
  assert.equal(states[6].events.badgeAdded?.from?.kind, 'var');
  assert.equal(states[7].console.at(-1)?.text, '[2, 4, 6]\n');
});

test('the copying lesson preserves the original while its separate copy grows', () => {
  const lesson = parseLesson(readFileSync(new URL('../../../lessons/python/list-copying/lesson.yaml', import.meta.url), 'utf8'));
  const states = buildSnapshots(lesson);
  assert.equal(states.length, 10);
  assert.equal(states[1].heap.length, 1);
  assert.deepEqual(states[2].vars.map(v => v.value), [{ ref: 'list-1' }, { ref: 'list-2' }]);
  assert.deepEqual(states[2].heap.map(object => object.value), [[2, 4], [2, 4]]);
  assert.deepEqual(states[4].heap.map(object => object.value), [[2, 4], [2, 4, 6]]);
  assert.deepEqual(states[3].heap[1].value, [2, 4]);
  assert.equal(states[4].events.appended?.ref, 'list-2');
  assert.equal(states[5].selection?.ref, 'list-2');
  assert.deepEqual(states[6].badges.at(-1)?.value, [2, 4]);
  assert.deepEqual(states[8].badges.at(-1)?.value, [2, 4, 6]);
  assert.equal(states[6].events.badgeAdded?.from?.kind, 'var');
  assert.equal(states[8].events.badgeAdded?.from?.kind, 'var');
  assert.deepEqual(states[9].console.map(entry => entry.text), ['[2, 4]\n', '[2, 4, 6]\n']);
});

test('rebindings change a name, while distinct shared lists and earlier snapshots stay independent', () => {
  const states = buildSnapshots(fixture([
    create,
    { assign: { var: 'other', ref: 'shared' } },
    { allocate: { id: 'second', value: [2, 4] }, assign: { var: 'numbers', ref: 'second' } },
    { append: { var: 'other', value: 6 } },
    { update: { var: 'numbers', index: 0, value: 99 } },
    { assign: { var: 'other', value: 5 } },
  ]));
  assert.deepEqual(states[2].vars[0].value, { ref: 'shared' });
  assert.deepEqual(states[3].vars[0].value, { ref: 'second' });
  assert.deepEqual(states[4].heap.map(object => object.value), [[2, 4, 6], [2, 4]]);
  assert.deepEqual(states[5].heap.map(object => object.value), [[2, 4, 6], [99, 4]]);
  assert.deepEqual(states[2].heap[0].value, [2, 4]);
  assert.equal(states[6].vars[1].value, 5);
  assert.deepEqual(states[5].vars[1].value, { ref: 'shared' });
  assert.notEqual(states[2].heap[0].value, states[3].heap[0].value);
});

test('selection and indexed sources resolve shared identity when mutations use a different alias', () => {
  const states = buildSnapshots(fixture([
    create,
    { assign: { var: 'other', ref: 'shared' } },
    { select: { var: 'numbers', index: 1 } },
    { remove: { var: 'other', index: 0 } },
    { badge: { over: 'numbers', value: 4, from: { var: 'numbers', index: 0 } } },
    { remove: { var: 'other', index: 0 } },
    { append: { var: 'numbers', value: null } },
  ]));
  assert.equal(states[3].selection?.index, 1);
  assert.equal(states[4].selection?.index, 0);
  assert.equal(states[4].selection?.ref, 'shared');
  assert.deepEqual(states[5].events.badgeAdded?.from, { kind: 'var', name: 'numbers', frameId: 0, index: 0, ref: 'shared' });
  assert.equal(states[6].selection, null);
  assert.deepEqual(states[6].heap[0].value, []);
  assert.deepEqual(states[7].heap[0].value, [null]);
});

test('shared references in call parameters preserve identity across locals, globals, and return', () => {
  const states = buildSnapshots(fixture([
    create,
    { call: { name: 'change', line: 2, over: 'change(numbers)', args: [{ var: 'numbers', ref: 'shared' }] } },
    { append: { var: 'numbers', value: 6 } },
    { badge: { over: 'numbers', value: 6, from: { var: 'numbers', index: 2, scope: 'global' } } },
    { return: { value: null } },
  ]));
  assert.deepEqual(states[3].vars[0].value, { ref: 'shared' });
  assert.deepEqual(states[3].frames[0].vars[0].value, { ref: 'shared' });
  assert.deepEqual(states[3].heap[0].value, [2, 4, 6]);
  assert.deepEqual(states[2].heap[0].value, [2, 4]);
  assert.equal(states[3].events.appended?.frameId, 1);
  assert.equal(states[4].events.badgeAdded?.from?.kind, 'var');
  assert.deepEqual(states[5].frames, []);
  assert.deepEqual(states[5].heap[0].value, [2, 4, 6]);
});

test('ordinary list values keep their independent semantics when mixed with references', () => {
  const states = buildSnapshots(fixture([
    create,
    { assign: { var: 'plain', value: [2, 4] } },
    { badge: { line: 1, over: 'numbers', value: [2, 4], from: { var: 'numbers' } } },
    { assign: { var: 'illustration', from: 'badge' } },
    { append: { var: 'numbers', value: 6 } },
    { append: { var: 'plain', value: 8 } },
  ]));
  assert.deepEqual(states[6].heap[0].value, [2, 4, 6]);
  assert.deepEqual(states[6].vars[1].value, [2, 4, 8]);
  assert.deepEqual(states[6].vars[2].value, [2, 4]);
});

test('invalid allocations and reference bindings fail with useful step errors', () => {
  for (const [step, error] of [
    ['allocate: { id: shared, value: [9] }', /already exists/],
    ['allocate: { id: second, value: 9 }', /flat list/],
    ['allocate: { id: second, value: [[9]] }', /flat list/],
    ['allocate: { id: "", value: [] }', /nonempty/],
    ['allocate: { id: second, value: [.inf] }', /finite scalar/],
    ['allocate: { id: second, value: [], typo: true }', /unknown allocate key/],
    ['allocate: null', /needs a mapping/],
    ['assign: { var: other, ref: missing }', /not been allocated/],
    ['assign: { var: other, ref: 1 }', /nonempty/],
    ['assign: { var: other, ref: shared, value: [] }', /cannot be combined/],
    ['assign: { var: other, ref: shared, from: badge }', /cannot be combined/],
    ['assign: { var: other, ref: shared, type: list }', /cannot be combined/],
  ] as const) {
    const yaml = `language: python\ncode: change(numbers)\nsteps:\n  - allocate: { id: shared, value: [2, 4] }\n    assign: { var: numbers, ref: shared }\n  - ${step}\n`;
    assert.throws(() => buildSnapshots(parseLesson(yaml)), new RegExp(`Step 2:.*${error.source}`));
  }
});
