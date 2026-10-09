import { test, expect, ready, goTo, settle, selectTheme, canonical } from './helpers';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

test('syntax errors mark a location without execution or output and restore the unmarked snippet', async ({ page }) => {
  await page.goto('/samples/python/syntax-error/');
  const player = await ready(page, 1);
  await expect(player.getByRole('status', { name: 'Program error' })).toBeHidden();
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(player.getByRole('status', { name: 'Program error' })).toContainText('SyntaxError · Line 2');
  await expect(player.getByRole('status', { name: 'Program error' })).toContainText('Program did not start.');
  await expect(player.locator('.line.fault')).toHaveText('if age >= 18');
  await expect(player.locator('.line.active')).toHaveCount(0);
  await expect(player.locator('.error-marker.visible')).toHaveText('!');
  await expect(player.locator('.error-target')).toHaveCount(1);
  await expect(player.locator('.diagnostic-badge')).toHaveCount(0);
  await expect(player.locator('.globals [data-name]')).toHaveCount(0);
  await expect(player.locator('.console pre')).toHaveText('');
  await expect(player.locator('.error')).toBeHidden();
  await expect(player.getByRole('button', { name: 'Next step', exact: true })).toBeDisabled();
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.getByRole('status', { name: 'Program error' })).toBeHidden();
  await expect(player.locator('.line.fault')).toHaveCount(0);
  await expect(player.locator('.arrow.visible')).toHaveCount(0);
  await expect(player.locator('.error-target')).toHaveCount(0);
});

test('runtime diagnostic preserves earlier state, restores argument badges, and survives theme changes', async ({ page }) => {
  await page.goto('/samples/python/runtime-error/');
  const player = await ready(page, 5);
  await goTo(player, 4);
  await expect(player.locator('.badge')).toContainText('"abc"');
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.diagnostic-badge')).toHaveText('⚠ ValueError');
  await expect(player.locator('.line.fault')).toHaveText('years = int(age)');
  await expect(player.locator('.line.active')).toHaveCount(0);
  await expect(player.locator('.globals [data-name="age"]')).toContainText('"abc"');
  await expect(player.locator('.globals [data-name="years"]')).toHaveCount(0);
  await expect(player.locator('.console pre')).toHaveText('Starting\n');
  await expect(player.getByRole('status', { name: 'Program error' })).toContainText('Execution stopped.');
  for (const theme of ['paper', 'terminal', 'midnight'] as const) {
    await selectTheme(page, theme);
    await expect(player.locator('.diagnostic-badge')).toHaveText('⚠ ValueError');
    await expect(player.locator('.counter')).toHaveText('Step 5 / 5');
  }
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.getByRole('status', { name: 'Program error' })).toBeHidden();
  await expect(player.locator('.error-target')).toHaveCount(0);
  await expect(player.locator('.error-marker')).toHaveCount(0);
  await expect(player.locator('.line.active')).toHaveText('years = int(age)');
  await expect(player.locator('.badge')).toContainText('"abc"');
  await expect(player.locator('.console pre')).toHaveText('Starting\n');
  const scrub = player.getByRole('slider', { name: 'Step', exact: true });
  await scrub.focus();
  await scrub.press('End');
  await settle(player);
  await expect(player.locator('.diagnostic-badge')).toBeVisible();
  await scrub.press('Home');
  await expect(player.locator('.globals [data-name]')).toHaveCount(0);
  await expect(player.locator('.console pre')).toHaveText('');
  await expect(player.getByRole('status', { name: 'Program error' })).toBeHidden();
});

test('autoplay pauses immediately at a program error and can restart', async ({ page }) => {
  await page.goto('/samples/python/runtime-error/');
  const player = await ready(page, 5);
  await goTo(player, 4);
  await player.getByRole('combobox', { name: 'Playback speed' }).selectOption('2');
  await player.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(player.getByRole('status', { name: 'Program error' })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(player.locator('.counter')).toHaveText('Step 5 / 5');
  await player.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(player.getByRole('status', { name: 'Program error' })).toBeHidden();
  await expect(player.locator('.counter')).toHaveText('Step 0 / 5');
});

test('program messages are safe text and remain distinct from invalid lesson loading', async ({ page }) => {
  await page.goto('/samples/python/runtime-error/');
  const player = await ready(page, 5);
  const yaml = (await canonical('runtime-error')).replace('Cannot convert "abc" to an integer.', '<img src=x onerror=alert(1)>');
  await player.evaluate(el => el.addEventListener('lessonerror', () => el.setAttribute('data-load-error', 'yes')));
  expect(await player.evaluate((el, source) => (el as CodeLoupe).loadLesson(source), yaml)).toBe(true);
  await goTo(player, 5);
  await expect(player.getByRole('status', { name: 'Program error' })).toContainText('<img src=x onerror=alert(1)>');
  await expect(player.locator('.diagnostic img')).toHaveCount(0);
  await expect(player).not.toHaveAttribute('data-load-error');
  expect(await player.evaluate(el => (el as CodeLoupe).loadLesson('language: python\ncode: pass\nsteps:\n  - error: wrong'), undefined)).toBe(false);
  await expect(player.locator('.error')).toContainText("Couldn't load this lesson");
  await expect(player).toHaveAttribute('data-load-error', 'yes');
  expect(await player.evaluate((el, source) => (el as CodeLoupe).loadLesson(source), await canonical('syntax-error'))).toBe(true);
  await goTo(player, 1);
  await expect(player.locator('.error')).toBeHidden();
  await expect(player.getByRole('status', { name: 'Program error' })).toContainText('SyntaxError');
});

test('diagnostics and failing code stay visible in short and narrow fullscreen views', async ({ page }) => {
  for (const [id, steps] of [['syntax-error', 1], ['runtime-error', 5]] as const) {
    await page.goto(`/samples/python/${id}/`);
    const player = await ready(page, steps);
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 600 });
      await goTo(player, steps);
      const line = await player.locator('.line.fault').boundingBox();
      const pane = await player.locator('.code-scroll').boundingBox();
      expect(line!.y).toBeGreaterThanOrEqual(pane!.y);
      expect(line!.y + line!.height).toBeLessThanOrEqual(pane!.y + pane!.height);
      const diagnostic = await player.locator('.diagnostic').boundingBox();
      const controls = await player.locator('.controls').boundingBox();
      expect(diagnostic!.y + diagnostic!.height).toBeLessThanOrEqual(controls!.y);
      expect(controls!.y + controls!.height).toBeLessThanOrEqual(600);
      expect(await page.locator('#lesson-view').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  }
});
