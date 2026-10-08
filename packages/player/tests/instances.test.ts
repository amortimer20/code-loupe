import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLesson, type Lesson, type Step } from '../src/lesson';
import { buildSnapshots } from '../src/state';

const fixture = (steps: Step[]): Lesson => ({ language: 'python', code: 'Student("Ada")\nself.name = name', steps });
const allocate: Step = { line: 1, allocate: { id: 'instance', class: 'Student', fields: {} } };
const enter: Step = { call: { name: 'Student.__init__', line: 2, over: 'Student("Ada")', construct: 'instance', args: [{ var: 'self', ref: 'instance' }, { var: 'name', value: 'Ada' }] } };

test('class lesson initializes through self and binds the constructor result without returning the instance from __init__', () => {
  const lesson = parseLesson(readFileSync(new URL('../../../lessons/python/class-instance/lesson.yaml', import.meta.url), 'utf8'));
  const states = buildSnapshots(lesson);
  assert.equal(states.length, 11);
  assert.equal(states[1].heap.length, 0);
  assert.deepEqual(states[3].vars, []);
  assert.deepEqual(states[3].heap[0], { id: 'student-1', class: 'Student', fields: {}, type: 'Student' });
  assert.equal(states[4].frames[0].construct, 'student-1');
  assert.deepEqual(states[4].frames[0].vars.map(v => [v.name, v.value]), [['self', { ref: 'student-1' }], ['name', 'Ada']]);
  assert.equal(states[5].badges[0].nth, 2);
  assert.deepEqual(states[6].heap[0], { id: 'student-1', class: 'Student', fields: { name: 'Ada' }, type: 'Student' });
  assert.deepEqual(states[5].heap[0], states[3].heap[0]);
  assert.deepEqual(states[7].frames, []);
  assert.deepEqual(states[7].badges[0].value, { ref: 'student-1' });
  assert.equal(states[7].badges[0].type, 'Student');
  assert.deepEqual(states[7].vars, []);
  assert.deepEqual(states[8].vars[0].value, { ref: 'student-1' });
  assert.equal(states[8].events.assigned?.fromBadge, states[7].badges[0].id);
  assert.equal(states[9].events.badgeAdded?.from?.kind, 'var');
  assert.equal(states[10].console.at(-1)?.text, 'Ada\n');
});

test('attribute updates create or replace scalar attributes through scoped aliases without changing other instances', () => {
  const states = buildSnapshots(fixture([
    { ...allocate, assign: { var: 'student', ref: 'instance' } },
    { allocate: { id: 'other', class: 'Student', fields: { name: 'Grace' } }, assign: { var: 'other', ref: 'other' } },
    enter,
    { update: { var: 'self', attribute: 'name', value: 'Ada' } },
    { update: { var: 'student', scope: 'global', attribute: 'name', value: 'Lovelace' } },
    { badge: { over: 'self.name', value: 'Lovelace', from: { var: 'self', attribute: 'name' } } },
    { return: { value: null } },
    { assign: { var: 'alias', from: 'badge' } },
    { update: { var: 'alias', attribute: 'name', value: 'Ada' } },
  ]));
  assert.deepEqual(states[5].heap.map(object => 'fields' in object ? object.fields : object.value), [{ name: 'Lovelace' }, { name: 'Grace' }]);
  assert.equal(states[4].events.updated?.frameId, 1);
  assert.equal(states[5].events.updated?.frameId, 0);
  assert.deepEqual(states[8].vars.at(-1)?.value, { ref: 'instance' });
  assert.deepEqual(states[9].heap[0], { id: 'instance', class: 'Student', fields: { name: 'Ada' }, type: 'Student' });
  assert.deepEqual(states[1].heap[0], { id: 'instance', class: 'Student', fields: {}, type: 'Student' });
});

test('two-instance lesson binds each initializer to its own object and changes only the first instance', () => {
  const lesson = parseLesson(readFileSync(new URL('../../../lessons/python/two-instances/lesson.yaml', import.meta.url), 'utf8'));
  const states = buildSnapshots(lesson);
  const fields = (step: number) => states[step].heap.map(object => 'fields' in object ? object.fields : object.value);
  assert.equal(states.length, 22);
  assert.deepEqual(states[4].frames[0].vars.map(v => [v.name, v.value]), [['self', { ref: 'student-1' }], ['name', 'Ada']]);
  assert.deepEqual(fields(10), [{ name: 'Ada' }, {}]);
  assert.deepEqual(states[11].frames[0].vars.map(v => [v.name, v.value]), [['self', { ref: 'student-2' }], ['name', 'Grace']]);
  assert.deepEqual(states[11].vars.map(v => [v.name, v.value]), [['ada', { ref: 'student-1' }]]);
  assert.deepEqual(fields(13), [{ name: 'Ada' }, { name: 'Grace' }]);
  assert.deepEqual(states[14].frames, []);
  assert.deepEqual(states[14].badges[0].value, { ref: 'student-2' });
  assert.deepEqual(states[15].vars.map(v => [v.name, v.value]), [['ada', { ref: 'student-1' }], ['grace', { ref: 'student-2' }]]);
  assert.deepEqual(fields(17), [{ name: 'Lovelace' }, { name: 'Grace' }]);
  assert.deepEqual(fields(16), [{ name: 'Ada' }, { name: 'Grace' }]);
  assert.deepEqual(fields(10), [{ name: 'Ada' }, {}]);
  assert.equal(states[18].badges[0].value, 'Lovelace');
  assert.equal(states[20].badges[0].value, 'Grace');
  assert.equal(states[21].console.map(entry => entry.text).join(''), 'Lovelace\nGrace\n');
});

test('invalid class metadata, constructor bindings, and attribute operations fail before rendering', () => {
  for (const [action, pattern] of [
    ['allocate: { id: another, class: "", fields: {} }', /nonempty/],
    ['allocate: { id: another, class: 1, fields: {} }', /nonempty/],
    ['allocate: { id: another, class: Student, value: [] }', /require `fields`/],
    ['update: { var: self, attribute: "", value: 1 }', /nonempty/],
    ['update: { var: self, attribute: name, key: name, value: Ada }', /cannot combine/],
    ['update: { var: self, attribute: name, index: 0, value: Ada }', /cannot combine/],
    ['update: { var: self, attribute: name, value: [1] }', /scalar/],
    ['update: { var: self, key: name, value: Ada }', /not a dictionary/],
    ['badge: { over: self.name, value: Ada, from: { var: self, attribute: name } }', /does not exist/],
    ['badge: { over: self.name, value: Ada, from: { var: self, attribute: name, key: name } }', /cannot combine/],
    ['badge: { over: self.name, value: Ada, from: { var: self } }', /require an `attribute`/],
  ] as const) {
    const yaml = `language: python\ncode: self.name\nsteps:\n  - line: 1\n    allocate: { id: instance, class: Student, fields: {} }\n    assign: { var: self, ref: instance }\n  - ${action}\n`;
    assert.throws(() => buildSnapshots(parseLesson(yaml)), new RegExp(`Step 2:.*${pattern.source}`));
  }
  assert.throws(() => buildSnapshots(fixture([allocate, { call: { ...enter.call!, construct: 'missing' } }])), /not an allocated class instance/);
  assert.throws(() => buildSnapshots(fixture([allocate, { call: { ...enter.call!, args: [] } }])), /bind `self`/);
  assert.throws(() => buildSnapshots(fixture([{ ...allocate, allocate: { id: 'instance', fields: {} } }, enter])), /not an allocated class instance/);
  assert.throws(() => buildSnapshots(fixture([allocate, enter, { return: { value: 'Ada' } }])), /must finish with null/);
  assert.throws(() => buildSnapshots(fixture([allocate, enter, { return: { value: null } }, { convert: { value: 1 } }])), /cannot transform an object reference/);
  assert.throws(() => buildSnapshots(fixture([allocate, enter, { return: { value: null } }, { print: { text: 'instance', from: 'badge' } }])), /printing reference badges/);
  assert.throws(() => buildSnapshots(fixture([allocate, enter, { return: { value: null } }, { assign: { var: 'student', from: 'badge', type: 'dict' } }])), /cannot override/);
});
