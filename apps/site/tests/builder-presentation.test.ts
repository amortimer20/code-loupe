import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemStep, stepSummary, hasFormChanges, badgeDisplay } from '../src/authoring/builder-presentation';
import { formOf } from '../src/authoring/lesson-document';
import { parseLesson } from 'code-loupe/lesson';
import { buildSnapshots } from 'code-loupe/state';

test('problem targets accept only existing positive semantic step numbers', () => {
  assert.equal(problemStep('Step 3: mismatched badge', 4), 3);
  for (const message of ['Step 0: bad', 'Step 5: bad', 'YAML parsing failed at Step 3:', 'Step -1: bad', 'Step 1.5: bad', 'Step 999999999999999999999: bad']) assert.equal(problemStep(message, 4), undefined);
});

test('saved summaries distinguish typed values and describe binding and mutation results', () => {
  for (const [value, shown] of [[7,'7'], ['7','"7"'], [true,'True'], [null,'None'], [[1,'1'],'[1, "1"]']] as const) assert.equal(stepSummary({ assign:{ var:'total', value } }, 'python'), `Store ${shown} in total`);
  assert.equal(stepSummary({ append:{ target:'numbers', value:6 } }, 'python'), 'Append 6 to numbers');
  assert.equal(stepSummary({ append:{ target:'numbers', from:'badge' } }, 'python'), 'Append latest badge to numbers');
  assert.equal(stepSummary({ update:{ target:'numbers[1]', value:4 } }, 'python'), 'Set numbers[1] to 4');
  assert.equal(stepSummary({ badge:{ over:'x', value:5, type:'float' } }, 'python'), 'Show 5.0');
  assert.equal(stepSummary({ allocate:{ id:'chosen', value:[] } }, 'python'), 'Advanced · allocate');
});

test('pending comparisons ignore hidden fields and no-op edits, and detect meaningful changes', () => {
  const step = { badge:{ over:'x', value:1 } }, form = formOf(step)!;
  assert.equal(hasFormChanges(step, { ...form, selection:'', items:[], name:'unused' }), false);
  assert.equal(hasFormChanges(step, { ...form, value:'2' }), true);
  const source = { badge:{ over:'x', value:1, from:'x' } }, read = formOf(source)!;
  assert.equal(hasFormChanges(source, { ...read, value:'999', kind:'Text' }), false);
  assert.equal(hasFormChanges(source, { ...read, source:'literal' }), true);
  const advanced = { call:{ name:'f', line:1 }, caption:'same' };
  assert.equal(hasFormChanges(advanced, { caption:'same' }), false);
  assert.equal(hasFormChanges(advanced, { caption:'changed' }), true);
});

test('reference-backed badge previews show list contents and retain scalar type spelling', () => {
  const snapshots = buildSnapshots(parseLesson('language: python\ncode: |\n  numbers\nsteps:\n  - line: 1\n    assign: { var: numbers, value: [1, "1", true, null] }\n  - badge: { over: numbers, value: [1, "1", true, null], from: numbers }\n'));
  const last = snapshots.at(-1)!;
  assert.equal(badgeDisplay(last, last.badges[0], 'python'), '[1, "1", True, None]');
});
