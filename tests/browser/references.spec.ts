import { test, expect, ready, goTo, settle, selectTheme } from './helpers';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

test('two names share one visible list through mutation, backward stepping, scrubbing, and themes', async ({ page }, info) => {
  await page.goto('/samples/python/list-aliasing/');
  const player = await ready(page, 7);
  const object = player.locator('.heap-object[data-ref="list-1"]');
  await goTo(player, 2);
  await expect(player.locator('.heap-object')).toHaveCount(1);
  await expect(player.locator('.globals [data-ref="list-1"]')).toHaveCount(2);
  await expect(player.locator('.globals .collection-cell')).toHaveCount(0);
  await expect(object.locator('.heap-owners')).toHaveText('Referenced by: numbers, other');
  await expect(object.locator('.collection-item')).toHaveText(['2', '4']);
  await goTo(player, 3);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  if (info.project.use.reducedMotion !== 'reduce') expect(await object.locator('[data-index="2"]').evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
  await settle(player);
  await expect(object.locator('.collection-item')).toHaveText(['2', '4', '6']);
  await expect(player.locator('.heap-object')).toHaveCount(1);
  await expect(player.locator('.globals [data-name="numbers"]')).toHaveAttribute('aria-label', 'numbers points to list object list-1');
  await expect(player.locator('.globals [data-name="other"]')).toHaveAttribute('aria-label', 'other points to list object list-1');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(object.locator('.collection-item')).toHaveText(['2', '4']);
  await goTo(player, 1);
  await expect(player.locator('.globals [data-name="other"]')).toHaveCount(0);
  await expect(object).toBeVisible();
  await goTo(player, 7);
  await expect(player.locator('.console pre')).toHaveText('[2, 4, 6]\n');
  const scrub = player.getByRole('slider', { name: 'Step', exact: true });
  await scrub.focus();
  await scrub.press('Home');
  await expect(player.locator('.heap-object')).toHaveCount(0);
  for (let i = 0; i < 2; i++) await scrub.press('ArrowRight');
  await settle(player);
  await expect(object.locator('.collection-item')).toHaveText(['2', '4']);
  await expect(player.locator('.globals [data-ref="list-1"]')).toHaveCount(2);
  await goTo(player, 5);
  await selectTheme(page, 'paper');
  await expect(object.locator('[aria-current]')).toHaveAttribute('data-index', '2');
  await expect(object.locator('.collection-item')).toHaveText(['2', '4', '6']);
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 600 });
    await settle(player);
    await expect(object.locator('[aria-current]')).toBeInViewport();
    const selected = await object.locator('[aria-current]').boundingBox();
    const pane = await player.locator('.data').boundingBox();
    expect(selected!.y).toBeGreaterThanOrEqual(pane!.y);
    expect(selected!.y + selected!.height).toBeLessThanOrEqual(pane!.y + pane!.height);
    const controls = await player.locator('.controls').boundingBox();
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(600);
    expect(await page.locator('#lesson-view').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await goTo(player, 2);
    await expect(object).toBeInViewport();
    await expect(object.locator('.collection-item')).toHaveText(['2', '4']);
    await goTo(player, 5);
  }
});

test('copying shows two separate cards and restores only the copy when stepping backward', async ({ page }) => {
  await page.goto('/samples/python/list-copying/');
  const player = await ready(page, 9);
  const original = player.locator('.heap-object[data-ref="list-1"]');
  const copy = player.locator('.heap-object[data-ref="list-2"]');
  await goTo(player, 2);
  await expect(player.getByRole('region', { name: 'Objects', exact: true })).toBeVisible();
  await expect(player.getByRole('article', { name: 'List object list-1', exact: true })).toBeVisible();
  await expect(player.getByRole('article', { name: 'List object list-2', exact: true })).toBeVisible();
  await expect(player.locator('.heap-object')).toHaveCount(2);
  await expect(original.locator('.heap-owners')).toHaveText('Referenced by: numbers');
  await expect(copy.locator('.heap-owners')).toHaveText('Referenced by: other');
  await expect(original.locator('.collection-item')).toHaveText(['2', '4']);
  await expect(copy.locator('.collection-item')).toHaveText(['2', '4']);
  await goTo(player, 3);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(original.locator('.collection-item')).toHaveText(['2', '4']);
  await expect(copy.locator('.collection-item')).toHaveText(['2', '4', '6']);
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(copy.locator('.collection-item')).toHaveText(['2', '4']);
  await expect(original.locator('.collection-item')).toHaveText(['2', '4']);
  const scrub = player.getByRole('slider', { name: 'Step', exact: true });
  await scrub.focus();
  await scrub.press('Home');
  await expect(player.locator('.heap-object')).toHaveCount(0);
  await scrub.press('ArrowRight');
  await expect(player.locator('.heap-object')).toHaveCount(1);
  await expect(player.locator('.globals [data-name="other"]')).toHaveCount(0);
  await goTo(player, 5);
  await selectTheme(page, 'paper');
  await expect(copy.locator('[aria-current]')).toHaveAttribute('data-index', '2');
  await expect(original.locator('.collection-item')).toHaveText(['2', '4']);
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 600 });
    await goTo(player, 5);
    const cell = await copy.locator('[aria-current]').boundingBox();
    const pane = await player.locator('.data').boundingBox();
    expect(cell!.y).toBeGreaterThanOrEqual(pane!.y);
    expect(cell!.y + cell!.height).toBeLessThanOrEqual(pane!.y + pane!.height);
    await goTo(player, 6);
    await expect(original).toBeInViewport();
    await expect(original.locator('.collection-item')).toHaveText(['2', '4']);
    await goTo(player, 9);
    await expect(player.locator('.console pre')).toHaveText('[2, 4]\n[2, 4, 6]\n');
  }
});

test('a local reference mutates the shared card and rebindings keep distinct objects independent', async ({ page }) => {
  await page.goto('/__test/fixtures/embed.html');
  const player = await ready(page, 11);
  await player.evaluate(async el => {
    await (el as CodeLoupe).loadLesson(`language: python
code: |
  change(numbers)
  return numbers
steps:
  - line: 1
    allocate: { id: shared, value: [2, 4] }
    assign: { var: numbers, ref: shared }
  - call: { name: change, line: 2, over: change(numbers), args: [{ var: other, ref: shared }] }
  - select: { var: numbers, index: 1 }
  - remove: { var: other, index: 0 }
  - append: { var: other, value: 6 }
  - allocate: { id: separate, value: [] }
    assign: { var: other, ref: separate }
  - append: { var: other, value: 9 }
  - return: { value: null }
`);
  });
  const shared = player.locator('.heap-object[data-ref="shared"]');
  await goTo(player, 4);
  await expect(shared.locator('.collection-item')).toHaveText('4');
  await expect(shared.locator('[aria-current]')).toHaveAttribute('data-index', '0');
  await goTo(player, 5);
  await expect(shared.locator('.collection-item')).toHaveText(['4', '6']);
  await expect(shared.locator('.heap-owners')).toHaveText('Referenced by: numbers, change #1.other');
  await expect(player.locator('[data-frame-id="1"] [data-name="other"]')).toHaveAttribute('data-ref', 'shared');
  await goTo(player, 7);
  await expect(shared.locator('.collection-item')).toHaveText(['4', '6']);
  await expect(player.locator('.heap-object[data-ref="separate"] .collection-item')).toHaveText('9');
  await expect(shared.locator('.heap-owners')).toHaveText('Referenced by: numbers');
  await goTo(player, 8);
  await expect(player.locator('.heap-object[data-ref="separate"] .heap-owners')).toHaveText('No variable references');
  await expect(shared.locator('.heap-owners')).toHaveText('Referenced by: numbers');
  await goTo(player, 2);
  await expect(player.locator('.heap-object')).toHaveCount(1);
  await expect(shared.locator('.collection-item')).toHaveText(['2', '4']);
});
