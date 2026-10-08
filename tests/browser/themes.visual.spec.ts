import { test, expect, ready, goTo, selectTheme, palettes, corpus } from './helpers';

for (const theme of Object.keys(palettes) as (keyof typeof palettes)[]) {
  test(`${theme}: nested frames and both return destinations`, async ({ page }) => {
    await page.goto('/samples/python/nested-function-call/');
    const player = await ready(page, 19);
    await selectTheme(page, theme);
    for (const [step, state] of [[8, 'nested-locals'], [10, 'inner-return'], [16, 'outer-return']] as const) {
      await goTo(player, step);
      await page.mouse.move(0, 0);
      await expect(player).toHaveScreenshot(`${theme}-${state}.png`);
    }
  });
}

for (const theme of Object.keys(palettes) as (keyof typeof palettes)[]) {
  test(`${theme}: two references to one shared list`, async ({ page }) => {
    await page.goto('/samples/python/list-aliasing/');
    const player = await ready(page, 7);
    await selectTheme(page, theme);
    await goTo(player, 5);
    await page.mouse.move(0, 0);
    await expect(player).toHaveScreenshot(`${theme}-list-aliasing.png`);
  });
}

test('updated list cell and list-valued print badge', async ({ page }) => {
  await page.goto('/samples/python/list-update/');
  const player = await ready(page, 6);
  await goTo(player, 3);
  await page.mouse.move(0, 0);
  await expect(player).toHaveScreenshot('midnight-list-updated.png');
  await goTo(player, 5);
  await expect(player).toHaveScreenshot('midnight-list-print-badge.png');
});

for (const slug of ['list-append', 'list-removal']) {
  test(`${slug}: changed length and indices`, async ({ page }) => {
    await page.goto(`/samples/python/${slug}/`);
    const player = await ready(page, 6);
    await goTo(player, 4);
    await page.mouse.move(0, 0);
    await expect(player).toHaveScreenshot(`midnight-${slug}.png`);
  });
}

test('gallery shell and narrow nested-call layout', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.sample-card')).toHaveCount(corpus.length);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('midnight-gallery.png', { fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/samples/python/nested-function-call/');
  const player = await ready(page, 19);
  await goTo(player, 8);
  await expect(player).toHaveScreenshot('midnight-narrow-nested-locals.png');
});

test('focus view on a short laptop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/samples/python/nested-function-call/');
  const player = await ready(page, 19);
  await goTo(player, 8);
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect(player).toHaveAttribute('fit');
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).blur();
  await goTo(player, 8);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot('midnight-focus-short-laptop.png');
});

for (const theme of Object.keys(palettes) as (keyof typeof palettes)[]) {
  test(`${theme}: indexed list selection`, async ({ page }) => {
    await page.goto('/samples/python/list-iteration/');
    const player = await ready(page, 17);
    await selectTheme(page, theme);
    await goTo(player, 8);
    await page.mouse.move(0, 0);
    await expect(player).toHaveScreenshot(`${theme}-list-selection.png`);
  });
}
