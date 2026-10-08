import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLesson, type Lesson, type Step } from '../src/lesson';
import { buildSnapshots, type Snapshot } from '../src/state';

const sample = (name: string) => parseLesson(readFileSync(new URL(`../../../lessons/python/${name}/lesson.yaml`, import.meta.url), 'utf8'));
const vars = (items: { name: string; value: unknown }[]) => Object.fromEntries(items.map(v => [v.name, v.value]));
const fixture = (steps: Step[]): Lesson => ({ language: 'python', code: 'answer = bump(10)\nresult = bump(value)\nreturn result\nprint(answer)', steps });

test('function locals stay separate from globals and returning resumes the saved expression', () => {
  const states = buildSnapshots(sample('function-call'));
  assert.equal(states.length, 12);
  assert.deepEqual(vars(states[3].vars), { value: 10 });
  assert.deepEqual(vars(states[3].frames[0].vars), { value: 10 });
  assert.deepEqual(vars(states[6].frames[0].vars), { value: 10, result: 11 });
  assert.equal(states[7].line, 3);
  assert.equal(states[8].line, 6);
  assert.deepEqual(states[8].frames, []);
  assert.deepEqual(vars(states[8].vars), { value: 10 });
  assert.equal(states[8].badges.at(-1)?.over, 'add_one(value)');
  assert.equal(states[8].badges.at(-1)?.value, 11);
  assert.deepEqual(vars(states[9].vars), { value: 10, answer: 11 });
  assert.equal(states[11].console.at(-1)?.text, '11\n');
});

test('returning and later assignments cannot change snapshots used for back-stepping or scrubbing', () => {
  const states = buildSnapshots(sample('function-call'));
  assert.equal(states[2].badges[0].value, 10);
  assert.equal(states[3].frames[0].callerBadges[0].value, 10);
  assert.equal(states[4].badges.at(-1)?.value, 10);
  assert.equal(states[5].badges.at(-1)?.value, 11);
  assert.equal(states[3].frames[0].vars.length, 1);
  assert.equal(states[7].frames[0].vars.length, 2);
  assert.notEqual(states[3].frames[0].vars[0], states[7].frames[0].vars[0]);
});

test('nested-call sample returns through each caller without sharing its locals', () => {
  const states = buildSnapshots(sample('nested-function-call'));
  assert.equal(states.length, 20);
  const [outer, inner] = states[8].frames;
  assert.equal(outer.name, 'double_after_bump');
  assert.equal(inner.name, 'add_one');
  assert.deepEqual(vars(outer.vars), { value: 10 });
  assert.deepEqual(vars(inner.vars), { value: 10, result: 11 });
  assert.equal(inner.returnTo.line, 6);
  assert.equal(outer.returnTo.line, 11);

  assert.equal(states[10].line, 6);
  assert.deepEqual(states[10].frames.map(f => f.id), [outer.id]);
  assert.deepEqual(vars(states[10].frames[0].vars), { value: 10 });
  assert.deepEqual(states[10].badges.map(b => [b.over, b.value]), [['add_one(value)', 11]]);
  assert.deepEqual(vars(states[11].frames[0].vars), { value: 10, result: 11 });
  assert.deepEqual(vars(states[14].frames[0].vars), { value: 10, result: 22 });
  assert.deepEqual(vars(states[8].frames[1].vars), { value: 10, result: 11 });

  assert.equal(states[16].line, 11);
  assert.deepEqual(states[16].frames, []);
  assert.deepEqual(vars(states[16].vars), { value: 10 });
  assert.deepEqual(states[16].badges.map(b => [b.over, b.value]), [['double_after_bump(value)', 22]]);
  assert.deepEqual(vars(states[19].vars), { value: 10, answer: 22 });
  assert.equal(states[19].console.map(c => c.text).join(''), '22\n');
});

test('nested calls with the same name have distinct frames and restore the suspended caller', () => {
  const states = buildSnapshots(fixture([
    { line: 1, badge: { over: '10', value: 10 } },
    { call: { name: 'bump', line: 2, over: 'bump(10)', args: [{ var: 'value', from: 'badge' }] } },
    { badge: { over: 'value', value: 10, from: { var: 'value' } } },
    { call: { name: 'bump', line: 3, over: 'bump(value)', args: [{ var: 'value', value: 20 }] } },
    { assign: { var: 'result', value: 21 } },
    { badge: { over: 'result', value: 21, from: { var: 'result' } } },
    { return: { from: 'badge' } },
    { assign: { var: 'result', from: 'badge' } },
    { line: 3, badge: { over: 'result', value: 21, from: { var: 'result' } } },
    { return: { from: 'badge' } },
    { assign: { var: 'answer', from: 'badge' } },
  ]));
  const [outer, inner] = states[6].frames;
  assert.notEqual(outer.id, inner.id);
  assert.deepEqual(vars(outer.vars), { value: 10 });
  assert.deepEqual(vars(inner.vars), { value: 20, result: 21 });
  assert.equal(states[7].frames[0].id, outer.id);
  assert.equal(states[7].line, 2);
  assert.deepEqual(states[7].badges.map(b => b.value), [21]);
  assert.deepEqual(vars(states[8].frames[0].vars), { value: 10, result: 21 });
  assert.equal(states[10].line, 1);
  assert.deepEqual(vars(states[11].vars), { answer: 21 });
  assert.deepEqual(states[11].frames, []);
});

test('shadowing, explicit global lookup, and global fallback resolve the correct animation origin', () => {
  const states = buildSnapshots(fixture([
    { line: 1, assign: { var: 'value', value: 10 } },
    { assign: { var: 'shared', value: 7 } },
    { call: { name: 'bump', line: 2, over: 'bump(10)', args: [{ var: 'value', value: 20 }] } },
    { assign: { var: 'value', value: 30 } },
    { badge: { over: 'value', value: 30, from: { var: 'value' } } },
    { badge: { over: 'value', value: 10, from: { var: 'value', scope: 'global' } } },
    { badge: { over: 'value', value: 7, from: { var: 'shared' } } },
    { return: { value: 31 } },
  ]));
  assert.equal(states[5].events.badgeAdded?.from?.kind, 'var');
  assert.deepEqual(states[5].events.badgeAdded?.from, { kind: 'var', name: 'value', frameId: 1 });
  assert.deepEqual(states[6].events.badgeAdded?.from, { kind: 'var', name: 'value', frameId: 0 });
  assert.deepEqual(states[7].events.badgeAdded?.from, { kind: 'var', name: 'shared', frameId: 0 });
  assert.deepEqual(vars(states[8].vars), { value: 10, shared: 7 });
});

test('a function cannot read a local variable from a suspended caller', () => {
  assert.throws(() => buildSnapshots(fixture([
    { line: 1 },
    { call: { name: 'outer', line: 2, over: 'bump(10)', args: [{ var: 'private', value: 10 }] } },
    { call: { name: 'inner', line: 3, over: 'bump(value)' } },
    { badge: { over: 'result', value: 10, from: { var: 'private' } } },
  ])), /no variable named private/);
});

test('explicit null results override a badge value and retain their own type', () => {
  const states = buildSnapshots(fixture([
    { line: 1, badge: { over: '10', value: 10 } },
    { call: { name: 'bump', line: 3, over: 'bump(10)' } },
    { badge: { over: 'result', value: 11 } },
    { return: { from: 'badge', value: null } },
    { assign: { var: 'answer', from: 'badge' } },
  ]));
  assert.equal(states[4].badges.at(-1)?.value, null);
  assert.equal(states[4].badges.at(-1)?.type, 'NoneType');
  assert.deepEqual(vars(states[5].vars), { answer: null });
});

test('invalid call/return transitions fail with the step number', () => {
  const cases: [Step[], RegExp][] = [
    [[{ return: { value: 1 } }], /Step 1:.*active function/],
    [[{ call: { name: 'bump', line: 2, over: 'bump(10)' } }], /Step 1:.*active caller line/],
    [[{ line: 1 }, { call: { name: 'bump', line: 99, over: 'bump(10)' } }], /Step 2:.*line 99/],
    [[{ line: 1 }, { call: { name: 'bump', line: 2, over: 'missing' } }], /Step 2:.*couldn't find/],
    [[{ line: 1 }, { call: { name: 'bump', line: 2, over: 'bump(10)', args: [{ var: 'x', from: 'badge' }] } }], /Step 2:.*no badge/],
    [[{ line: 1 }, { call: { name: 'bump', line: 2, over: 'bump(10)', args: [{ var: 'x', value: 1 }, { var: 'x', value: 2 }] } }], /Step 2:.*duplicate parameter/],
    [[{ line: 1, call: { name: 'bump', line: 2, over: 'bump(10)' } }], /Step 1:.*own step/],
    [[{ line: 1 }, { call: { name: 'bump', line: 2, over: 'bump(10)' } }, { return: {} }], /Step 3:.*needs a `value`/],
    [[{ line: 1 }, { call: { name: 'bump', line: 2, over: 'bump(10)' } }, { return: { from: 'badge' } }], /Step 3:.*no badge/],
  ];
  for (const [steps, message] of cases) assert.throws(() => buildSnapshots(fixture(steps)), message);
});

test('suspended caller badges are independent of later result conversions', () => {
  const states = buildSnapshots(fixture([
    { line: 1, badge: { over: '10', value: 10 } },
    { call: { name: 'bump', line: 3, over: 'bump(10)' } },
    { return: { value: 11 } },
    { convert: { value: '11' } },
  ]));
  assert.equal(states[2].frames[0].callerBadges[0].value, 10);
  assert.deepEqual(states[3].badges.map(b => b.value), [11]);
  assert.deepEqual(states[4].badges.map(b => b.value), ['11']);
});

test('return replaces argument badges but preserves evaluated values outside the call', () => {
  const lesson: Lesson = {
    language: 'python', code: 'answer = 2 + bump(10)\nreturn result',
    steps: [
      { line: 1, badge: { over: '2', value: 2 } },
      { badge: { over: '10', value: 10 } },
      { call: { name: 'bump', line: 2, over: 'bump(10)', args: [{ var: 'value', from: 'badge' }] } },
      { return: { value: 11 } },
    ],
  };
  const states = buildSnapshots(lesson);
  assert.deepEqual(states[4].badges.map(b => [b.over, b.value]), [['2', 2], ['bump(10)', 11]]);
  assert.deepEqual(states[2].badges.map(b => b.value), [2, 10]);
  assert.deepEqual(states[3].frames[0].callerBadges.map(b => b.value), [2, 10]);
});

test('existing corpus lessons keep their final globals, console, and empty call stacks', () => {
  const cases = [
    ['numeric-input', { text: '30', age: 30 }, 'Enter your age: 30You will be 100 in 70 years!\n'],
    ['accumulator-loop', { total: 3, n: 2 }, '3\n'],
    ['conditional', { age: 16 }, 'Under 18\n'],
  ] as const;
  for (const [name, expectedVars, output] of cases) {
    const final: Snapshot = buildSnapshots(sample(name)).at(-1)!;
    assert.deepEqual(vars(final.vars), expectedVars);
    assert.equal(final.console.map(c => c.text).join(''), output);
    assert.deepEqual(final.frames, []);
  }
});
