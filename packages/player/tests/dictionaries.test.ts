import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLesson, type Lesson, type Step } from '../src/lesson';
import { buildSnapshots } from '../src/state';

const fixture = (steps: Step[]): Lesson => ({ language: 'python', code: 'change(student)\nreturn student', steps });
const create: Step = { line: 1, allocate: { id: 'record', fields: { name: 'Ada', score: 5 } }, assign: { var: 'student', ref: 'record' } };

test('dictionary lesson changes one field and preserves identity and previous snapshots', () => {
  const lesson = parseLesson(readFileSync(new URL('../../../lessons/python/dictionary-fields/lesson.yaml', import.meta.url), 'utf8'));
  const states = buildSnapshots(lesson);
  assert.equal(states.length, 6);
  assert.deepEqual(states[2].heap[0], { id: 'student-1', fields: { name: 'Ada', score: 5 }, type: 'dict' });
  assert.deepEqual(states[3].heap[0], { id: 'student-1', fields: { name: 'Ada', score: 7 }, type: 'dict' });
  assert.deepEqual(states[3].vars[0].value, { ref: 'student-1' });
  assert.deepEqual(states[3].events.updated, { name: 'student', frameId: 0, key: 'score', ref: 'student-1', fromBadge: 1 });
  assert.deepEqual(states[4].events.badgeAdded?.from, { kind: 'var', name: 'student', frameId: 0, key: 'score', ref: 'student-1' });
  assert.equal(states[5].console.at(-1)?.text, '7\n');
});

test('dictionary references support aliases, scope lookup, and independently restored bindings', () => {
  const states = buildSnapshots(fixture([
    create,
    { assign: { var: 'other', ref: 'record' } },
    { call: { name: 'change', line: 2, over: 'change(student)', args: [{ var: 'student', ref: 'record' }] } },
    { update: { var: 'student', key: 'score', value: 9 } },
    { badge: { over: 'student', value: 9, from: { var: 'other', key: 'score', scope: 'global' } } },
    { allocate: { id: 'separate', fields: { score: 2 } }, assign: { var: 'student', ref: 'separate' } },
    { update: { var: 'student', key: 'score', scope: 'global', value: 10 } },
    { return: { value: null } },
  ]));
  assert.deepEqual(states[4].heap[0], { id: 'record', fields: { name: 'Ada', score: 9 }, type: 'dict' });
  assert.deepEqual(states[3].heap[0], { id: 'record', fields: { name: 'Ada', score: 5 }, type: 'dict' });
  assert.equal(states[4].events.updated?.frameId, 1);
  assert.equal(states[7].events.updated?.frameId, 0);
  assert.deepEqual(states[7].heap.map(object => 'fields' in object ? object.fields : object.value), [{ name: 'Ada', score: 10 }, { score: 2 }]);
  assert.deepEqual(states[8].frames, []);
  assert.deepEqual(states[8].vars.map(variable => variable.value), [{ ref: 'record' }, { ref: 'record' }]);
});

test('empty dictionaries and reserved-looking keys remain ordinary authored fields', () => {
  const fields = JSON.parse('{"__proto__":5,"constructor":6,"ref":7,"a\\\"b]":8}');
  const states = buildSnapshots(fixture([
    { allocate: { id: 'empty', fields: {} } },
    { ...create, allocate: { id: 'record', fields } },
    { update: { var: 'student', key: '__proto__', value: 9 } },
    { badge: { over: 'student', value: 8, from: { var: 'student', key: 'a"b]' } } },
  ]));
  assert.deepEqual(states[1].heap[0], { id: 'empty', fields: {}, type: 'dict' });
  const object = states[3].heap[1];
  assert.ok('fields' in object);
  assert.equal(Object.getPrototypeOf(object.fields), Object.prototype);
  assert.equal(object.fields.__proto__, 9);
  assert.equal(fields.__proto__, 5);
  assert.equal(states[4].events.badgeAdded?.from?.kind, 'var');
});

test('invalid dictionary allocations and updates fail with step-specific errors', () => {
  for (const [action, pattern] of [
    ['allocate: { id: second, fields: null }', /must be a mapping/],
    ['allocate: { id: second, fields: [], value: [] }', /not both/],
    ['allocate: { id: second, fields: { "": 1 } }', /nonempty/],
    ['allocate: { id: second, fields: { nested: [1] } }', /scalars/],
    ['allocate: { id: second, fields: { nested: { score: 1 } } }', /finite scalar/],
    ['allocate: { id: second, fields: { score: .inf } }', /finite scalar/],
    ['update: { var: student, key: missing, value: 1 }', /does not exist/],
    ['update: { var: student, key: constructor, value: 1 }', /does not exist/],
    ['update: { var: student, key: "", value: 1 }', /nonempty/],
    ['update: { var: student, key: 0, value: 1 }', /nonempty text/],
    ['update: { var: student, key: score, index: 0, value: 1 }', /cannot combine/],
    ['update: { var: student, key: score, value: [1] }', /scalar field/],
    ['update: { var: student, index: 0, value: 1 }', /not a list/],
    ['append: { var: student, value: 1 }', /not a list/],
    ['remove: { var: student, index: 0 }', /not a list/],
    ['badge: { over: student, value: 1, from: { var: student, key: missing } }', /does not exist/],
    ['badge: { over: student, value: 1, from: { var: student, key: score, index: 0 } }', /cannot combine/],
    ['badge: { over: student, value: 1, from: { var: student } }', /require a `key`/],
    ['select: { var: student, index: 0 }', /not a list/],
  ] as const) {
    const yaml = `language: python\ncode: student\nsteps:\n  - line: 1\n    allocate: { id: record, fields: { score: 5 } }\n    assign: { var: student, ref: record }\n  - ${action}\n`;
    assert.throws(() => buildSnapshots(parseLesson(yaml)), new RegExp(`Step 2:.*${pattern.source}`));
  }
  assert.throws(() => buildSnapshots(fixture([create, { assign: { var: 'number', value: 5 } }, { update: { var: 'number', key: 'score', value: 9 } }])), /not a dictionary reference/);
  assert.throws(() => buildSnapshots(fixture([{ line: 1, allocate: { id: 'list', value: [5] }, assign: { var: 'student', ref: 'list' } }, { update: { var: 'student', key: 'score', value: 9 } }])), /not a dictionary reference/);
});
