import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLesson, type Lesson, type Step } from '../src/lesson';
import { buildSnapshots } from '../src/state';
import { badgeDisplayValue, resolveVariableValue } from '../src/visuals/heap-state';

const fixture = (steps: Step[]): Lesson => ({ language: 'python', code: 'change(nums)\nreturn items', steps });
const literal: Step = { line: 1, assign: { var: 'nums', value: [1] } };
const read: Step = { badge: { over: 'nums', value: [1], from: 'nums' } };

test('implicit list bindings share whole-variable reads and restore earlier snapshots', () => {
  const states = buildSnapshots(fixture([
    literal, read, { assign: { var: 'b', from: 'badge' } },
    { append: { target: 'b', value: 2 } },
  ]));
  assert.deepEqual(states[4].vars.map(v => v.value), [{ ref: 'list-1' }, { ref: 'list-1' }]);
  assert.equal(states[4].heap.length, 1);
  for (const variable of states[4].vars) assert.deepEqual(resolveVariableValue(states[4], variable), [1, 2]);
  assert.deepEqual(badgeDisplayValue(states[4], states[4].badges[0].value), [1, 2]);
  for (const state of [states[3], states[2], states[1]]) {
    assert.deepEqual(resolveVariableValue(state, state.vars[0]), [1]);
  }
  assert.deepEqual(states[0].heap, []);
});

test('list arguments share mutation through a function, including return and backward restoration', () => {
  const states = buildSnapshots(fixture([
    literal, read,
    { call: { name: 'change', line: 2, over: 'change(nums)', args: [{ var: 'items', from: 'badge' }] } },
    { append: { target: 'items', value: 2 } },
    { return: { value: null } },
  ]));
  assert.deepEqual(states[4].frames[0].vars[0].value, states[4].vars[0].value);
  assert.deepEqual(resolveVariableValue(states[5], states[5].vars[0]), [1, 2]);
  assert.deepEqual(states[5].frames, []);
  for (const state of [states[4], states[3]]) {
    assert.deepEqual(resolveVariableValue(state, state.frames[0].vars[0]), state === states[4] ? [1, 2] : [1]);
  }
  assert.deepEqual(resolveVariableValue(states[2], states[2].vars[0]), [1]);
  assert.deepEqual(states[2].frames, []);
});

test('separate literal badges allocate separate objects only when bound', () => {
  const states = buildSnapshots(fixture([
    { line: 1, badge: { over: 'nums', value: [1] } },
    { assign: { var: 'a', from: 'badge' } },
    { badge: { over: 'nums', value: [1] } },
    { assign: { var: 'b', from: 'badge' } },
    { append: { target: 'b', value: 2 } },
  ]));
  assert.deepEqual(states[1].heap, []);
  assert.deepEqual(states[4].vars.map(v => v.value), [{ ref: 'list-1' }, { ref: 'list-2' }]);
  assert.deepEqual(states[5].heap.map(o => 'value' in o ? o.value : null), [[1], [1, 2]]);
  assert.deepEqual(states[4].badges.map(b => b.value), [[1], [1]]);
});

test('return passthrough preserves list identity; a literal return allocates on binding', () => {
  for (const passthrough of [true, false]) {
    const states = buildSnapshots(fixture([
      literal, read,
      { call: { name: 'change', line: 2, over: 'change(nums)', args: [{ var: 'items', from: 'badge' }] } },
      { badge: { over: 'items', value: [1], from: 'items' } },
      { return: passthrough ? { from: 'badge' } : { value: [1] } },
      { assign: { var: 'result', from: 'badge' } },
      { append: { target: 'result', value: 2 } },
    ]));
    assert.equal(states[5].heap.length, 1);
    assert.deepEqual(states[5].badges.at(-1)!.value, passthrough ? { ref: 'list-1' } : [1]);
    assert.equal(states[6].heap.length, passthrough ? 1 : 2);
    assert.deepEqual(states[6].vars[1].value, { ref: passthrough ? 'list-1' : 'list-2' });
    assert.deepEqual(resolveVariableValue(states[7], states[7].vars[0]), passthrough ? [1, 2] : [1]);
    assert.deepEqual(resolveVariableValue(states[4], states[4].frames[0].vars[0]), [1]);
  }
});

test('auto ids use the lowest free label and explicit collisions explain implicit allocation', () => {
  const states = buildSnapshots(fixture([
    { allocate: { id: 'list-1', value: [] } },
    { allocate: { id: 'list-3', fields: {} } },
    literal, { assign: { var: 'next', value: [] } },
  ]));
  assert.deepEqual(states[4].vars.map(v => v.value), [{ ref: 'list-2' }, { ref: 'list-4' }]);
  assert.throws(() => buildSnapshots(fixture([literal, { allocate: { id: 'list-1', value: [] } }])),
    /Step 2:.*already exists.*created automatically by a list binding/);
});

test('reference-backed list badges print contents, reject conversion, and validate current contents', () => {
  for (const action of ['print', 'write'] as const) {
    const states = buildSnapshots(fixture([literal, read, { [action]: { text: 'list: [1]', from: 'badge' } }]));
    assert.equal(states[3].console[0].text, 'list: [1]' + (action === 'print' ? '\n' : ''));
    assert.throws(() => buildSnapshots(fixture([literal, read, { [action]: { text: 'other', from: 'badge' } }])), /output badge holds \[1\]/);
  }
  assert.throws(() => buildSnapshots(fixture([literal, read, { convert: { value: [2] } }])), /cannot transform an object reference badge/);
  assert.throws(() => buildSnapshots(fixture([literal, { badge: { over: 'nums', value: [2], from: 'nums' } }])), /currently holds \[1\]/);
});

test('no global or local binding holds a plain array in any canonical snapshot', () => {
  const directory = new URL('../../../lessons/python/', import.meta.url);
  const names = readdirSync(directory);
  assert.equal(names.length, 24);
  for (const name of names) {
    const lesson = parseLesson(readFileSync(new URL(name + '/lesson.yaml', directory), 'utf8'));
    for (const snapshot of buildSnapshots(lesson)) {
      for (const variable of [...snapshot.vars, ...snapshot.frames.flatMap(frame => frame.vars)]) {
        assert.equal(Array.isArray(variable.value), false, name + ': ' + variable.name);
      }
    }
  }
});
