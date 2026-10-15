import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseLesson } from '../src/lesson';
import { buildSnapshots } from '../src/state';

/**
 * Characterization fixture: the complete snapshots of every canonical lesson.
 * Behavior-preserving refactors of snapshot generation must leave it unchanged.
 * Regenerate only for an intentional state change, with
 * `UPDATE_CORPUS_SNAPSHOTS=1 npm test --workspace code-loupe`, then review the diff.
 */
const lessons = new URL('../../../lessons/python/', import.meta.url);
const fixture = new URL('./fixtures/corpus-snapshots.json', import.meta.url);

function currentSnapshots() {
  const result: Record<string, unknown> = {};
  for (const name of readdirSync(lessons).sort()) {
    const lesson = parseLesson(readFileSync(new URL(`${name}/lesson.yaml`, lessons), 'utf8'));
    result[name] = buildSnapshots(lesson);
  }
  return result;
}

test('canonical lesson snapshots match the checked-in fixture', () => {
  const current = currentSnapshots();
  assert.equal(Object.keys(current).length, 24);
  const text = JSON.stringify(current, null, 1) + '\n';
  if (process.env.UPDATE_CORPUS_SNAPSHOTS === '1') {
    writeFileSync(fixture, text);
    return;
  }
  const expected = JSON.parse(readFileSync(fixture, 'utf8'));
  // Compare per lesson so a failure names the lesson that changed.
  for (const name of Object.keys(current)) {
    assert.deepEqual(JSON.parse(JSON.stringify(current[name])), expected[name], `snapshots changed for ${name}`);
  }
  assert.deepEqual(Object.keys(expected).sort(), Object.keys(current).sort(), 'lesson set changed');
});
