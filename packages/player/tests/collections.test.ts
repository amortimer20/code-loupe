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

test('element replacement preserves list length, neighbors, and earlier snapshots', () => {
  const lesson = parseLesson(readFileSync(new URL('../../../lessons/python/list-update/lesson.yaml', import.meta.url), 'utf8'));
  const states = buildSnapshots(lesson);
  assert.equal(states.length, 7);
  assert.deepEqual(states[2].vars[0].value, [2, 4, 6]);
  assert.deepEqual(states[3].vars[0].value, [2, 10, 6]);
  assert.equal(states[3].vars[0].type, 'list');
  assert.deepEqual(states[3].selection, { name: 'numbers', index: 1, frameId: 0 });
  assert.deepEqual(states[3].events.updated, { name: 'numbers', index: 1, frameId: 0, fromBadge: 1 });
  assert.equal(states[4].selection, null);
  assert.equal(states[6].console.at(-1)?.text, '[2, 10, 6]\n');
  const extra = buildSnapshots(fixture([assign, { update: { var: 'numbers', index: 0, value: null } }, { update: { var: 'numbers', index: 2, value: false } }]));
  assert.deepEqual(extra[1].vars[0].value, [2, 4, 6]);
  assert.deepEqual(extra[2].vars[0].value, [null, 4, 6]);
  assert.deepEqual(extra[3].vars[0].value, [null, 4, false]);
});

test('element updates resolve local shadowing and explicit or fallback globals without aliasing', () => {
  const states = buildSnapshots(fixture([
    assign,
    { call: { name: 'change', line: 2, over: 'numbers', args: [{ var: 'numbers', value: [9] }] } },
    { update: { var: 'numbers', index: 0, value: 8 } },
    { update: { var: 'numbers', index: 1, value: 10, scope: 'global' } },
    { return: { value: null } },
    { badge: { over: 'numbers', value: [2, 10, 6] } },
    { assign: { var: 'copy', from: 'badge' } },
    { update: { var: 'copy', index: 0, value: 99 } },
  ]));
  assert.deepEqual(states[3].frames[0].vars[0].value, [8]);
  assert.deepEqual(states[3].vars[0].value, [2, 4, 6]);
  assert.deepEqual(states[4].vars[0].value, [2, 10, 6]);
  assert.equal(states[3].events.updated?.frameId, 1);
  assert.equal(states[4].events.updated?.frameId, 0);
  assert.deepEqual(states[8].vars[0].value, [2, 10, 6]);
  assert.deepEqual(states[8].vars[1].value, [99, 10, 6]);
  const fallback = buildSnapshots(fixture([assign, { call: { name: 'change', line: 2, over: 'numbers' } }, { update: { var: 'numbers', index: 0, value: 7 } }]));
  assert.equal(fallback[3].events.updated?.frameId, 0);
  assert.deepEqual(fallback[3].vars[0].value, [7, 4, 6]);
});

test('invalid element updates fail rather than growing a list or accepting nested values', () => {
  for (const [update, error] of [
    ['{ var: numbers, index: 3, value: 10 }', /outside/],
    ['{ var: numbers, index: -1, value: 10 }', /zero-based/],
    ['{ var: numbers, index: 0.5, value: 10 }', /outside/],
    ['{ var: numbers, value: 10 }', /outside/],
    ['{ var: missing, index: 0, value: 10 }', /no variable/],
    ['{ var: numbers, index: 1 }', /needs a `value`/],
    ['{ var: numbers, index: 1, from: badge }', /no badge/],
    ['{ var: numbers, index: 1, from: console }', /must be `badge`/],
    ['{ var: numbers, index: 1, value: [10] }', /scalar element/],
    ['{ var: numbers, index: 1, value: .inf }', /finite scalar/],
    ['{ var: numbers, index: 1, value: 10, scope: local }', /scope/],
    ['{ var: numbers, index: 1, value: 10, typo: 1 }', /unknown update key/],
    ['null', /needs a mapping/],
  ] as const) {
    const yaml = `language: python\ncode: n = numbers\nsteps:\n  - assign: { var: numbers, value: [2, 4, 6] }\n  - update: ${update}\n`;
    assert.throws(() => buildSnapshots(parseLesson(yaml)), new RegExp(`Step 2:.*${error.source}`));
  }
  assert.throws(() => buildSnapshots(fixture([{ assign: { var: 'numbers', value: 2 } }, { update: { var: 'numbers', index: 0, value: 10 } }])), /Step 2:.*not a list/);
  assert.throws(() => buildSnapshots(fixture([assign, { line: 1, badge: { over: 'numbers', value: [10] } }, { update: { var: 'numbers', index: 1, from: 'badge' } }])), /Step 3:.*scalar element/);
});

test('append and removal lessons preserve earlier lists and publish their final output', () => {
  for (const [slug, before, after, event] of [
    ['list-append', [2, 4], [2, 4, 6], 'appended'],
    ['list-removal', [2, 4, 6], [2, 6], 'removed'],
  ] as const) {
    const states = buildSnapshots(parseLesson(readFileSync(new URL(`../../../lessons/python/${slug}/lesson.yaml`, import.meta.url), 'utf8')));
    assert.equal(states.length, 7);
    assert.deepEqual(states[2].vars[0].value, before);
    assert.deepEqual(states[3].vars[0].value, after);
    assert.equal(states[3].events[event]?.index, event === 'appended' ? 2 : 1);
    assert.equal(states[6].console.at(-1)?.text, `${formatValue([...after], 'python')}\n`);
  }
});

test('empty lists, null append, and first/middle/last deletions keep valid selections and independent values', () => {
  const states = buildSnapshots(fixture([
    { assign: { var: 'numbers', value: [] } },
    { append: { var: 'numbers', value: null } },
    { select: { var: 'numbers', index: 0 } },
    { append: { var: 'numbers', value: 4 } },
    { append: { var: 'numbers', value: 6 } },
    { select: { var: 'numbers', index: 2 } },
    { remove: { var: 'numbers', index: 0 } },
    { remove: { var: 'numbers', index: 1 } },
    { remove: { var: 'numbers', index: 0 } },
  ]));
  assert.deepEqual(states[1].vars[0].value, []);
  assert.deepEqual(states[2].vars[0].value, [null]);
  assert.equal(states[4].selection?.index, 0);
  assert.deepEqual(states[5].vars[0].value, [null, 4, 6]);
  assert.deepEqual(states[7].vars[0].value, [4, 6]);
  assert.equal(states[7].selection?.index, 1);
  assert.equal(states[6].selection?.index, 2);
  assert.deepEqual(states[8].vars[0].value, [4]);
  assert.equal(states[8].selection, null);
  assert.deepEqual(states[9].vars[0].value, []);
  const retained = buildSnapshots(fixture([assign, { select: { var: 'numbers', index: 0 } }, { remove: { var: 'numbers', index: 2 } }]));
  assert.equal(retained[3].selection?.index, 0);
});

test('append and removal resolve local/global scopes without mutating other lists or snapshots', () => {
  const states = buildSnapshots(fixture([
    assign,
    { call: { name: 'change', line: 2, over: 'numbers', args: [{ var: 'numbers', value: [9] }] } },
    { append: { var: 'numbers', value: 8 } },
    { remove: { var: 'numbers', index: 0 } },
    { append: { var: 'numbers', value: 10, scope: 'global' } },
    { remove: { var: 'numbers', index: 1, scope: 'global' } },
  ]));
  assert.deepEqual(states[2].frames[0].vars[0].value, [9]);
  assert.deepEqual(states[3].frames[0].vars[0].value, [9, 8]);
  assert.deepEqual(states[4].frames[0].vars[0].value, [8]);
  assert.deepEqual(states[6].vars[0].value, [2, 6, 10]);
  assert.deepEqual(states[6].frames[0].vars[0].value, [8]);
  assert.deepEqual(states[1].vars[0].value, [2, 4, 6]);
  assert.equal(states[3].events.appended?.frameId, 1);
  assert.equal(states[6].events.removed?.frameId, 0);
  const fallback = buildSnapshots(fixture([assign, { call: { name: 'change', line: 2, over: 'numbers' } }, { append: { var: 'numbers', value: 7 } }, { remove: { var: 'numbers', index: 0 } }]));
  assert.deepEqual(fallback[4].vars[0].value, [4, 6, 7]);
});

test('invalid append/removal operations fail with a step number', () => {
  for (const [action, spec, error] of [
    ['append', '{ var: numbers }', /needs a `value`/],
    ['append', '{ var: numbers, from: badge }', /no badge/],
    ['append', '{ var: numbers, value: [8] }', /scalar element/],
    ['append', '{ var: numbers, value: .inf }', /finite scalar/],
    ['append', '{ var: numbers, value: 8, index: 0 }', /unknown append key/],
    ['remove', '{ var: numbers, index: 3 }', /outside/],
    ['remove', '{ var: numbers, index: -1 }', /zero-based/],
    ['remove', '{ var: numbers, index: 0.5 }', /outside/],
    ['remove', '{ var: numbers }', /outside/],
    ['remove', '{ var: numbers, index: 0, value: 4 }', /unknown remove key/],
    ['remove', '{ var: numbers, index: 0, scope: local }', /scope/],
    ['append', '{ var: missing, value: 8 }', /no variable/],
    ['remove', '{ var: missing, index: 0 }', /no variable/],
    ['append', 'null', /needs a mapping/],
    ['remove', 'null', /needs a mapping/],
  ] as const) {
    assert.throws(() => buildSnapshots(parseLesson(`language: python\ncode: n = numbers\nsteps:\n  - assign: { var: numbers, value: [2, 4, 6] }\n  - ${action}: ${spec}\n`)), new RegExp(`Step 2:.*${error.source}`));
  }
  assert.throws(() => buildSnapshots(fixture([{ assign: { var: 'numbers', value: [] } }, { remove: { var: 'numbers', index: 0 } }])), /Step 2:.*length 0/);
  for (const mutation of [{ append: { var: 'numbers', value: 8 } }, { remove: { var: 'numbers', index: 0 } }]) {
    assert.throws(() => buildSnapshots(fixture([{ assign: { var: 'numbers', value: 2 } }, mutation])), /Step 2:.*not a list/);
  }
  assert.throws(() => buildSnapshots(fixture([assign, { append: { var: 'numbers', value: 8 }, remove: { var: 'numbers', index: 0 } }])), /Step 2:.*one collection mutation/);
});
