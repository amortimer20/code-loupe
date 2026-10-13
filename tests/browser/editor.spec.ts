import { readFile } from 'node:fs/promises';
import { test, expect, fillLessonSource, canonical, ready, selectTheme } from './helpers';

const simple = 'language: python\ncode: |\n  x = 5\nsteps:\n  - line: 1\n    assign: { var: x, value: 5 }\n';

test('source editor highlights YAML, indents, and supports undo and keyboard exit', async ({ page }) => {
  await page.goto('/playground/?sample=python/hello-world');
  await fillLessonSource(page, simple);
  const input = page.locator('#lesson-editor textarea.inputarea');
  const line = page.locator('#lesson-editor .view-line').filter({ hasText: 'language: python' });
  await expect.poll(() => line.locator('span').evaluateAll(elements =>
    new Set(elements.map(el => getComputedStyle(el).color)).size)).toBeGreaterThan(1);
  await fillLessonSource(page, simple + '# teacher note');
  await page.keyboard.press('Control+z');
  await expect(page.locator('#lesson-source')).toHaveValue(simple);
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('End');
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('steps:');
  await page.keyboard.press('Enter');
  await expect(page.locator('#lesson-source')).toHaveValue('steps:\n  ');
  await page.keyboard.press('Control+m');
  await page.keyboard.press('Tab');
  await expect(input).not.toBeFocused();
});

test('local schema supplies completions and hover help', async ({ page }) => {
  const external: string[] = [];
  page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:4321/')) external.push(req.url()); });
  await page.goto('/playground/?sample=python/hello-world');
  await fillLessonSource(page, 'language: python\n');
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Control+Space');
  const suggestion = page.getByRole('option', { name: /^code/ }).first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect(page.locator('#lesson-source')).toHaveValue(/code:/);
  await fillLessonSource(page, simple.replace('assign: { var: x, value: 5 }\n', 'assign:\n      var: x\n      '));
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Control+Space');
  await page.getByRole('option', { name: /^from/ }).first().click();
  await expect(page.locator('#lesson-source')).toHaveValue(/from: badge/);
  await fillLessonSource(page, simple);
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Control+i');
  await expect(page.getByRole('tooltip')).toContainText('Authored lessons do not execute it');
  await expect(page.getByRole('tooltip')).not.toContainText('Code Loupe authored lesson');
  expect(external).toEqual([]);
});

test('schema and semantic problems link to source and invalid drafts download unchanged', async ({ page }) => {
  await page.goto('/playground/?sample=python/hello-world');
  await fillLessonSource(page, simple + 'unknown: true\n');
  const unknown = page.locator('#editor-problems button').filter({ hasText: /unknown/ }).first();
  await expect(unknown).toBeVisible();
  await unknown.click();
  await expect(page.locator('#lesson-editor textarea.inputarea')).toBeFocused();
  await fillLessonSource(page, simple.replace('line: 1', 'line: nope'));
  await expect(page.locator('#editor-problems button').filter({ hasText: /integer/ }).first()).toBeVisible();
  const invalid = simple.replace('line: 1', 'line: 99');
  await fillLessonSource(page, invalid);
  await expect(page.locator('#lesson-error')).toContainText('Step 1:');
  await expect(page.locator('#editor-problems button').filter({ hasText: /Line 5.*Step 1:/ })).toBeVisible();
  await expect(page.locator('#lesson-editor textarea.inputarea')).toHaveAttribute('aria-invalid', 'true');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download YAML' }).click();
  expect(await readFile((await (await downloaded).path())!, 'utf8')).toBe(invalid);
  await fillLessonSource(page, simple);
  await ready(page, 1);
  await expect(page.locator('#editor-problems')).toBeHidden();
  await expect(page.locator('#lesson-editor textarea.inputarea')).not.toHaveAttribute('aria-invalid');
});

test('theme switches preserve editor selection, undo, draft bytes and preview step', async ({ page }) => {
  const original = (await canonical('hello-world')).replaceAll('\n', '\r\n');
  await page.addInitScript(text => localStorage.setItem('code-loupe:playground-draft:python/hello-world', text), original);
  await page.goto('/playground/?sample=python/hello-world');
  await expect(page.locator('#lesson-editor')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#lesson-source')).toHaveValue(original.replaceAll('\r\n', '\n'));
  let downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download YAML' }).click();
  expect(await readFile((await (await downloaded).path())!, 'utf8')).toBe(original);
  const input = page.locator('#lesson-editor textarea.inputarea');
  await fillLessonSource(page, original + '# edited');
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('Control+Shift+ArrowRight');
  await selectTheme(page, 'paper');
  await input.focus();
  // The selected word remains selected through a theme change.
  await page.keyboard.insertText('heading');
  await expect(page.locator('#lesson-source')).toHaveValue(/^heading:/);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(page.locator('#lesson-source')).toHaveValue(original.replaceAll('\r\n', '\n'));
  downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download YAML' }).click();
  expect(await readFile((await (await downloaded).path())!, 'utf8')).toBe(original);
});

test('malformed YAML is diagnosed and editor remains usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/playground/?sample=python/hello-world');
  await fillLessonSource(page, simple + 'broken: [\n');
  await expect(page.locator('#editor-problems button').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await fillLessonSource(page, simple);
  await ready(page, 1);
  await expect(page.getByRole('button', { name: 'Download YAML' })).toBeInViewport();
});

test('plain editor remains usable when the enhanced editor cannot load', async ({ page }) => {
  await page.route('**/monaco-lesson-editor*.js', route => route.abort());
  await page.goto('/playground/?sample=python/hello-world');
  await expect(page.locator('#editor-status')).toContainText('Source assistance could not load');
  const fallback = page.locator('#lesson-source');
  await expect(fallback).toBeVisible();
  await fallback.fill(simple);
  await ready(page, 1);
  await expect(page.locator('#preview-status')).toHaveText('Ready · 1 steps');
});
