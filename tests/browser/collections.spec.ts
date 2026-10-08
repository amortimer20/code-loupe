import { test, expect, ready, goTo, settle, selectTheme } from './helpers';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

test('list cells follow each iteration and restore selection through backward stepping and scrubbing', async ({ page }) => {
  await page.goto('/samples/python/list-iteration/');
  const player = await ready(page, 17);
  const list = player.locator('[data-name="numbers"]');
  for (const [step, index, value, total] of [[4, 0, 2, 0], [8, 1, 4, 2], [12, 2, 6, 6]]) {
    await goTo(player, step);
    await expect(list.locator('.collection-cell')).toHaveCount(3);
    await expect(list.locator('[aria-current="true"]')).toHaveAttribute('data-index', String(index));
    await expect(list.locator('[aria-current="true"]')).toHaveAttribute('aria-label', `numbers[${index}] is ${value}, selected`);
    await expect(player.locator('[data-name="n"] .value')).toHaveText(String(value));
    await expect(player.locator('[data-name="total"] .value')).toHaveText(String(total));
  }
  await goTo(player, 15);
  await expect(list.locator('[aria-current]')).toHaveCount(0);
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(list.locator('[aria-current]')).toHaveAttribute('data-index', '2');
  const scrub = player.getByRole('slider', { name: 'Step', exact: true });
  await scrub.focus();
  await scrub.press('Home');
  for (let i = 0; i < 7; i++) await scrub.press('ArrowRight');
  await settle(player);
  await expect(list.locator('[aria-current]')).toHaveAttribute('data-index', '1');
  await selectTheme(page, 'paper');
  await expect(list.locator('[aria-current]')).toHaveAttribute('data-index', '1');
  await goTo(player, 2);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.badge')).toContainText('2');
  await expect(list.locator('[aria-current]')).toHaveAttribute('data-index', '0');
});

test('list iteration fits laptop and narrow focus views', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/samples/python/list-iteration/');
  const player = await ready(page, 17);
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 600 });
    await goTo(player, 8);
    await expect(player.locator('.collection-cell[aria-current]')).toBeInViewport();
    const controls = await player.locator('.controls').boundingBox();
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(600);
    expect(await page.locator('#lesson-view').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await goTo(player, 17);
  await expect(player.locator('.console pre')).toHaveText('12\n');
});

test('empty and mixed lists render in local frames with explicit global selection', async ({ page }) => {
  await page.goto('/__test/fixtures/embed.html');
  const player = await ready(page, 11);
  await player.evaluate(async el => {
    await (el as CodeLoupe).loadLesson(`language: python
code: |
  inspect(numbers)
  return numbers
steps:
  - line: 1
    assign: { var: numbers, value: [true, null, "<b>text</b>"] }
  - call: { name: inspect, line: 2, over: inspect(numbers), args: [{ var: numbers, value: [] }] }
  - select: { var: numbers, index: 1, scope: global }
  - assign: { var: numbers, value: [false, "hello"] }
  - select: { var: numbers, index: 0 }
`);
  });
  await goTo(player, 2);
  const local = player.locator('[data-frame-id="1"] [data-name="numbers"]');
  await expect(local.locator('.collection')).toHaveText('[]');
  const global = player.locator('.globals [data-name="numbers"]');
  await expect(global.locator('.collection-item')).toHaveText(['True', 'None', '"<b>text</b>"']);
  await expect(global.locator('.collection b')).toHaveCount(0);
  await goTo(player, 3);
  await expect(global.locator('[aria-current]')).toHaveAttribute('data-index', '1');
  await expect(local.locator('[aria-current]')).toHaveCount(0);
  await goTo(player, 5);
  await expect(global.locator('[aria-current]')).toHaveCount(0);
  await expect(local.locator('[aria-current] .collection-item')).toHaveText('False');
});

test('element updates animate one cell and restore values through backward stepping and scrubbing', async ({ page }, info) => {
  await page.goto('/samples/python/list-update/');
  const player = await ready(page, 6);
  const cells = player.locator('[data-name="numbers"] .collection-item');
  await goTo(player, 2);
  await expect(cells).toHaveText(['2', '4', '6']);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  if (info.project.use.reducedMotion !== 'reduce') {
    expect(await player.locator('.collection-cell[data-index="1"]').evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
    expect(await player.locator('.collection-cell[data-index="0"]').evaluate(el => el.getAnimations().length)).toBe(0);
  } else expect(await player.evaluate(el => el.shadowRoot!.getAnimations().length)).toBe(0);
  await settle(player);
  await expect(cells).toHaveText(['2', '10', '6']);
  await expect(player.locator('.collection-cell[aria-current]')).toHaveAttribute('aria-label', 'numbers[1] is 10, selected');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(cells).toHaveText(['2', '4', '6']);
  await goTo(player, 6);
  await expect(player.locator('.console pre')).toHaveText('[2, 10, 6]\n');
  const scrub = player.getByRole('slider', { name: 'Step', exact: true });
  await scrub.focus();
  await scrub.press('Home');
  await scrub.press('ArrowRight');
  await scrub.press('ArrowRight');
  await settle(player);
  await expect(cells).toHaveText(['2', '4', '6']);
  await scrub.press('ArrowRight');
  await settle(player);
  await expect(cells).toHaveText(['2', '10', '6']);
  await selectTheme(page, 'terminal');
  await expect(cells).toHaveText(['2', '10', '6']);
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 600 });
  await settle(player);
  await expect(player.locator('.collection-cell[aria-current]')).toBeInViewport();
  const controls = await player.locator('.controls').boundingBox();
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(600);
  await expect(cells).toHaveText(['2', '10', '6']);
});
