import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { test, expect, ready, canonical, fillLessonSource, goTo, selectTheme } from './helpers';
import type { Page } from '@playwright/test';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

test('saved legacy address syntax can be explicitly updated, undone, and restored', async ({ page }) => {
  const current = await canonical('numeric-input');
  const old = current.replace("from: 'text'", 'from: { var: text }').replace("from: 'age'", 'from: { var: age }');
  await page.addInitScript(text => {
    if (!localStorage.getItem('recovery-test-started')) {
      localStorage.setItem('code-loupe:playground-draft', text);
      localStorage.setItem('recovery-test-started', 'true');
    }
  }, old);
  await page.goto('/playground/');
  await expect(page.locator('#lesson-error')).toContainText('from.var');
  await expect(page.locator('#lesson-source')).toHaveValue(old);
  await page.getByRole('button', { name: 'Update draft syntax' }).click();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 9 steps');
  await expect(page.locator('#draft-recovery')).toBeHidden();
  const updated = await page.locator('#lesson-source').inputValue();
  expect(parse(updated)).toEqual(parse(current));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(old);
  await expect(page.locator('#draft-recovery')).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 9 steps');
  await page.reload();
  await expect(page.locator('#lesson-source')).toHaveValue(updated);
  await expect(page.locator('#preview-status')).toHaveText('Ready · 9 steps');
  await expect(page.locator('#draft-recovery')).toBeHidden();
});

const form = (page: Page) => page.locator('[data-step-form]');
async function details(page: Page, code: string, title: string) {
  await page.locator('.builder-details summary').click();
  await page.locator('[data-details]').getByLabel('Title', { exact: true }).fill(title);
  await page.locator('[data-details]').getByLabel('Displayed code').fill(code);
  await page.getByRole('button', { name: 'Save lesson details', exact: true }).click();
}
async function add(page: Page, action: string) {
  await page.locator('#builder-new-action').selectOption(action);
  await page.getByRole('button', { name: 'Add step', exact: true }).click();
}
async function apply(page: Page, steps: number) {
  await form(page).getByRole('button', { name: 'Save step', exact: true }).click();
  await expect(form(page).locator('.builder-field-error')).toBeHidden();
  await expect(page.locator('#preview-status')).toHaveText(`Ready · ${steps} steps`);
}

test('builds an arithmetic explanation from a blank lesson with the real preview and download', async ({ page }) => {
  await page.goto('/playground/?new=1');
  await expect(page.locator('#builder-new-action')).toBeVisible();
  await details(page, 'print(2 + 3)\n', 'Arithmetic');
  await add(page, 'highlight');
  await form(page).getByLabel('Caption', { exact: true }).fill('Evaluate the addition first.');
  await apply(page, 1);
  await add(page, 'badge');
  await form(page).getByLabel('Expression text').fill('2 + 3');
  await form(page).getByLabel('Value', { exact: true }).fill('5');
  await form(page).getByLabel('Caption', { exact: true }).fill('The result is 5.');
  await apply(page, 2);
  await add(page, 'print');
  await form(page).getByLabel('Output source').selectOption('badge');
  await form(page).getByLabel('Output text').fill('5');
  await apply(page, 3);
  const player = await ready(page, 3);
  await expect(player.locator('.console pre')).toContainText('5');
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(3);
  await page.locator('[data-step="1"]').click();
  await expect(player.locator('.console pre')).not.toContainText('5');
  await expect(player.locator('.badge')).toContainText('5');
  await goTo(player, 3);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download YAML' }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('lesson-draft.yaml');
  const yaml = await readFile((await download.path())!, 'utf8');
  expect(parse(yaml).steps[2].print).toEqual({ text: '5', from: 'badge' });
  await page.reload();
  await expect(page.locator('#lesson-source')).toHaveValue(yaml);
  await expect(page.locator('.builder-card')).toHaveCount(3);
});

test('builds naming-value with scalar assignment and a source read filled from earlier state', async ({ page }) => {
  await page.goto('/playground/?new=1');
  await expect(page.locator('#builder-new-action')).toBeVisible();
  await details(page, 'score = 5\nprint(score)\n', 'Naming a value');
  await add(page, 'assign');
  await form(page).getByLabel('Code line').selectOption('1');
  await form(page).getByLabel('Variable name').fill('score');
  await form(page).getByLabel('Value', { exact: true }).fill('5');
  await apply(page, 1);
  await add(page, 'badge');
  await form(page).getByLabel('Code line').selectOption('2');
  await form(page).getByLabel('Expression text').fill('score');
  await form(page).getByLabel('Value source').selectOption('score');
  await apply(page, 2);
  await add(page, 'print');
  await form(page).getByLabel('Output source').selectOption('badge');
  await form(page).getByLabel('Output text').fill('5');
  await apply(page, 3);
  const player = await ready(page, 3);
  await expect(player.locator('.globals')).toContainText(/score\s*=\s*5/);
  await expect(player.locator('.console pre')).toContainText('5');
  const raw = parse(await page.locator('#lesson-source').inputValue());
  expect(raw.steps[1].badge.from).toBe('score'); expect(raw.steps[1].badge.value).toBe(5);
});

test('builder and YAML share undo/redo and preserve exact no-edit source and current preview on theme change', async ({ page }) => {
  const original = await canonical('simple-arithmetic');
  await page.goto('/playground/?sample=python/simple-arithmetic');
  await expect(page.locator('[data-step-form]')).toBeVisible();
  await page.getByRole('tab', { name: 'YAML', exact: true }).click();
  await page.getByRole('tab', { name: 'Builder', exact: true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await form(page).getByLabel('Caption', { exact: true }).fill('A changed explanation.');
  await apply(page, 3);
  const changed = await page.locator('#lesson-source').inputValue();
  await fillLessonSource(page, changed + '\n# source edit\n');
  await page.getByRole('tab', { name: 'Builder', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(changed);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(changed);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(changed + '\n# source edit\n');
  await page.locator('[data-step="1"]').click();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 3 steps');
  await selectTheme(page, 'paper');
  expect(await page.locator('code-loupe').evaluate(el => (el as CodeLoupe).step)).toBe(2);
  await expect(page.locator('#lesson-source')).toHaveValue(changed + '\n# source edit\n');
});

test('incomplete form values survive view switching and stale forms cannot overwrite YAML', async ({ page }) => {
  await page.goto('/playground/?sample=python/simple-arithmetic');
  await expect(page.locator('[data-step-form]')).toBeVisible();
  await page.locator('[data-step="1"]').click();
  const original = await page.locator('#lesson-source').inputValue();
  await form(page).getByLabel('Value', { exact: true }).fill('not a number');
  await form(page).getByRole('button', { name: 'Save step', exact: true }).click();
  await expect(form(page).locator('[role="alert"]')).toContainText('finite number');
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await page.getByRole('tab', { name: 'YAML', exact: true }).click();
  await page.getByRole('tab', { name: 'Builder', exact: true }).click();
  await expect(form(page).getByLabel('Value', { exact: true })).toHaveValue('not a number');
  const different = original.replace('value: 5', 'value: 7');
  await fillLessonSource(page, different);
  await page.getByRole('tab', { name: 'Builder', exact: true }).click();
  await form(page).getByLabel('Value', { exact: true }).fill('8');
  await form(page).getByRole('button', { name: 'Save step', exact: true }).click();
  await expect(form(page).locator('[role="alert"]')).toContainText('changed in YAML');
  await expect(page.locator('#lesson-source')).toHaveValue(different);
  await form(page).getByRole('button', { name: 'Discard edits', exact: true }).click();
  await expect(form(page).getByLabel('Value', { exact: true })).toHaveValue('7');
});

test('advanced actions and invalid source stay intact while captions remain editable', async ({ page }) => {
  const original = await canonical('nested-function-call');
  await page.goto('/playground/?sample=python/nested-function-call');
  await expect(page.locator('.builder-card')).toHaveCount(19);
  const callIndex = parse(original).steps.findIndex((step: Record<string, unknown>) => step.call);
  await page.locator(`[data-step="${callIndex}"]`).click();
  await expect(form(page)).toContainText('This action is preserved');
  await form(page).getByLabel('Caption', { exact: true }).fill('Enter the function.');
  await apply(page, 19);
  const expected = parse(original); expected.steps[callIndex].caption = 'Enter the function.';
  expect(parse(await page.locator('#lesson-source').inputValue())).toEqual(expected);
  await fillLessonSource(page, 'language: python\nsteps: [\n');
  await page.getByRole('tab', { name: 'Builder', exact: true }).click();
  await expect(page.locator('#builder-pane [role="alert"]')).toContainText('Repair the YAML');
  await expect(page.locator('#lesson-source')).toHaveValue('language: python\nsteps: [\n');
});

test('typed scalar values and shared history work in the plain-editor fallback on a narrow screen', async ({ page }) => {
  await page.route('**/monaco-lesson-editor*.js', route => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/playground/?new=1');
  await expect(page.locator('#builder-new-action')).toBeVisible();
  await details(page, 'x = 1\n', 'Values');
  await add(page, 'assign');
  await form(page).getByLabel('Code line').selectOption('1');
  await form(page).getByLabel('Variable name').fill('x');
  for (const [kind, value, expected] of [['Number', '1', 1], ['Text', '1', '1'], ['Boolean', 'true', true], ['None', '', null]] as const) {
    await form(page).getByLabel('Value type').selectOption(kind);
    if (kind === 'Boolean') await form(page).getByLabel('Value', { exact: true }).selectOption(value);
    else if (kind !== 'None') await form(page).getByLabel('Value', { exact: true }).fill(value);
    await apply(page, 1);
    expect(parse(await page.locator('#lesson-source').inputValue()).steps[0].assign.value).toBe(expected);
  }
  const before = await page.locator('#lesson-source').inputValue();
  await page.getByRole('tab', { name: 'YAML', exact: true }).click();
  await page.locator('#lesson-source').fill(before + '\n# fallback edit\n');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(before + '\n# fallback edit\n');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});


test('cancels an unsaved step and restores a saved deletion with Undo', async ({ page }) => {
  await page.goto('/playground/?new=1');
  await expect(page.locator('#builder-new-action')).toBeVisible();
  const original = await page.locator('#lesson-source').inputValue();
  await add(page, 'badge');
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await form(page).getByRole('button', { name: 'Cancel new step' }).click();
  await expect(page.locator('.builder-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add step', exact: true })).toBeFocused();
  await add(page, 'highlight');
  await form(page).getByLabel('Caption', { exact: true }).fill('A saved step.');
  await apply(page, 1);
  const saved = await page.locator('#lesson-source').inputValue();
  await form(page).getByLabel('Caption', { exact: true }).fill('Do not save this.');
  await form(page).getByRole('button', { name: 'Discard edits' }).click();
  await expect(form(page).getByLabel('Caption', { exact: true })).toHaveValue('A saved step.');
  await form(page).getByRole('button', { name: 'Delete step' }).click();
  await expect(page.locator('.builder-card')).toHaveCount(0);
  await expect(page.locator('#preview-status')).toHaveText('Ready · 0 steps');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(saved);
  await expect(page.locator('.builder-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.builder-card')).toHaveCount(0);
});

test('deletion preserves later cards and their unsaved form edits', async ({ page }) => {
  const source = await canonical('simple-arithmetic');
  await page.goto('/playground/?sample=python/simple-arithmetic');
  await expect(page.locator('.builder-card')).toHaveCount(3);
  await page.locator('[data-step="2"]').click();
  await form(page).getByLabel('Caption', { exact: true }).fill('Pending output caption.');
  await page.locator('[data-step="0"]').click();
  await form(page).getByRole('button', { name: 'Delete step', exact: true }).click();
  await expect(page.locator('.builder-card')).toHaveCount(2);
  const expected = parse(source); expected.steps.splice(0, 1);
  expect(parse(await page.locator('#lesson-source').inputValue())).toEqual(expected);
  await expect(page.locator('#lesson-error')).toBeVisible();
  await form(page).getByLabel('Code line').selectOption('1');
  await apply(page, 2);
  await page.locator('[data-step="1"]').click();
  await expect(form(page).getByLabel('Caption', { exact: true })).toHaveValue('Pending output caption.');
  await apply(page, 2);
});

for (const fallback of [false, true]) {
  test(`broken YAML recovers from a persisted working lesson with shared undo (${fallback ? 'plain' : 'Monaco'} editor)`, async ({ page }) => {
    if (fallback) await page.route('**/monaco-lesson-editor*.js', route => route.abort());
    await page.goto('/playground/?sample=python/simple-arithmetic');
    await expect(form(page)).toBeVisible();
    await form(page).getByLabel('Caption', { exact: true }).fill('A saved working caption.');
    await apply(page, 3);
    const working = await page.locator('#lesson-source').inputValue();
    await page.locator('[data-step="2"]').click();
    const broken = working.replace('steps:', '');
    if (fallback) {
      await page.getByRole('tab', { name: 'YAML', exact: true }).click();
      await page.locator('#lesson-source').fill(broken);
    } else await fillLessonSource(page, broken);
    await expect(page.locator('#working-recovery')).toBeVisible();
    await page.getByRole('tab', { name: 'Builder', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Restore last working lesson' })).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('#lesson-source')).toHaveValue(working);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.locator('#lesson-source')).toHaveValue(broken);
    await page.getByRole('button', { name: 'Restore last working lesson' }).click();
    await expect(page.locator('#preview-status')).toHaveText('Ready · 3 steps');
    await expect(page.locator('[data-step="0"]')).toBeFocused();
    expect(await page.locator('code-loupe').evaluate(el => (el as CodeLoupe).step)).toBe(1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('#lesson-source')).toHaveValue(broken);
    await page.reload();
    await expect(page.locator('#working-recovery')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Restore last working lesson' }).click();
    await expect(page.locator('#lesson-source')).toHaveValue(working);
    await expect(page.locator('#preview-status')).toHaveText('Ready · 3 steps');
    await expect(page.locator('#working-recovery')).toBeHidden();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('#lesson-source')).toHaveValue(broken);
    await expect(page.locator('#working-recovery')).toBeVisible();
  });
}

test('a broken saved draft without a checkpoint offers the starting sample without replacing it automatically', async ({ page }) => {
  const original = await canonical('simple-arithmetic');
  const broken = original.replace('steps:', '');
  await page.addInitScript(text => localStorage.setItem('code-loupe:playground-draft:python/simple-arithmetic', text), broken);
  await page.goto('/playground/?sample=python/simple-arithmetic');
  await expect(page.locator('#lesson-source')).toHaveValue(broken);
  await expect(page.getByRole('button', { name: 'Restore last working lesson' })).toBeEnabled();
  await page.getByRole('button', { name: 'Restore last working lesson' }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await expect(page.locator('#preview-status')).toHaveText('Ready · 3 steps');
});


test('a new card preserves the working preview and source until one successful save', async ({ page }) => {
  await page.goto('/playground/?sample=python/simple-arithmetic');
  await expect(form(page)).toBeVisible();
  const original = await page.locator('#lesson-source').inputValue();
  const player = await ready(page, 3);
  const step = await player.evaluate(el => (el as CodeLoupe).step);
  await add(page, 'badge');
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await expect(page.locator('#preview-status')).toHaveText('Ready · 3 steps');
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(step);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await form(page).getByLabel('Expression text').fill('missing');
  await form(page).getByRole('button', { name: 'Save step' }).click();
  await expect(form(page).locator('.builder-field-error')).toBeVisible();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await expect(page.locator('#lesson-error')).toBeHidden();
  await page.getByRole('tab', { name: 'YAML', exact: true }).click();
  await page.getByRole('tab', { name: 'Builder', exact: true }).click();
  await expect(form(page).getByLabel('Expression text')).toHaveValue('missing');
  await expect(page.locator('.builder-card')).toHaveCount(4);
  await page.locator('[data-step="0"]').click();
  await page.getByRole('button', { name: 'Edit new step', exact: true }).click();
  await expect(page.locator('.builder-card')).toHaveCount(4);
  await form(page).getByLabel('Expression text').fill('2 + 3');
  await form(page).getByLabel('Value', { exact: true }).fill('5');
  await apply(page, 4);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await expect(page.locator('.builder-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.builder-card')).toHaveCount(4);
});

test('optional controls stay compact, reveal repeated expressions, and retain authored settings', async ({ page }) => {
  await page.goto('/playground/?new=1');
  await expect(page.locator('#builder-new-action')).toBeVisible();
  await details(page, 'print(x + x)\n', 'Repeated expression');
  await add(page, 'badge');
  await expect(form(page).getByLabel('Occurrence')).toBeHidden();
  await expect(form(page).getByLabel('Number display')).toBeHidden();
  await form(page).getByLabel('Expression text').fill('x');
  await expect(form(page).getByLabel('Occurrence')).toBeVisible();
  await form(page).getByLabel('Occurrence').fill('2');
  await form(page).locator('.builder-options summary').click();
  await form(page).getByLabel('Number display').selectOption('float');
  await form(page).getByLabel('Value', { exact: true }).fill('5');
  await apply(page, 1);
  const source = await page.locator('#lesson-source').inputValue();
  expect(parse(source).steps[0].badge).toMatchObject({ nth: 2, type: 'float', value: 5 });
  await expect(form(page).getByLabel('Number display')).toBeVisible();
  await form(page).getByLabel('Caption', { exact: true }).fill('Keep the explicit settings.');
  await apply(page, 1);
  expect(parse(await page.locator('#lesson-source').inputValue()).steps[0].badge).toMatchObject({ nth: 2, type: 'float' });
  await form(page).getByLabel('Occurrence').fill('1');
  await form(page).getByLabel('Expression text').fill('x + x');
  await expect(form(page).getByLabel('Occurrence')).toBeHidden();
  await apply(page, 1);
  await expect(form(page).getByLabel('Occurrence')).toBeHidden();
});
