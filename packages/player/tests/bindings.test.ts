import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LessonError, type Lesson, type Step } from '../src/lesson';
import { buildSnapshots } from '../src/state';

/** Value-reading errors for every consumer: assign, call arguments, update, append, and return. */
const lesson = (steps: object[]): Lesson => ({ language: 'python', code: 'x = f(x)\nx', steps: steps as Step[] });
const list: object[] = [{ line: 1, assign: { var: 'x', value: [1] } }];
const listBadge: object[] = [...list, { badge: { over: 'x', value: [1], from: 'x' } }];
const inFrame = (...steps: object[]): object[] => [...list, { call: { name: 'f', line: 2, over: 'f(x)' } }, ...steps];

function rejects(steps: object[], message: RegExp) {
  assert.throws(() => buildSnapshots(lesson(steps)), (error: unknown) => error instanceof LessonError && message.test(error.message), message.source);
}

test('assign and call arguments share the same value-source errors, with their own labels', () => {
  const targets: [(spec: object) => object[], string, number][] = [
    [spec => [{ line: 1, assign: { var: 'y', ...spec } }], 'assign', 1],
    [spec => [{ line: 1 }, { call: { name: 'f', line: 2, over: 'x = f(x)', args: [{ var: 'y', ...spec }] } }], 'call argument', 2],
  ];
  for (const [steps, label, at] of targets) {
    const prefix = `Step ${at}: ${label}`;
    rejects(steps({}), new RegExp(`${prefix} needs a \`value\` \\(or \`from: badge\`\\)`));
    rejects(steps({ from: 'badge' }), new RegExp(`${prefix} uses \`from: badge\` but there is no badge`));
    rejects(steps({ from: 'later' }), new RegExp(`${prefix} \`from\` must be \`badge\``));
    rejects(steps({ value: 1, from: 'later' }), new RegExp(`${prefix} \`from\` must be \`badge\``));
    rejects(steps({ value: 1, from: 'badge' }), new RegExp(`${prefix} uses \`from: badge\` but there is no badge`));
    rejects(steps({ value: 1, type: '' }), new RegExp(`${prefix} \`type\` must be nonempty text`));
    rejects(steps({ value: { a: 1 } }), new RegExp(`${prefix} needs a finite scalar value or a flat list`));
    rejects(steps({ value: [[1]] }), new RegExp(`${prefix} needs a finite scalar value or a flat list`));
    rejects(steps({ ref: '' }), new RegExp(`${prefix} \`ref\` must be nonempty text`));
    rejects(steps({ ref: 'nothing' }), new RegExp(`Step ${at}: object \`nothing\` has not been allocated`));
  }
});

test('explicit references cannot be combined with other value sources', () => {
  const allocated = { allocate: { id: 'list-9', value: [1] } };
  for (const extra of [{ value: 1 }, { from: 'badge' }, { type: 'list' }]) {
    rejects([{ line: 1, ...allocated, assign: { var: 'y', ref: 'list-9', ...extra } }], /Step 1: assign `ref` cannot be combined with value, from, or type/);
    rejects([{ line: 1, ...allocated }, { call: { name: 'f', line: 2, over: 'x = f(x)', args: [{ var: 'y', ref: 'list-9', ...extra }] } }], /Step 2: call argument `ref` cannot be combined/);
  }
});

test('a list-reference badge binds its object and refuses a type override, but only when read from the badge', () => {
  rejects([...listBadge, { assign: { var: 'y', from: 'badge', type: 'list' } }], /Step 3: reference bindings cannot override the object type/);
  rejects([...listBadge, { call: { name: 'f', line: 2, over: 'x = f(x)', args: [{ var: 'y', from: 'badge', type: 'list' }] } }], /Step 3: reference bindings cannot override the object type/);
  const states = buildSnapshots(lesson([...listBadge, { assign: { var: 'y', from: 'badge' } }]));
  assert.deepEqual(states[3].vars.map(variable => variable.value), [{ ref: 'list-1' }, { ref: 'list-1' }]);
  assert.equal(states[3].heap.length, 1);
  // An explicit value beside from: badge is a literal, so the badge's reference is not bound.
  const literal = buildSnapshots(lesson([...listBadge, { assign: { var: 'y', value: [7], from: 'badge' } }]));
  assert.deepEqual(literal[3].vars.map(variable => variable.value), [{ ref: 'list-1' }, { ref: 'list-2' }]);
});

test('update and append read scalar elements only, with their own labels', () => {
  for (const [action, base] of [['update', { target: 'x[0]' }], ['append', { target: 'x' }]] as const) {
    rejects([...list, { [action]: base }], new RegExp(`Step 2: ${action} needs a \`value\` \\(or \`from: badge\`\\)`));
    rejects([...list, { [action]: { ...base, from: 'later' } }], new RegExp(`Step 2: ${action} \`from\` must be \`badge\``));
    rejects([...list, { [action]: { ...base, from: 'badge' } }], new RegExp(`Step 2: ${action} uses \`from: badge\` but there is no badge`));
    rejects([...list, { [action]: { ...base, value: { a: 1 } } }], new RegExp(`Step 2: ${action} needs a finite scalar value or a flat list`));
    // A list-reference badge is not a scalar element, even though it can be returned or bound.
    rejects([...listBadge, { [action]: { ...base, from: 'badge' } }], new RegExp(`Step 3: ${action} needs a finite scalar value or a flat list`));
    rejects([...list, { [action]: { ...base, value: [2] } }], new RegExp(`Step 2: ${action === 'update' ? '`update` needs a scalar element value' : '`append` needs a scalar element value'}`));
  }
});

test('return reads a value, passes list references through, and reports its own errors', () => {
  rejects(inFrame({ return: {} }), /Step 3: return needs a `value` \(or `from: badge`\)/);
  rejects(inFrame({ return: { from: 'later' } }), /Step 3: return `from` must be `badge`/);
  rejects(inFrame({ return: { from: 'badge' } }), /Step 3: return uses `from: badge` but there is no badge/);
  rejects(inFrame({ return: { value: 1, type: '' } }), /Step 3: return `type` must be nonempty text/);
  rejects(inFrame({ return: { value: { a: 1 } } }), /Step 3: return needs a finite scalar value or a flat list/);
  const passthrough = [...list, { badge: { over: 'x', value: [1], from: 'x' } }, { call: { name: 'f', line: 2, over: 'x = f(x)' } }];
  // The call suspends the caller's badges, so read the list again inside the frame.
  const inside = [...passthrough, { line: 2, badge: { over: 'x', value: [1], from: 'x' } }];
  rejects([...inside, { return: { from: 'badge', type: 'list' } }], /Step 5: reference bindings cannot override the object type/);
  const returned = buildSnapshots(lesson([...inside, { return: { from: 'badge' } }]));
  assert.deepEqual(returned[5].badges.at(-1)!.value, { ref: 'list-1' });
  assert.equal(returned[5].heap.length, 1);
  // A literal list result is a value; it only becomes an object when bound.
  const literal = buildSnapshots(lesson([...passthrough, { return: { value: [5] } }]));
  assert.deepEqual(literal[4].badges.at(-1)!.value, [5]);
  assert.equal(literal[4].heap.length, 1);
});
