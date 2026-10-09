import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLesson, type Lesson, type Step } from '../src/lesson';
import { buildSnapshots } from '../src/state';

const sample = (id: string) => parseLesson(readFileSync(new URL(`../../../lessons/python/${id}/lesson.yaml`, import.meta.url), 'utf8'));
const fixture = (steps: Step[]): Lesson => ({ language: 'python', code: 'age = "abc"\nyears = int(age)', steps });
const error: Step = { error: { kind: 'runtime', name: 'ValueError', message: 'Cannot convert.', line: 2, over: 'int(age)' } };

test('syntax error is a location before execution, with no assignment or output', () => {
  const states = buildSnapshots(sample('syntax-error'));
  assert.equal(states.length, 2);
  assert.equal(states[0].error, null);
  assert.equal(states[0].line, null);
  assert.deepEqual(states[1].error, { kind: 'syntax', name: 'SyntaxError', line: 2, over: 'if age >= 18', message: 'Expected ":" after the condition.', nth: 1 });
  for (const key of ['vars', 'frames', 'heap', 'badges', 'console'] as const) assert.deepEqual(states[1][key], []);
});

test('runtime error preserves earlier state and output, without an assignment result', () => {
  const states = buildSnapshots(sample('runtime-error'));
  assert.equal(states.length, 6);
  assert.equal(states[4].error, null);
  assert.equal(states[4].badges[0].value, 'abc');
  assert.equal(states[5].error?.kind, 'runtime');
  assert.equal(states[5].error?.over, 'int(age)');
  assert.deepEqual(states[5].vars, [{ name: 'age', value: 'abc', type: 'str' }]);
  assert.equal(states[5].console.map(entry => entry.text).join(''), 'Starting\n');
  assert.deepEqual(states[5].badges, []);
  assert.deepEqual(states[5].vars, states[4].vars);
  assert.equal(states[4].badges.length, 1);
});

test('program errors preserve active frames and heap without inventing unwinding', () => {
  const states = buildSnapshots(fixture([
    { line: 2, allocate: { id: 'student', class: 'Student', fields: { name: 'Ada' } } },
    { call: { name: 'example', line: 1, over: 'int(age)', args: [{ var: 'self', ref: 'student' }] } },
    { error: { kind: 'runtime', name: 'ExampleError', message: 'Stopped here.', line: 1 } },
  ]));
  assert.deepEqual(states[3].frames, states[2].frames);
  assert.deepEqual(states[3].heap, states[2].heap);
  assert.equal(states[2].error, null);
});

test('invalid diagnostics and steps after unhandled errors fail as lesson errors', () => {
  for (const [spec, pattern] of [
    ['error: bad', /mapping/],
    ['error: { kind: caught, name: Error, message: bad, line: 2 }', /syntax or runtime/],
    ['error: { kind: runtime, name: "", message: bad, line: 2 }', /name.*nonempty/],
    ['error: { kind: runtime, name: Error, message: 1, line: 2 }', /message.*nonempty/],
    ['error: { kind: runtime, name: Error, message: bad, line: 3 }', /doesn.t exist/],
    ['error: { kind: runtime, name: Error, message: bad, line: 2, over: missing }', /couldn.t find/],
    ['error: { kind: runtime, name: Error, message: bad, line: 2, over: age, nth: 0 }', /positive integer/],
    ['error: { kind: runtime, name: Error, message: bad, line: 2, nth: 1 }', /needs an.*target/],
    ['error: { kind: runtime, name: Error, message: bad, line: 2, unknown: yes }', /unknown error key/],
  ] as const) {
    assert.throws(() => buildSnapshots(parseLesson(`language: python\ncode: |\n  age = "abc"\n  years = int(age)\nsteps:\n  - ${spec}\n`)), new RegExp(`Step 1:.*${pattern.source}`));
  }
  assert.throws(() => buildSnapshots(fixture([{ ...error, assign: { var: 'years', value: 0 } }])), /must be its own step/);
  assert.throws(() => buildSnapshots(fixture([error, { print: 'Never' }])), /ends execution/);
  assert.throws(() => buildSnapshots(fixture([{ line: 1 }, { error: { ...error.error!, kind: 'syntax' } }])), /first step/);
  const repeated = buildSnapshots({ language: 'python', code: 'age + age', steps: [{ error: { kind: 'runtime', name: 'NameError', message: 'Missing.', line: 1, over: 'age', nth: 2 } }] });
  assert.equal(repeated[1].error?.nth, 2);
});
