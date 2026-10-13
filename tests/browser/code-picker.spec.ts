import { test, expect, fillLessonSource, ready, canonical } from './helpers';
import type { Page } from '@playwright/test';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

const source = 'language: python\ncode: |\n  x = 5\n  print(x + x)\nsteps:\n  - line: 1\n    assign: { var: x, value: 5 }\n  - line: 2\n';
const form = (page: Page) => page.locator('[data-step-form]');
async function start(page: Page) {
  await page.goto('/playground/');
  await fillLessonSource(page, source);
  await expect(page.locator('#preview-status')).toHaveText('Ready · 2 steps');
  await page.getByRole('tab', { name:'Builder', exact:true }).click();
}
async function point(page: Page, line: number, offset: number) {
  const element = page.locator('code-loupe .code-host .line').nth(line - 1);
  await element.scrollIntoViewIfNeeded();
  return element.evaluate((el, offset) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    while (walker.nextNode()) {
      const node = walker.currentNode, length = node.textContent!.length;
      if (remaining < length) {
        const range = document.createRange(); range.setStart(node, remaining); range.setEnd(node, remaining + 1);
        const box = range.getBoundingClientRect();
        return { x:box.x, y:box.y + box.height / 2, width:box.width };
      }
      remaining -= length;
    }
    throw new Error('Offset not present in displayed code.');
  }, offset);
}
async function drag(page: Page, line: number, start: number, end: number, reverse = false) {
  const first = await point(page, line, start), last = await point(page, line, end - 1);
  const a = { x:first.x + 1, y:first.y }, b = { x:last.x + last.width - 1, y:last.y };
  await page.mouse.move(reverse ? b.x : a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(reverse ? a.x : b.x, b.y, { steps:8 });
  await page.mouse.up();
}

test('line picking is explicit, unsaved, cancellable and uses the shared undo history', async ({ page }) => {
  await start(page);
  const original = await page.locator('#lesson-source').inputValue(), player = await ready(page, 2);
  const step = await player.evaluate(el => (el as CodeLoupe).step);
  await player.locator('.code-host .line').nth(1).click({ position:{ x:25, y:20 } });
  await expect(form(page).getByLabel('Code line')).toHaveValue('1');
  await form(page).getByRole('button', { name:'Pick from preview' }).click();
  await form(page).getByRole('button', { name:'Cancel picking' }).click();
  await expect(form(page).locator('[data-reload-step]')).toBeHidden();
  await form(page).getByLabel('Caption', { exact:true }).fill('A pending caption.');
  await form(page).getByRole('button', { name:'Pick from preview' }).click();
  await expect(player).toHaveAttribute('data-code-picking', '');
  await page.keyboard.press('Escape');
  await expect(player).not.toHaveAttribute('data-code-picking');
  await expect(form(page).getByLabel('Caption', { exact:true })).toHaveValue('A pending caption.');
  await form(page).getByRole('button', { name:'Pick from preview' }).click();
  await player.locator('.code-host .line').nth(1).click({ position:{ x:25, y:20 } });
  await expect(form(page).getByLabel('Code line')).toHaveValue('2');
  await expect(form(page).getByLabel('Value', { exact:true })).toHaveValue('5');
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(step);
  await form(page).getByRole('button', { name:'Save step', exact:true }).click();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 2 steps');
  await page.getByRole('button', { name:'Undo', exact:true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
});

test('dragging the second expression fills the occurrence, preserves authored values, and saves once', async ({ page }) => {
  await start(page);
  const original = await page.locator('#lesson-source').inputValue();
  await page.locator('#builder-new-action').selectOption('badge');
  await page.getByRole('button', { name:'Add step', exact:true }).click();
  await form(page).getByLabel('Value', { exact:true }).fill('5');
  await form(page).getByLabel('Caption', { exact:true }).fill('Read the second x.');
  await form(page).getByRole('button', { name:'Pick from preview' }).click();
  await drag(page, 2, 6, 11);
  await expect(form(page).getByLabel('Expression text')).toHaveValue('x + x');
  await expect(form(page).getByLabel('Occurrence')).toHaveValue('1');
  await form(page).getByRole('button', { name:'Pick from preview' }).click();
  await drag(page, 2, 10, 11, true);
  await expect(form(page).getByLabel('Expression text')).toHaveValue('x');
  await expect(form(page).getByLabel('Occurrence')).toHaveValue('2');
  await expect(form(page).getByLabel('Value', { exact:true })).toHaveValue('5');
  await expect(form(page).getByLabel('Caption', { exact:true })).toHaveValue('Read the second x.');
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await form(page).getByRole('button', { name:'Save step', exact:true }).click();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 3 steps');
  await expect(page.locator('code-loupe .badge')).toContainText('5');
  await page.getByRole('button', { name:'Undo', exact:true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
});

test('cross-line picks are rejected and view changes cancel picking without changing YAML', async ({ page }) => {
  await start(page);
  await page.locator('#builder-new-action').selectOption('badge');
  await page.getByRole('button', { name:'Add step', exact:true }).click();
  await form(page).getByRole('button', { name:'Pick from preview' }).click();
  const first = await point(page, 1, 0), last = await point(page, 2, 10);
  await page.mouse.move(first.x + 1, first.y); await page.mouse.down();
  await page.mouse.move(last.x + last.width - 1, last.y, { steps:8 }); await page.mouse.up();
  await expect(form(page).locator('[data-code-pick-status]')).toContainText('one code line');
  await expect(form(page).getByLabel('Expression text')).toHaveValue('');
  await expect(page.locator('#lesson-source')).toHaveValue(source);
  await page.getByRole('tab', { name:'YAML', exact:true }).click();
  await expect(page.locator('code-loupe')).not.toHaveAttribute('data-code-picking');
  await page.getByRole('tab', { name:'Builder', exact:true }).click();
  await expect(form(page).getByLabel('Expression text')).toHaveValue('');
});

test('advanced steps keep their targets in YAML', async ({ page }) => {
  const lesson = await canonical('nested-function-call');
  await page.goto('/playground/?sample=python/nested-function-call');
  await expect(page.locator('.builder-card')).toHaveCount(19);
  await page.locator('[data-step="2"]').click();
  await expect(form(page)).toContainText('This action is preserved');
  await expect(form(page).getByRole('button', { name:'Pick from preview' })).toHaveCount(0);
  await expect(page.locator('#lesson-source')).toHaveValue(lesson);
});


test('manual occurrence controls recognize overlapping matches like the picker and player', async ({ page }) => {
  await start(page);
  await fillLessonSource(page, source.replace('print(x + x)', 'print("aaa")'));
  await expect(page.locator('#preview-status')).toHaveText('Ready · 2 steps');
  await page.getByRole('tab', { name:'Builder', exact:true }).click();
  await page.locator('#builder-new-action').selectOption('badge');
  await page.getByRole('button', { name:'Add step', exact:true }).click();
  await form(page).getByLabel('Expression text').fill('aa');
  await expect(form(page).getByLabel('Occurrence')).toBeVisible();
  await form(page).getByLabel('Occurrence').fill('2');
  await form(page).getByLabel('Value type').selectOption('Text');
  await form(page).getByLabel('Value', { exact:true }).fill('aa');
  await form(page).getByRole('button', { name:'Save step', exact:true }).click();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 3 steps');
  await expect(page.locator('code-loupe .badge')).toContainText('aa');
});
