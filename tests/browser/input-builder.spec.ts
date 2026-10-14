import { test, expect, ready, goTo, canonical, fillLessonSource } from './helpers';
import { parseLesson } from '../../packages/player/src/lesson';
import type { Page } from '@playwright/test';

const code = 'text = input("Enter your age: ")\nage = int(text)\nprint(f"You will be 100 in {100 - age} years!")\n';
const form = (page: Page) => page.locator('[data-step-form]');
async function add(page: Page, action: string) {
  await page.locator('#builder-new-action').selectOption(action);
  await page.getByRole('button', { name:'Add step', exact:true }).click();
}
async function save(page: Page, steps: number) {
  await form(page).getByRole('button', { name:'Save step', exact:true }).click();
  await expect(page.locator('#preview-status')).toHaveText(`Ready · ${steps} steps`);
}

test('authors the complete numeric-input lesson with forms, preserving string input and numeric conversion', async ({ page }) => {
  await page.goto('/playground/?new=1');
  await expect(page.locator('#preview-status')).toHaveText('Ready · 0 steps');
  await page.locator('.builder-details summary').click();
  await page.getByLabel('Title', { exact:true }).fill('My input lesson');
  await page.getByLabel('Displayed code', { exact:true }).fill(code);
  await page.getByRole('button', { name:'Save lesson details', exact:true }).click();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 0 steps');
  await add(page, 'write');
  await form(page).getByLabel('Output text', { exact:true }).fill('Enter your age: ');
  await save(page, 1);
  await add(page, 'input');
  await form(page).getByLabel('Entered text', { exact:true }).fill('30');
  await save(page, 2);
  await add(page, 'badge');
  await form(page).getByLabel('Code to highlight', { exact:true }).fill('input("Enter your age: ")');
  await form(page).getByLabel('Value source', { exact:true }).selectOption('console');
  await expect(form(page)).toContainText('Latest entered text: "30"');
  await save(page, 3);
  const player = await ready(page, 3);
  await expect(player.locator('.badge .tag')).toHaveText('str');
  await add(page, 'assign');
  await form(page).getByLabel('Variable name', { exact:true }).fill('text');
  await form(page).getByLabel('Value source', { exact:true }).selectOption('badge');
  await save(page, 4);
  await add(page, 'badge');
  await form(page).getByLabel('Code line', { exact:true }).selectOption('2');
  await form(page).getByLabel('Code to highlight', { exact:true }).fill('text');
  await form(page).getByLabel('Value source', { exact:true }).selectOption('text');
  await save(page, 5);
  await add(page, 'convert');
  await form(page).getByLabel('Result expression (optional)', { exact:true }).fill('int(text)');
  await form(page).getByLabel('Value', { exact:true }).fill('30');
  await save(page, 6);
  await expect(player.locator('.badge .tag')).toHaveText('int');
  await add(page, 'assign');
  await form(page).getByLabel('Variable name', { exact:true }).fill('age');
  await form(page).getByLabel('Value source', { exact:true }).selectOption('badge');
  await save(page, 7);
  await add(page, 'badge');
  await form(page).getByLabel('Code line', { exact:true }).selectOption('3');
  await form(page).getByLabel('Code to highlight', { exact:true }).fill('100 - age');
  await form(page).getByLabel('Value', { exact:true }).fill('70');
  await save(page, 8);
  await add(page, 'print');
  await form(page).getByLabel('Output source', { exact:true }).selectOption('badge');
  await form(page).getByLabel('Output text', { exact:true }).fill('You will be 100 in 70 years!');
  await save(page, 9);
  await expect(player.locator('.console pre')).toContainText('Enter your age: 30');
  await expect(player.locator('.console pre')).toContainText('You will be 100 in 70 years!');
  const raw = await page.locator('#lesson-source').inputValue(), lesson = parseLesson(raw);
  expect(lesson.steps[1].input).toBe('30');
  expect(lesson.steps[2].badge!.value).toBe('30');
  expect(lesson.steps[5].convert!.value).toBe(30);
  await page.getByRole('button', { name:'Undo', exact:true }).click();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 8 steps');
  await page.getByRole('button', { name:'Redo', exact:true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(raw);
  await page.reload();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 9 steps');
  await expect(page.locator('#lesson-source')).toHaveValue(raw);
  await goTo(await ready(page, 9), 9);
  await expect(page.locator('code-loupe .globals')).toContainText(/age\s*=\s*30/);
});

test('conversion retains invalid pending input and picks the second result expression from preview', async ({ page }) => {
  const original = 'language: python\ncode: |\n  int(text) + int(text)\nsteps:\n  - line: 1\n    input: "30"\n  - badge: { over: text, value: "30", from: console }\n';
  await page.goto('/playground/?new=1');
  await fillLessonSource(page, original);
  await ready(page, 2);
  await page.getByRole('tab', { name:'Builder', exact:true }).click();
  await add(page, 'convert');
  await form(page).getByLabel('Value', { exact:true }).fill('30x');
  await form(page).getByRole('button', { name:'Save step', exact:true }).click();
  await expect(form(page).locator('.builder-field-error')).toContainText('finite number');
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await page.getByRole('tab', { name:'YAML', exact:true }).click();
  await page.getByRole('tab', { name:'Builder', exact:true }).click();
  await expect(form(page).getByLabel('Value', { exact:true })).toHaveValue('30x');
  await form(page).getByLabel('Value', { exact:true }).fill('30');
  await form(page).getByRole('button', { name:'Pick from preview', exact:true }).click();
  const line = page.locator('code-loupe .code-host .line');
  await line.scrollIntoViewIfNeeded();
  const box = await line.evaluate(el => {
    const nodes: Text[] = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    const range = document.createRange();
    let offset = 0;
    for (const node of nodes) {
      const end = offset + node.length;
      if (offset <= 12 && end > 12) range.setStart(node, 12 - offset);
      if (offset < 21 && end >= 21) { range.setEnd(node, 21 - offset); break; }
      offset = end;
    }
    const rect = range.getBoundingClientRect();
    return { x:rect.x, y:rect.y + rect.height / 2, width:rect.width };
  });
  await page.mouse.move(box.x + 1, box.y); await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, box.y, { steps:8 }); await page.mouse.up();
  await expect(form(page).getByLabel('Result expression (optional)', { exact:true })).toHaveValue('int(text)');
  await expect(form(page).getByLabel('Occurrence', { exact:true })).toHaveValue('2');
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await save(page, 3);
  const lesson = parseLesson(await page.locator('#lesson-source').inputValue());
  expect(lesson.steps[2].convert).toEqual({ value:30, over:'int(text)', nth:2 });
  await page.getByRole('button', { name:'Undo', exact:true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await expect(page.locator('#preview-status')).toHaveText('Ready · 2 steps');
});

test('new input forms work in the narrow plain editor and preserve canonical drafts until Save', async ({ page }) => {
  await page.route('**/monaco-lesson-editor*.js', route => route.abort());
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/playground/?sample=python/numeric-input');
  const original = await canonical('numeric-input');
  await ready(page, 9);
  await page.locator('[data-step="1"]').click();
  await expect(form(page).getByLabel('Entered text', { exact:true })).toHaveValue('30');
  await form(page).getByLabel('Caption', { exact:true }).fill('A typed response.');
  await page.getByRole('tab', { name:'YAML', exact:true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await page.getByRole('tab', { name:'Builder', exact:true }).click();
  await expect(form(page).getByLabel('Caption', { exact:true })).toHaveValue('A typed response.');
  await save(page, 9);
  await page.locator('[data-step="2"]').click();
  await expect(form(page).getByLabel('Value source', { exact:true })).toHaveValue('console');
  await expect(form(page)).toContainText('Latest entered text: "30"');
  await page.locator('[data-step="5"]').click();
  await expect(form(page).getByLabel('Result expression (optional)', { exact:true })).toHaveValue('int(text)');
  await expect(form(page).getByLabel('Value', { exact:true })).toHaveValue('30');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
