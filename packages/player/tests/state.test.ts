import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LessonError, parseLesson, type Lesson, type Step, type Value, type ValueSource } from '../src/lesson';
import { badgeDisplayValue } from '../src/visuals/heap-state';
import { buildSnapshots, type Snapshot } from '../src/state';

const sample = (name: string) => parseLesson(readFileSync(new URL(`../../../lessons/python/${name}/lesson.yaml`, import.meta.url), 'utf8'));
const vars = (items: { name: string; value: unknown }[]) => Object.fromEntries(items.map(v => [v.name, v.value]));
const fixture = (steps: Step[]): Lesson => ({ language: 'python', code: 'answer = bump(10)\nresult = bump(value)\nreturn result\nprint(answer)', steps });

test('variable-source badges must match exact scoped, indexed, field, or referenced-list values', () => {
  const scoped: Step[] = [
    { line: 1, assign: { var: 'x', value: 5 } },
    { call: { name: 'example', line: 2, over: 'example(x)', args: [{ var: 'x', value: 7 }] } },
  ];
  const cases: { label: string; setup: Step[]; source: ValueSource; value: Value; mismatches: Value[] }[] = [
    { label: 'local', setup: scoped, source: "x", value: 7, mismatches: [5, '7'] },
    { label: 'global under a shadowing local', setup: scoped, source: { target: "x", scope: 'global' }, value: 5, mismatches: [7, '5'] },
    { label: 'list index', setup: [{ line: 2, assign: { var: 'x', value: [2, 1] } }], source: "x[1]", value: 1, mismatches: [true, 2] },
    { label: 'reference list index', setup: [{ line: 2, allocate: { id: 'list', value: [2, 5] }, assign: { var: 'x', ref: 'list' } }], source: "x[1]", value: 5, mismatches: [2, '5'] },
    { label: 'dictionary key', setup: [{ line: 2, allocate: { id: 'dict', fields: { score: 5 } }, assign: { var: 'x', ref: 'dict' } }], source: "x[\"score\"]", value: 5, mismatches: [99, '5'] },
    { label: 'instance attribute', setup: [{ line: 2, allocate: { id: 'student', class: 'Student', fields: { name: 'Ada' } }, assign: { var: 'x', ref: 'student' } }], source: "x.name", value: 'Ada', mismatches: ['Grace', 5] },
    { label: 'whole referenced list', setup: [{ line: 2, allocate: { id: 'list', value: [5, '5', true, null] }, assign: { var: 'x', ref: 'list' } }], source: "x", value: [5, '5', true, null], mismatches: [[5, '5', 1, null], [5, '5', true], ['5', 5, true, null]] },
    { label: 'whole ordinary list', setup: [{ line: 2, assign: { var: 'x', value: [] } }], source: "x", value: [], mismatches: [[null], null] },
  ];
  for (const { label, setup, source, value, mismatches } of cases) {
    const lesson = (badgeValue: Value): Lesson => ({ language: 'python', code: 'x = example(x)\nx', steps: [...setup, { badge: { over: 'x', value: badgeValue, from: source } }] });
    const final = buildSnapshots(lesson(value)).at(-1)!;
    assert.deepEqual(badgeDisplayValue(final, final.badges.at(-1)!.value), value, label);
    for (const mismatch of mismatches) {
      assert.throws(() => buildSnapshots(lesson(mismatch)), new RegExp(`Step ${setup.length + 1}: badge value .*doesn't match.*currently holds.*must show`), label);
    }
  }
  assert.throws(() => buildSnapshots({ language: 'python', code: 'x', steps: [
    { line: 1, assign: { var: 'x', value: 5 } },
    { badge: { over: 'x', value: '99', from: "x" } },
  ] }), /Step 2: badge value "99" doesn't match `x`, which currently holds 5/);
});

test('badge-linked output must contain the printed value, allowing embedded values and language literals', () => {
  const outputs: [Value, string | undefined, string][] = [
    [70, undefined, 'You will be 100 in 70 years!'],
    ['Ada', undefined, 'Hello, Ada!'],
    [true, undefined, 'True'],
    [false, undefined, 'False'],
    [null, undefined, 'None'],
    [5, 'float', '5.0'],
    [[2, 4], undefined, '[2, 4]'],
  ];
  for (const action of ['print', 'write'] as const) {
    for (const [value, type, text] of outputs) {
      const steps: Step[] = [
        { line: 1, badge: { over: 'x', value, type } },
        { [action]: { text, from: 'badge' } },
      ];
      const lesson: Lesson = { language: 'python', code: 'print(x)', steps };
      assert.equal(buildSnapshots(lesson).at(-1)?.console.at(-1)?.text, text + (action === 'print' ? '\n' : ''));
      assert.throws(() => buildSnapshots({ ...lesson, steps: [steps[0], { [action]: { text: 'unrelated', from: 'badge' } }] }), /Step 2: output badge holds .*given text "unrelated".*printed form/);
    }
  }
  for (const [value, text] of [[true, 'true'], [null, 'null'], ['Ada', 'Bob']] as const) {
    assert.throws(() => buildSnapshots({ language: 'python', code: 'x', steps: [
      { line: 1, badge: { over: 'x', value } },
      { print: { text, from: 'badge' } },
    ] }), /Step 2: output badge holds/);
  }
});

test('badge-linked output cannot share badge creation or conversion, but assignment can', () => {
  for (const output of ['print', 'write'] as const) {
    for (const action of [{ badge: { over: 'x', value: 9 } }, { convert: { value: 9 } }] satisfies Step[]) {
      assert.throws(() => buildSnapshots({ language: 'python', code: 'x', steps: [
        { line: 1, badge: { over: 'x', value: 5 } },
        { ...action, [output]: { text: '5', from: 'badge' } },
      ] }), new RegExp(`Step 2:.*${output}.*from: badge.*can't share a step.*badge.*convert.*own step`));
    }
  }
  const lesson: Lesson = { language: 'python', code: 'x', steps: [
    { line: 1, badge: { over: 'x', value: '5' }, convert: { value: 5 }, assign: { var: 'x', from: 'badge' } },
    { badge: { over: 'x', value: 5, from: "x" }, assign: { var: 'other', from: 'badge' } },
    { print: { text: '5', from: 'badge' } },
  ] };
  assert.deepEqual(vars(buildSnapshots(lesson).at(-1)!.vars), { x: 5, other: 5 });
  assert.doesNotThrow(() => buildSnapshots({ ...lesson, steps: [{ line: 1, badge: { over: 'x', value: 5 }, print: 'unrelated' }] }));
});

test('console-source badges remain authored values without source consistency validation', () => {
  const states = buildSnapshots({ language: 'python', code: 'x', steps: [
    { line: 1, input: 'abc' },
    { badge: { over: 'x', value: 99, from: 'console' } },
  ] });
  assert.equal(states[2].badges[0].value, 99);
});

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
    { badge: { over: 'value', value: 10, from: "value" } },
    { call: { name: 'bump', line: 3, over: 'bump(value)', args: [{ var: 'value', value: 20 }] } },
    { assign: { var: 'result', value: 21 } },
    { badge: { over: 'result', value: 21, from: "result" } },
    { return: { from: 'badge' } },
    { assign: { var: 'result', from: 'badge' } },
    { line: 3, badge: { over: 'result', value: 21, from: "result" } },
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
    { badge: { over: 'value', value: 30, from: "value" } },
    { badge: { over: 'value', value: 10, from: { target: "value", scope: 'global' } } },
    { badge: { over: 'value', value: 7, from: "shared" } },
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
    { badge: { over: 'result', value: 10, from: "private" } },
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
    ['hello-world', {}, 'Hello, world!\n'],
    ['simple-arithmetic', {}, '5\n'],
    ['naming-value', { score: 5 }, '5\n'],
    ['changing-value', { score: 7 }, '7\n'],
    ['strings-and-numbers', {}, '5\n23\n'],
    ['numeric-input', { text: '30', age: 30 }, 'Enter your age: 30You will be 100 in 70 years!\n'],
    ['boolean-comparisons', {}, 'True\nFalse\n'],
    ['while-loop', { count: 2 }, '0\n1\nDone\n'],
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

test('introductory examples separate old-value reads, assignment, and string concatenation', () => {
  const naming = buildSnapshots(sample('naming-value'));
  assert.deepEqual(vars(naming[1].vars), { score: 5 });
  assert.equal(naming[2].badges.at(-1)?.value, 5);
  assert.equal(naming[2].events.badgeAdded?.from?.kind, 'var');
  const changing = buildSnapshots(sample('changing-value'));
  assert.deepEqual(vars(changing[3].vars), { score: 5 });
  assert.equal(changing[2].badges.at(-1)?.nth, 2);
  assert.equal(changing[3].badges.at(-1)?.value, 7);
  assert.deepEqual(vars(changing[4].vars), { score: 7 });
  assert.equal(changing[3].console.length, 0);
  const types = buildSnapshots(sample('strings-and-numbers'));
  assert.equal(types[2].badges.at(-1)?.value, 5);
  assert.equal(types[2].badges.at(-1)?.type, 'int');
  assert.equal(types[5].badges.at(-1)?.value, '23');
  assert.equal(types[5].badges.at(-1)?.type, 'str');
  assert.equal(types[5].console.map(chunk => chunk.text).join(''), '5\n');
});

test('control-flow examples preserve Boolean types and end a while loop on its third check', () => {
  const comparisons = buildSnapshots(sample('boolean-comparisons'));
  assert.deepEqual([comparisons[2], comparisons[5]].map(s => [s.badges[0].value, s.badges[0].type]), [[true, 'bool'], [false, 'bool']]);
  const loop = buildSnapshots(sample('while-loop'));
  assert.equal(loop.length, 15);
  assert.deepEqual([loop[2], loop[7], loop[12]].map(s => [s.line, s.vars[0].value, s.badges[0].value]), [[2, 0, true], [2, 1, true], [2, 2, false]]);
  assert.deepEqual([loop[5], loop[6], loop[10], loop[11]].map(s => s.vars[0].value), [0, 1, 1, 2]);
  assert.equal(loop[12].console.map(chunk => chunk.text).join(''), '0\n1\n');
  assert.equal(loop[13].line, 5);
  assert.equal(loop[13].badges.length, 0);
  assert.equal(loop[14].console.map(chunk => chunk.text).join(''), '0\n1\nDone\n');
});

test('malformed badge, convert, and output steps fail as lesson errors, including unknown keys', () => {
  const lesson = (step: string) => parseLesson(`language: python\ncode: x\nsteps:\n  - line: 1\n    badge: { over: x, value: 1 }\n  - ${step}\n`);
  for (const [step, message] of [
    ['badge: hello', /Step 2: `badge` needs a mapping/],
    ['convert: 5', /Step 2: `convert` needs a mapping/],
    ['badge: { over: x, value: 1, frm: x }', /Step 2: unknown badge key `frm`/],
    ['convert: { value: 2, ovr: x }', /Step 2: unknown convert key `ovr`/],
    ['print: { txt: "1", from: badge }', /Step 2: unknown output key `txt`/],
  ] as const) assert.throws(() => buildSnapshots(lesson(step)), (error: Error) => error instanceof LessonError && message.test(error.message), step);
});
