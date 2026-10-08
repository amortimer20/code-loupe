import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLesson, type Lesson, type Step } from '../src/lesson';
import { buildSnapshots } from '../src/state';
import { formatValue, inferType } from '../src/values';

const fixture = (steps: Step[]): Lesson => ({ language: 'python', code: 'n = numbers\nreturn n', steps });
const assign: Step = { line: 1, assign: { var: 'numbers', value: [2, 4, 6] } };

test('list iteration distinguishes indices, element bindings, accumulation, and exhaustion', () => {
  const lesson = parseLesson(readFileSync(new URL('../../../lessons/python/list-iteration/lesson.yaml', import.meta.url), 'utf8'));
  const states = buildSnapshots(lesson);
  assert.equal(states.length, 18);
  for (const [read, index, value, previousTotal, total] of [[3, 0, 2, 0, 2], [7, 1, 4, 2, 6], [11, 2, 6, 6, 12]]) {
    assert.deepEqual(states[read].selection, { name: 'numbers', frameId: 0, index });
    assert.deepEqual(states[read].events.badgeAdded?.from, { kind: 'var', name: 'numbers', frameId: 0, index });
    assert.equal(states[read + 1].vars.find(v => v.name === 'n')?.value, value);
    assert.equal(states[read + 1].vars.find(v => v.name === 'total')?.value, previousTotal);
    assert.equal(states[read + 3].vars.find(v => v.name === 'total')?.value, total);
    assert.deepEqual(states[read + 3].selection, states[read].selection);
  }
  assert.equal(states[15].selection, null);
  assert.equal(states[17].console.at(-1)?.text, '12\n');
  for (const state of states.slice(1)) assert.deepEqual(state.vars[0].value, [2, 4, 6]);
});

test('flat lists format their scalar elements in the lesson language, including empty lists', () => {
  assert.equal(formatValue([true, false, null, 'hi', 2], 'python'), '[True, False, None, "hi", 2]');
  assert.equal(formatValue([true, null], 'javascript'), '[true, null]');
  assert.equal(formatValue([], 'python'), '[]');
  assert.equal(inferType([], 'python'), 'list');
  assert.equal(inferType([], 'javascript'), 'array');
});

test('list values and selections in earlier snapshots are independent of later assignments', () => {
  const states = buildSnapshots(fixture([
    assign,
    { select: { var: 'numbers', index: 1 } },
    { badge: { over: 'numbers', value: [2, 4, 6] } },
    { assign: { var: 'copy', from: 'badge' } },
    { assign: { var: 'numbers', value: [] } },
  ]));
  assert.equal(states[5].selection, null);
  assert.deepEqual(states[2].selection, { name: 'numbers', frameId: 0, index: 1 });
  const copy = states[4].vars.find(v => v.name === 'copy')!.value as number[];
  copy[0] = 99;
  assert.deepEqual(states[4].badges[0].value, [2, 4, 6]);
  assert.deepEqual(states[4].vars[0].value, [2, 4, 6]);
  assert.deepEqual(states[3].badges[0].value, [2, 4, 6]);
  assert.deepEqual(states[5].vars.find(v => v.name === 'copy')!.value, [2, 4, 6]);
});

test('list selection and indexed origins respect local shadowing and explicit global scope', () => {
  const states = buildSnapshots(fixture([
    assign,
    { call: { name: 'read', line: 2, over: 'numbers', args: [{ var: 'numbers', value: [9] }] } },
    { select: { var: 'numbers', index: 0 }, badge: { over: 'n', value: 9, from: { var: 'numbers', index: 0 } } },
    { select: { var: 'numbers', index: 2, scope: 'global' } },
    { select: { var: 'numbers', index: 0 } },
    { return: { value: 9 } },
  ]));
  assert.deepEqual(states[3].selection, { name: 'numbers', frameId: 1, index: 0 });
  assert.deepEqual(states[3].events.badgeAdded?.from, { kind: 'var', name: 'numbers', frameId: 1, index: 0 });
  assert.deepEqual(states[4].selection, { name: 'numbers', frameId: 0, index: 2 });
  assert.equal(states[6].selection, null);
  assert.deepEqual(states[3].frames[0].vars[0].value, [9]);
});

test('invalid lists, selections, and indexed origins fail with useful step errors', () => {
  const invalid: [Step[], RegExp][] = [
    [[assign, { select: { var: 'missing', index: 0 } }], /Step 2:.*no variable/],
    [[assign, { select: { var: 'numbers', index: -1 } }], /Step 2:.*zero-based/],
    [[assign, { select: { var: 'numbers', index: 3 } }], /Step 2:.*length 3/],
    [[assign, { select: { var: 'numbers', index: 0.5 } }], /Step 2:.*outside/],
    [[assign, { badge: { over: 'numbers', value: 2, from: { var: 'numbers', index: 5 } } }], /Step 2:.*outside/],
    [[{ assign: { var: 'numbers', value: [] } }, { select: { var: 'numbers', index: 0 } }], /Step 2:.*length 0/],
    [[{ assign: { var: 'numbers', value: 2 } }, { select: { var: 'numbers', index: 0 } }], /Step 2:.*not a list/],
  ];
  for (const [steps, error] of invalid) assert.throws(() => buildSnapshots(fixture(steps)), error);
  for (const action of ['assign', 'badge', 'convert']) {
    const raw = `language: python\ncode: n = numbers\nsteps:\n  - line: 1\n    badge: { over: numbers, value: 2 }\n  - ${action}: { ${action === 'assign' ? 'var: numbers, ' : action === 'badge' ? 'over: numbers, ' : ''}value: [[2]] }\n`;
    assert.throws(() => buildSnapshots(parseLesson(raw)), /Step 2:.*flat list/);
  }
});
