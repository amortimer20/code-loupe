import { test, expect, ready, goTo, settle, selectTheme } from './helpers';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

test('list cells follow each iteration and restore selection through backward stepping and scrubbing', async ({ page }) => {
  await page.goto('/samples/python/list-iteration/');
  const player = await ready(page, 17);
  const list = player.locator('.heap-object[data-ref="list-1"]');
  for (const [step, index, value, total] of [[4, 0, 2, 0], [8, 1, 4, 2], [12, 2, 6, 6]]) {
    await goTo(player, step);
    await expect(list.locator('.collection-cell')).toHaveCount(3);
    await expect(list.locator('[aria-current="true"]')).toHaveAttribute('data-index', String(index));
    await expect(list.locator('[aria-current="true"]')).toHaveAttribute('aria-label', `list-1[${index}] is ${value}, selected`);
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
  - select: { target: 'numbers[1]', scope: global }
  - assign: { var: numbers, value: [false, "hello"] }
  - select: 'numbers[0]'
`);
  });
  await goTo(player, 2);
  const local = player.locator('.heap-object[data-ref="list-2"]');
  await expect(local.locator('.collection')).toHaveText('[]');
  const global = player.locator('.heap-object[data-ref="list-1"]');
  await expect(global.locator('.collection-item')).toHaveText(['True', 'None', '"<b>text</b>"']);
  await expect(global.locator('.collection b')).toHaveCount(0);
  await goTo(player, 3);
  await expect(global.locator('[aria-current]')).toHaveAttribute('data-index', '1');
  await expect(local.locator('[aria-current]')).toHaveCount(0);
  await goTo(player, 5);
  await expect(global.locator('[aria-current]')).toHaveCount(0);
  await expect(player.locator('.heap-object[data-ref="list-3"] [aria-current] .collection-item')).toHaveText('False');
  await expect(local.locator('.collection')).toHaveText('[]');
});

test('element updates animate one cell and restore values through backward stepping and scrubbing', async ({ page }, info) => {
  await page.goto('/samples/python/list-update/');
  const player = await ready(page, 6);
  const cells = player.locator('.heap-object[data-ref="list-1"] .collection-item');
  await goTo(player, 2);
  await expect(cells).toHaveText(['2', '4', '6']);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  if (info.project.use.reducedMotion !== 'reduce') {
    expect(await player.locator('.collection-cell[data-index="1"]').evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
    expect(await player.locator('.collection-cell[data-index="0"]').evaluate(el => el.getAnimations().length)).toBe(0);
  } else expect(await player.evaluate(el => el.shadowRoot!.getAnimations().length)).toBe(0);
  await settle(player);
  await expect(cells).toHaveText(['2', '10', '6']);
  await expect(player.locator('.collection-cell[aria-current]')).toHaveAttribute('aria-label', 'list-1[1] is 10, selected');
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

for (const [slug, before, after] of [
  ['list-append', ['2', '4'], ['2', '4', '6']],
  ['list-removal', ['2', '4', '6'], ['2', '6']],
] as const) {
  test(`${slug}: cell transitions, indices, backward stepping, scrubbing, and fullscreen`, async ({ page }, info) => {
    await page.goto(`/samples/python/${slug}/`);
    const player = await ready(page, 6);
    const cells = player.locator('.heap-object[data-ref="list-1"] .collection-cell');
    await goTo(player, 2);
    await expect(cells.locator('.collection-item')).toHaveText([...before]);
    const cellFont = await cells.nth(1).evaluate(el => {
      const style = getComputedStyle(el);
      return [style.fontFamily, style.fontSize, style.fontWeight, style.fontStyle, style.lineHeight, style.fontVariantLigatures];
    });
    await player.getByRole('button', { name: 'Next step', exact: true }).click();
    if (info.project.use.reducedMotion !== 'reduce') {
      if (slug === 'list-removal') {
        await expect(player.locator('.collection-removal')).toHaveCount(1);
        expect(await player.locator('.collection-removal').evaluate(el => {
          const style = getComputedStyle(el);
          return [style.fontFamily, style.fontSize, style.fontWeight, style.fontStyle, style.lineHeight, style.fontVariantLigatures];
        })).toEqual(cellFont);
        expect(await cells.nth(1).evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
      } else expect(await cells.nth(2).evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
    } else {
      expect(await player.evaluate(el => el.shadowRoot!.getAnimations().length)).toBe(0);
      await expect(player.locator('.collection-removal')).toHaveCount(0);
    }
    await settle(player);
    await expect(player.locator('.collection-removal')).toHaveCount(0);
    await expect(cells.locator('.collection-item')).toHaveText([...after]);
    await expect(cells.locator('.collection-index')).toHaveText(after.map((_, index) => String(index)));
    await player.getByRole('button', { name: 'Previous step', exact: true }).click();
    await settle(player);
    await expect(cells.locator('.collection-item')).toHaveText([...before]);
    await goTo(player, 6);
    await expect(player.locator('.console pre')).toHaveText(`[${after.join(', ')}]\n`);
    const scrub = player.getByRole('slider', { name: 'Step', exact: true });
    await scrub.focus();
    await scrub.press('Home');
    await scrub.press('ArrowRight');
    await scrub.press('ArrowRight');
    await settle(player);
    await expect(cells.locator('.collection-item')).toHaveText([...before]);
    await goTo(player, 4);
    await selectTheme(page, 'paper');
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 600 });
      await settle(player);
      await expect(player.locator('.collection-cell[aria-current]')).toBeInViewport();
      await expect(cells.locator('.collection-item')).toHaveText([...after]);
      const controls = await player.locator('.controls').boundingBox();
      expect(controls!.y + controls!.height).toBeLessThanOrEqual(600);
    }
  });
}

test('removal follows a surviving selection and the final cell can become an empty list', async ({ page }) => {
  await page.goto('/__test/fixtures/embed.html');
  const player = await ready(page, 11);
  await player.evaluate(async el => {
    await (el as CodeLoupe).loadLesson(`language: python
code: numbers = [2, 4, 6]
steps:
  - assign: { var: numbers, value: [2, 4, 6] }
  - select: 'numbers[2]'
  - remove: 'numbers[1]'
  - remove: 'numbers[0]'
  - remove: 'numbers[0]'
  - append: { target: 'numbers', value: null }
`);
  });
  await goTo(player, 3);
  await expect(player.locator('.collection-cell[aria-current]')).toHaveAttribute('aria-label', 'list-1[1] is 6, selected');
  await goTo(player, 4);
  await expect(player.locator('.collection-cell[aria-current]')).toHaveAttribute('aria-label', 'list-1[0] is 6, selected');
  await goTo(player, 5);
  await expect(player.locator('.collection')).toHaveText('[]');
  await expect(player.locator('.collection-cell')).toHaveCount(0);
  await goTo(player, 6);
  await expect(player.locator('.collection-item')).toHaveText('None');
  await expect(player.locator('.collection-index')).toHaveText('0');
});

test('a function mutates its passed list and backward stepping restores contents and frames', async ({ page }) => {
  await page.goto('/__test/fixtures/embed.html');
  const player = await ready(page, 11);
  await player.evaluate(async el => {
    await (el as CodeLoupe).loadLesson(`language: python
code: |
  change(nums)
  items.append(2)
steps:
  - line: 1
    assign: { var: nums, value: [1] }
  - badge: { over: nums, value: [1], from: nums }
  - call: { name: change, line: 2, over: change(nums), args: [{ var: items, from: badge }] }
  - append: { target: items, value: 2 }
  - return: { value: null }
`);
  });
  await goTo(player, 3);
  const cells = player.locator('.heap-object[data-ref="list-1"] .collection-item');
  await expect(player.locator('.heap-object')).toHaveCount(1);
  await expect(player.locator('[data-name="nums"] .value')).toHaveText('→ list-1');
  await expect(player.locator('[data-frame-id="1"] [data-name="items"] .value')).toHaveText('→ list-1');
  await expect(cells).toHaveText(['1']);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(cells).toHaveText(['1', '2']);
  await goTo(player, 5);
  await expect(player.locator('[data-frame-id="1"]')).toHaveCount(0);
  await expect(cells).toHaveText(['1', '2']);
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.locator('[data-frame-id="1"]')).toHaveCount(1);
  await expect(cells).toHaveText(['1', '2']);
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(cells).toHaveText(['1']);
  await goTo(player, 2);
  await expect(player.locator('[data-frame-id="1"]')).toHaveCount(0);
  await expect(cells).toHaveText(['1']);
});
