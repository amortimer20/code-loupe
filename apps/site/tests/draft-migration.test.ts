import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { parseLesson } from 'code-loupe/lesson';
import { buildSnapshots } from 'code-loupe/state';
import { migrateDraft } from '../src/authoring/draft-migration';

test('an older numeric-input draft migrates without changing outcomes or explanations', () => {
  const current = readFileSync(new URL('../../../lessons/python/numeric-input/lesson.yaml', import.meta.url), 'utf8');
  const old = '# saved teaching note\n' + current.replace("from: 'text'", 'from: { var: text }').replace("from: 'age'", 'from: { var: age }');
  assert.throws(() => buildSnapshots(parseLesson(old)), /from.var/);
  const result = migrateDraft(old)!;
  assert.equal(result.error, undefined); assert.equal(result.changes, 1);
  assert.match(result.source, /saved teaching note/);
  assert.deepEqual(parse(result.source), parse(current));
  assert.deepEqual(buildSnapshots(parseLesson(result.source)), buildSnapshots(parseLesson(current)));
});

test('migration covers every old address action, scopes and the console variable ambiguity', () => {
  const source = 'language: python\ncode: x\nsteps:\n  - badge: { over: x, value: 1, from: { var: console } }\n  - badge: { over: x, value: 1, from: { var: report, key: \'a"b]\', scope: global } }\n  - badge: { over: x, value: Ada, from: { var: ada, attribute: name } }\n  - select: { var: numbers, index: 1, scope: global }\n  - update: { var: numbers, index: 1, from: badge, scope: global }\n  - append: { var: numbers, value: 2 }\n  - remove: { var: numbers, index: 0 }\n  - assign: { var: other, value: 5 }\n';
  const result = migrateDraft(source)!; assert.equal(result.error, undefined); assert.equal(result.changes, 7);
  const steps = parse(result.source).steps;
  assert.deepEqual(steps[0].badge.from, { target: 'console' });
  assert.deepEqual(steps[1].badge.from, { target: 'report["a\\"b]"]', scope: 'global' });
  assert.equal(steps[2].badge.from, 'ada.name');
  assert.deepEqual(steps[3].select, { target: 'numbers[1]', scope: 'global' });
  assert.deepEqual(steps[4].update, { target: 'numbers[1]', from: 'badge', scope: 'global' });
  assert.deepEqual(steps[5].append, { target: 'numbers', value: 2 });
  assert.equal(steps[6].remove, 'numbers[0]');
  assert.deepEqual(steps[7].assign, { var: 'other', value: 5 });
  assert.equal(migrateDraft(result.source), null);
});

test('unsafe and ambiguous migrations leave source untouched; modern corpus needs no update', () => {
  const source = 'language: python\ncode: x\nsteps:\n  - badge: { over: x, value: 1, from: { var: x, index: -1 } }\n';
  for (const text of [source, source.replace('index: -1', 'index: 1, key: score'), source.replace('var: x', 'var: &name x'), source.replace('var: x', 'var: x, target: y')]) {
    const result = migrateDraft(text)!; assert.ok(result.error); assert.equal(result.source, text);
  }
  assert.equal(migrateDraft('steps: [\n'), null);
  const dir = new URL('../../../lessons/python/', import.meta.url);
  for (const name of readdirSync(dir)) assert.equal(migrateDraft(readFileSync(new URL(`${name}/lesson.yaml`, dir), 'utf8')), null);
});
