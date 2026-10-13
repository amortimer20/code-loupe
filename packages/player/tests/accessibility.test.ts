import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildSnapshots } from '../src/state';
import { parseLesson, type Lesson, type Step } from '../src/lesson';
import { listAccessibleName, stepAnnouncement } from '../src/visuals/accessibility';

const fixture = (steps: Step[]): Lesson => ({ language: 'python', code: 'inspect(numbers)\nreturn numbers', steps });

test('list labels follow selections and action aliases without hiding shared identity', () => {
  const states = buildSnapshots(fixture([
    { line: 1, assign: { var: 'numbers', value: [1, 2] } },
    { assign: { var: 'other', ref: 'list-1' } },
    { select: 'other[1]' },
    { remove: 'numbers[0]' },
    { select: null, append: { target: 'other', value: 3 } },
    { assign: { var: 'numbers', value: 0 } },
    { assign: { var: 'other', value: 0 } },
  ]));
  assert.equal(listAccessibleName(states[1], 'list-1'), 'numbers');
  assert.equal(listAccessibleName(states[3], 'list-1'), 'other');
  assert.equal(listAccessibleName(states[4], 'list-1'), 'other');
  assert.equal(listAccessibleName(states[5], 'list-1'), 'other');
  assert.equal(listAccessibleName(states[6], 'list-1'), 'other');
  assert.equal(listAccessibleName(states[7], 'list-1'), 'list-1');
});

test('list labels disambiguate shadowing, active aliases, and recursive frames', () => {
  const states = buildSnapshots(fixture([
    { line: 1, assign: { var: 'numbers', value: [1] } },
    { call: { name: 'inspect', over: 'inspect(numbers)', line: 1, args: [{ var: 'numbers', value: [9] }] } },
    { call: { name: 'inspect', over: 'inspect(numbers)', line: 2, args: [{ var: 'numbers', ref: 'list-1' }] } },
    { select: { target: 'numbers[0]', scope: 'global' } },
    { select: null },
  ]));
  assert.equal(listAccessibleName(states[2], 'list-2'), 'inspect #1.numbers');
  assert.equal(listAccessibleName(states[3], 'list-1'), 'inspect #2.numbers');
  assert.equal(listAccessibleName(states[3], 'list-2'), 'inspect #1.numbers');
  assert.equal(listAccessibleName(states[4], 'list-1'), 'numbers');
  assert.equal(listAccessibleName(states[5], 'list-1'), 'inspect #2.numbers');
});

test('step announcements describe uncaptioned values, state, output, and prior snapshots', () => {
  const states = buildSnapshots(fixture([
    { line: 1, badge: { over: 'numbers', value: [true, null] } },
    { assign: { var: 'numbers', from: 'badge' } },
    { badge: { over: 'numbers', value: [true, null], from: 'numbers' } },
    { print: { text: '[True, None]', from: 'badge' }, caption: 'Read the list.' },
    { append: { target: 'numbers', value: false } },
  ]));
  assert.match(stepAnnouncement(states[0], 0, 5, 'python'), /Step 0 of 5.*Ready/);
  assert.match(stepAnnouncement(states[1], 1, 5, 'python'), /Value of numbers: \[True, None\], list/);
  assert.match(stepAnnouncement(states[2], 2, 5, 'python'), /numbers is \[True, None\]/);
  assert.match(stepAnnouncement(states[3], 3, 5, 'python'), /Value of numbers: \[True, None\], list/);
  assert.match(stepAnnouncement(states[4], 4, 5, 'python'), /Output: \[True, None\].*Read the list/);
  assert.match(stepAnnouncement(states[5], 5, 5, 'python'), /numbers is \[True, None, False\]/);
  assert.doesNotMatch(stepAnnouncement(states[3], 3, 5, 'python'), /False|Output/);
});

test('call, return, field mutation, and program errors have meaningful announcements', () => {
  for (const name of ['nested-function-call', 'dictionary-fields', 'class-instance', 'syntax-error', 'runtime-error']) {
    const lesson = parseLesson(readFileSync(new URL(`../../../lessons/python/${name}/lesson.yaml`, import.meta.url), 'utf8'));
    const states = buildSnapshots(lesson);
    for (const [index, state] of states.entries()) {
      const message = stepAnnouncement(state, index, states.length - 1, lesson.language);
      if (state.events.called) assert.match(message, /In .*frame/);
      if (state.events.returned) assert.match(message, /Return value:/);
      if (state.events.updated && 'key' in state.events.updated) assert.match(message, /student\["score"\] is 7/);
      if (state.events.updated && 'attribute' in state.events.updated) assert.match(message, /self.name is "Ada"/);
      if (state.error) assert.ok(message.includes(state.error.name) && message.includes(state.error.message));
    }
  }
});

test('a source read followed by a rebind uses surviving aliases or the orphan id', () => {
  for (const local of [false, true]) {
    for (const alias of [false, true]) {
      const setup: Step[] = local ? [
        { line: 1 },
        { call: { name: 'inspect', line: 2, over: 'inspect(numbers)', args: [{ var: 'numbers', value: [1] }] } },
      ] : [{ line: 2, assign: { var: 'numbers', value: [1] } }];
      if (alias) setup.push({ assign: { var: 'saved', ref: 'list-1' } });
      for (const replacement of [1, [9]]) {
        const states = buildSnapshots(fixture([...setup, {
          badge: { over: 'numbers', value: [1], from: 'numbers' },
          assign: { var: 'numbers', value: replacement },
        }]));
        const last = states.at(-1)!;
        const prefix = local ? 'inspect #1.' : '';
        assert.equal(listAccessibleName(last, 'list-1'), alias ? prefix + 'saved' : 'list-1');
        if (Array.isArray(replacement)) assert.equal(listAccessibleName(last, 'list-2'), prefix + 'numbers');
        assert.equal(listAccessibleName(states.at(-2)!, 'list-1'), prefix + 'numbers');
      }
    }
  }
});

test('combined assignment and collection mutation announce both bindings and restore earlier values', () => {
  for (const [mutation, contents] of [
    [{ update: { target: 'numbers[0]', value: 9 } }, '[9, 2]'],
    [{ append: { target: 'numbers', value: 3 } }, '[1, 2, 3]'],
    [{ remove: 'numbers[0]' }, '[2]'],
  ] satisfies [Step, string][]) {
    const states = buildSnapshots(fixture([
      { line: 1, assign: { var: 'numbers', value: [1, 2] } },
      { assign: { var: 'result', value: null }, ...mutation },
    ]));
    const message = stepAnnouncement(states[2], 2, 2, 'python');
    assert.ok(message.includes('result is None.') && message.includes('numbers is ' + contents + '.'), message);
    const previous = stepAnnouncement(states[1], 1, 2, 'python');
    assert.ok(previous.includes('numbers is [1, 2].'), previous);
    assert.doesNotMatch(previous, /result/);
  }
});

test('overlapping list targets are narrated once, but object bindings and field writes both survive', () => {
  const sameList = buildSnapshots(fixture([
    { line: 1, assign: { var: 'numbers', value: [1] }, append: { target: 'numbers', value: 2 } },
  ]));
  assert.equal(stepAnnouncement(sameList[1], 1, 1, 'python').split('numbers is [1, 2].').length - 1, 1);
  for (const instance of [false, true]) {
    const target = instance ? 'numbers.score' : 'numbers["score"]';
    const states = buildSnapshots(fixture([
      { line: 1, allocate: { id: 'record', fields: { score: 1 }, ...(instance ? { class: 'Student' } : {}) } },
      { assign: { var: 'numbers', ref: 'record' }, update: { target, value: 2 } },
    ]));
    const message = stepAnnouncement(states[2], 2, 2, 'python');
    assert.ok(message.includes('numbers points to record.') && message.includes(target + ' is 2.'), message);
  }
});
