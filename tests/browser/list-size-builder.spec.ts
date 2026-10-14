import { test, expect, ready, goTo, canonical } from './helpers';
import { parseLesson } from '../../packages/player/src/lesson';

for (const [slug, action, before, after] of [
  ['list-append', 'append', ['2','4'], ['2','4','6']],
  ['list-removal', 'remove', ['2','4','6'], ['2','6']],
] as const) {
  test(`${slug} mutation forms preserve source and support backward playback and Undo`, async ({ page }) => {
    await page.goto(`/playground/?sample=python/${slug}`);
    const player = await ready(page, 6), original = await canonical(slug);
    await page.locator('[data-step="2"]').click();
    if (action === 'append') {
      await expect(page.getByLabel('List', { exact:true })).toHaveValue('numbers');
      await expect(page.getByLabel('Value source', { exact:true })).toHaveValue('badge');
    } else {
      await expect(page.getByLabel('List element', { exact:true })).toHaveValue('numbers[1]');
      await expect(page.getByLabel('Value source', { exact:true })).toHaveCount(0);
    }
    await page.getByLabel('Caption', { exact:true }).fill('Watch the list length change.');
    await page.getByRole('button', { name:'Save step', exact:true }).click();
    await expect(page.locator('#preview-status')).toHaveText('Ready · 6 steps');
    const changed = await page.locator('#lesson-source').inputValue();
    const expected = parseLesson(original); expected.steps[2].caption = 'Watch the list length change.';
    expect(parseLesson(changed)).toEqual(expected);
    const cells = player.locator('.heap-object[data-ref="list-1"] .collection-item');
    await goTo(player, 3); await expect(cells).toHaveText([...after]);
    await goTo(player, 2); await expect(cells).toHaveText([...before]);
    await page.getByRole('button', { name:'Undo', exact:true }).click();
    await expect(page.locator('#lesson-source')).toHaveValue(original);
    await page.getByRole('button', { name:'Redo', exact:true }).click();
    await expect(page.locator('#lesson-source')).toHaveValue(changed);
    await page.reload(); await ready(page, 6);
    await expect(page.locator('#lesson-source')).toHaveValue(changed);
  });
}

test('append and remove forms build an empty-list round trip in the narrow plain editor', async ({ page }) => {
  await page.route('**/monaco-lesson-editor*.js', route => route.abort());
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/playground/?new=1');
  await page.getByRole('tab', { name:'YAML', exact:true }).click();
  const base = 'language: python\ncode: |\n  numbers = []\n  numbers.append(2)\n  del numbers[0]\nsteps:\n  - line: 1\n    assign: { var: numbers, value: [] }\n';
  await page.locator('#lesson-source').fill(base);
  const player = await ready(page, 1);
  await page.getByRole('tab', { name:'Builder', exact:true }).click();
  await page.locator('#builder-new-action').selectOption('append');
  await page.getByRole('button', { name:'Add step', exact:true }).click();
  await page.getByLabel('Code line', { exact:true }).selectOption('2');
  await page.getByLabel('List', { exact:true }).selectOption('numbers');
  await page.getByLabel('Value source', { exact:true }).selectOption('badge');
  await page.getByRole('button', { name:'Save step', exact:true }).click();
  await expect(page.locator('[data-step-form] .builder-field-error')).toContainText('there is no badge');
  await expect(page.locator('#lesson-source')).toHaveValue(base);
  await page.getByLabel('Value source', { exact:true }).selectOption('literal');
  await page.getByLabel('Value', { exact:true }).fill('oops');
  await page.getByRole('button', { name:'Save step', exact:true }).click();
  await expect(page.locator('[data-step-form] .builder-field-error')).toContainText('finite number');
  await page.getByRole('tab', { name:'YAML', exact:true }).click();
  await page.getByRole('tab', { name:'Builder', exact:true }).click();
  await expect(page.getByLabel('Value', { exact:true })).toHaveValue('oops');
  await page.getByLabel('Value', { exact:true }).fill('2');
  await page.getByRole('button', { name:'Save step', exact:true }).click();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 2 steps');
  await expect(player.locator('.heap-object .collection-item')).toHaveText('2');
  await page.locator('#builder-new-action').selectOption('remove');
  await page.getByRole('button', { name:'Add step', exact:true }).click();
  await page.getByLabel('Code line', { exact:true }).selectOption('3');
  await page.getByRole('button', { name:'Save step', exact:true }).click();
  await expect(page.locator('[data-step-form] .builder-field-error')).toContainText('element to remove');
  await page.getByLabel('List element', { exact:true }).selectOption('numbers[0]');
  await page.getByRole('button', { name:'Save step', exact:true }).click();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 3 steps');
  await expect(player.locator('.heap-object .collection')).toHaveText('[]');
  await goTo(player, 2); await expect(player.locator('.heap-object .collection-item')).toHaveText('2');
  await goTo(player, 3); await expect(player.locator('.heap-object .collection-item')).toHaveCount(0);
  await page.getByRole('button', { name:'Undo', exact:true }).click();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 2 steps');
  expect(parseLesson(await page.locator('#lesson-source').inputValue()).steps[1].append).toEqual({ target:'numbers', value:2 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
