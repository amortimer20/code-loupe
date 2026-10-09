import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAddress } from '../src/address';
import { parseLesson, type Lesson, type Step } from '../src/lesson';
import { buildSnapshots } from '../src/state';

const fail = (message: string): never => { throw new Error(message); };
const fixture = (steps: Step[]): Lesson => ({ language: 'python', code: 'numbers = example(numbers)\nnumbers', steps });
const list: Step = { line: 2, assign: { var: 'numbers', value: [2, 4] } };

test('addresses parse bare names, one index, quoted keys, escaped JSON keys, and attributes', () => {
  for (const [text, expected] of [
    ['numbers', { var: 'numbers' }], ['_name2', { var: '_name2' }],
    ['numbers[0]', { var: 'numbers', index: 0 }],
    ['report["score"]', { var: 'report', key: 'score' }],
    ["report['score']", { var: 'report', key: 'score' }],
    [String.raw`report["a\"b]"]`, { var: 'report', key: 'a"b]' }],
    ['ada.name', { var: 'ada', attribute: 'name' }],
  ] as const) assert.deepEqual(parseAddress(text, fail), expected);
});

test('invalid addresses reject empty names, nesting, invalid indices/keys/quotes, whitespace, and leading digits', () => {
  for (const text of ['', 'x[0][1]', 'x.name.other', 'x[0].name', 'x[-1]', 'x[0.5]', 'x[1e2]', 'x[+1]',
    'x[9007199254740992]', 'x[""]', "x['']", 'x["key]', "x['key]", "x['a'b']", String.raw`x['a\b']`,
    'x[true]', 'x[k]', ' x', 'x [0]', 'x[ 0]', 'x.name ', 'x["two words"]', '1name']) {
    assert.throws(() => parseAddress(text, fail), /address|index|key/, text);
  }
});

test('normalized list actions retain known snapshots and internal selection/mutation origins', () => {
  const states = buildSnapshots(fixture([
    list,
    { select: 'numbers[1]', badge: { over: 'numbers', value: 4, from: 'numbers[1]' } },
    { update: { target: 'numbers[0]', from: 'badge' } },
    { append: { target: 'numbers', value: 6 } },
    { remove: 'numbers[1]' },
    { select: null, badge: { over: 'numbers', value: [4, 6], from: 'numbers' } },
  ]));
  assert.deepEqual(states[2].selection, { name: 'numbers', frameId: 0, index: 1 });
  assert.deepEqual(states[2].events.badgeAdded?.from, { kind: 'var', name: 'numbers', frameId: 0, index: 1 });
  assert.deepEqual(states[3].vars[0].value, [4, 4]);
  assert.deepEqual(states[3].events.updated, { name: 'numbers', frameId: 0, index: 0, fromBadge: 1 });
  assert.deepEqual(states[4].vars[0].value, [4, 4, 6]);
  assert.deepEqual(states[4].events.appended, { name: 'numbers', frameId: 0, index: 2, fromBadge: undefined });
  assert.deepEqual(states[5].vars[0].value, [4, 6]);
  assert.deepEqual(states[5].events.removed, { name: 'numbers', frameId: 0, index: 1 });
  assert.deepEqual(states[6].badges.at(-1)?.value, [4, 6]);
  assert.deepEqual(states[1].vars[0].value, [2, 4]);
});

test('field addresses retain dictionary and instance identity and event selectors', () => {
  const escaped = String.raw`report["a\"b]"]`;
  const states = buildSnapshots(fixture([
    { line: 2, allocate: { id: 'dict', fields: { 'a"b]': 5 } }, assign: { var: 'report', ref: 'dict' } },
    { update: { target: escaped, value: 7 } },
    { badge: { over: 'numbers', value: 7, from: escaped } },
    { allocate: { id: 'student', class: 'Student', fields: {} }, assign: { var: 'ada', ref: 'student' } },
    { update: { target: 'ada.name', value: 'Ada' } },
    { badge: { over: 'numbers', value: 'Ada', from: 'ada.name' } },
  ]));
  assert.deepEqual(states[2].events.updated, { name: 'report', frameId: 0, key: 'a"b]', ref: 'dict', fromBadge: undefined });
  assert.deepEqual(states[3].events.badgeAdded?.from, { kind: 'var', name: 'report', frameId: 0, key: 'a"b]', ref: 'dict' });
  assert.deepEqual(states[5].events.updated, { name: 'ada', frameId: 0, attribute: 'name', ref: 'student', fromBadge: undefined });
  assert.deepEqual(states[6].events.badgeAdded?.from, { kind: 'var', name: 'ada', frameId: 0, attribute: 'name', ref: 'student' });
});

test('global address mappings bypass a shadowing local for from/select/update/append/remove', () => {
  const states = buildSnapshots(fixture([
    { line: 1, assign: { var: 'numbers', value: [1, 2] } },
    { call: { name: 'example', line: 2, over: 'example(numbers)', args: [{ var: 'numbers', value: [9, 8] }] } },
    { badge: { over: 'numbers', value: 1, from: { target: 'numbers[0]', scope: 'global' } } },
    { select: { target: 'numbers[1]', scope: 'global' } },
    { update: { target: 'numbers[0]', scope: 'global', value: 3 } },
    { append: { target: 'numbers', scope: 'global', value: 4 } },
    { remove: { target: 'numbers[1]', scope: 'global' } },
  ]));
  assert.equal(states[3].events.badgeAdded?.from?.kind, 'var');
  assert.deepEqual(states[3].events.badgeAdded?.from, { kind: 'var', name: 'numbers', frameId: 0, index: 0 });
  assert.equal(states[4].selection?.frameId, 0);
  assert.equal(states[5].events.updated?.frameId, 0);
  assert.equal(states[6].events.appended?.frameId, 0);
  assert.equal(states[7].events.removed?.frameId, 0);
  assert.deepEqual(states[7].vars[0].value, [3, 4]);
  assert.deepEqual(states[7].frames[0].vars[0].value, [9, 8]);
});

test('console shorthand reads input while an address mapping reads a binding named console', () => {
  const states = buildSnapshots(fixture([
    { line: 2, input: 'typed', assign: { var: 'console', value: 'stored' } },
    { badge: { over: 'numbers', value: 'typed', from: 'console' } },
    { badge: { over: 'numbers', value: 'stored', from: { target: 'console' } } },
  ]));
  assert.deepEqual(states[2].events.badgeAdded?.from, { kind: 'console', chunk: 0 });
  assert.deepEqual(states[3].events.badgeAdded?.from, { kind: 'var', name: 'console', frameId: 0 });
});

test('action accessor restrictions and kind checks reject misuse with migration-free explanations', () => {
  for (const [step, message] of [
    [{ update: { target: 'numbers', value: 5 } }, /use assign to rebind a name/],
    [{ append: { target: 'numbers[0]', value: 5 } }, /bare name/],
    [{ select: 'numbers' }, /index accessor/], [{ remove: 'numbers' }, /index accessor/],
    [{ select: 'numbers.name' }, /index accessor/], [{ remove: 'numbers["name"]' }, /index accessor/],
  ] satisfies [Step, RegExp][]) assert.throws(() => buildSnapshots(fixture([list, step])), message);
  const dictionary: Step = { line: 2, allocate: { id: 'record', fields: { score: 5 } }, assign: { var: 'report', ref: 'record' } };
  for (const step of [{ badge: { over: 'numbers', value: 5, from: 'report.score' } }, { update: { target: 'report.score', value: 6 } }] satisfies Step[]) {
    assert.throws(() => buildSnapshots(fixture([dictionary, step])), /not an allocated class instance.*write report\["score"\]/);
  }
  assert.throws(() => buildSnapshots(fixture([
    { line: 2, allocate: { id: 'student', class: 'Student', fields: { name: 'Ada' } }, assign: { var: 'ada', ref: 'student' } },
    { badge: { over: 'numbers', value: 'Ada', from: 'ada["name"]' } },
  ])), /not a dictionary reference/);
});

test('removed var/index/key/attribute forms fail with concrete migration hints', () => {
  for (const action of [
    'badge: { over: numbers, value: 2, from: { var: numbers } }',
    'badge: { over: numbers, value: 2, from: { target: numbers, index: 0 } }',
    'select: { var: numbers, index: 0 }', 'remove: { var: numbers, index: 0 }',
    'update: { var: numbers, index: 0, value: 3 }', 'append: { var: numbers, value: 3 }',
    'update: { target: numbers, key: score, value: 3 }',
    'update: { target: numbers, attribute: name, value: 3 }',
    'select: { target: numbers, index: 0 }', 'remove: { target: numbers, index: 0 }',
    'append: { target: numbers, index: 0, value: 3 }',
  ]) {
    const lesson = parseLesson(`language: python\ncode: numbers\nsteps:\n  - line: 1\n    assign: { var: numbers, value: [2, 4] }\n  - ${action}\n`);
    assert.throws(() => buildSnapshots(lesson), /Step 2:.*(is|are) replaced by an address, e\.g\./, action);
  }
});

test('scope is only accepted in address mappings and only with the global value', () => {
  for (const action of [
    'badge: { over: numbers, value: 2, from: { target: numbers, scope: local } }',
    'select: { target: "numbers[0]", scope: local }',
    'update: { target: "numbers[0]", value: 3, scope: local }',
    'append: { target: numbers, value: 3, scope: local }',
    'remove: { target: "numbers[0]", scope: local }',
    'badge: { over: numbers, value: 2, scope: global }',
    'convert: { value: 3, scope: global }',
    'assign: { var: other, value: 2, scope: global }',
    'print: { text: hi, scope: global }',
  ]) assert.throws(() => buildSnapshots(parseLesson(`language: python\ncode: numbers\nsteps:\n  - line: 1\n    assign: { var: numbers, value: [2, 4] }\n  - ${action}\n`)), /Step 2:.*scope/);
});

test('unquoted bracket addresses in YAML flow mappings include a quoting hint', () => {
  assert.throws(() => parseLesson('language: python\ncode: numbers\nsteps:\n  - badge: { over: numbers, value: 2, from: numbers[1] }\n'), /Addresses with brackets inside \{ \} must be quoted.*from: 'numbers\[1\]'/);
});
