import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { highlightLesson, highlightLiterals } from '../src/highlight';
import { parseLesson } from '../src/lesson';
import { buildSnapshots } from '../src/state';

const load = (name: string) => {
  const lesson = parseLesson(readFileSync(new URL(`../../../lessons/python/${name}/lesson.yaml`, import.meta.url), 'utf8'));
  return { lesson, snapshots: buildSnapshots(lesson) };
};

test('literal highlighting collects every value a lesson can display, once each', async () => {
  const expected: Record<string, string[]> = {
    'numeric-input': ['"30"', '30', '70'],
    'list-update': ['2', '4', '6', '10', '[2, 4, 6]', '[2, 10, 6]'],
    'dictionary-fields': ['"Ada"', '5', '7'],
    conditional: ['16', 'False'],
  };
  for (const [name, texts] of Object.entries(expected)) {
    const { lesson, snapshots } = load(name);
    const literals = await highlightLiterals(lesson, snapshots, 'github-dark');
    assert.deepEqual([...literals.keys()].sort(), [...texts].sort(), name);
  }
  const { lesson, snapshots } = load('list-update');
  const literals = await highlightLiterals(lesson, snapshots, 'github-dark');
  assert.match(literals.get('10')!, /^<span style="color:#[0-9A-Fa-f]{6}">10<\/span>$/);
});

test('a starter preset supplies its palette and a regular Shiki theme does not', async () => {
  const { lesson, snapshots } = load('list-update');
  const preset = await highlightLesson(lesson, snapshots, () => 'midnight');
  assert.equal(preset.preset?.variant, 'dark');
  assert.equal(preset.variant, 'dark');
  assert.match(preset.codeHtml, /class="shiki code-loupe-midnight"/);
  const shiki = await highlightLesson(lesson, snapshots, () => 'github-light');
  assert.equal(shiki.preset, undefined);
  assert.equal(shiki.variant, 'light');
  assert.match(shiki.codeHtml, /class="shiki github-light"/);
  assert.match(shiki.literals.get('10')!, /<span style="color:#[0-9A-Fa-f]{6}">10<\/span>/);
});

test('a theme change during highlighting finishes with the latest theme', async () => {
  const { lesson, snapshots } = load('list-update');
  let theme = 'github-dark';
  const pending = highlightLesson(lesson, snapshots, () => theme);
  theme = 'github-light'; // the name was read once already; the loop must notice and repeat
  const result = await pending;
  assert.match(result.codeHtml, /class="shiki github-light"/);
  assert.equal(result.variant, 'light');
});

test('a failure only counts while its theme is current', async () => {
  const { lesson, snapshots } = load('list-update');
  await assert.rejects(highlightLesson(lesson, snapshots, () => 'no-such-theme'), /Theme `no-such-theme`/);
  let theme = 'no-such-theme';
  const pending = highlightLesson(lesson, snapshots, () => theme);
  theme = 'github-dark'; // moving away from the bad theme recovers instead of failing
  assert.match((await pending).codeHtml, /class="shiki github-dark"/);
});
