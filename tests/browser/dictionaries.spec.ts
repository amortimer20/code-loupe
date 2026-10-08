import { test, expect, ready, goTo, settle, selectTheme } from './helpers';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

test('dictionary fields update independently and restore through backward stepping, themes, and fullscreen', async ({ page }, info) => {
  await page.goto('/samples/python/dictionary-fields/');
  const player = await ready(page, 5);
  const object = player.getByRole('article', { name: 'Dictionary object student-1', exact: true });
  const name = object.locator('[data-key="name"]');
  const score = object.locator('[data-key="score"]');
  await goTo(player, 1);
  await expect(player.getByRole('region', { name: 'Objects', exact: true })).toBeVisible();
  await expect(player.locator('.globals [data-name="student"]')).toHaveAttribute('aria-label', 'student points to object student-1');
  await expect(object.locator('.field-key')).toHaveText(['"name"', '"score"']);
  await expect(name.locator('.field-value')).toHaveText('"Ada"');
  await expect(name.locator('.tag')).toHaveText('str');
  await expect(score.locator('.field-value')).toHaveText('5');
  await expect(score.locator('.tag')).toHaveText('int');
  await goTo(player, 2);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  if (info.project.use.reducedMotion !== 'reduce') expect(await score.evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
  expect(await name.evaluate(el => el.getAnimations().length)).toBe(0);
  await settle(player);
  await expect(score.locator('.field-value')).toHaveText('7');
  await expect(name.locator('.field-value')).toHaveText('"Ada"');
  await expect(player.locator('.heap-object')).toHaveCount(1);
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(score.locator('.field-value')).toHaveText('5');
  await goTo(player, 4);
  await expect(player.locator('.badge')).toContainText('7');
  await expect(player.locator('.console pre')).toHaveText('');
  for (const theme of ['paper', 'terminal', 'midnight'] as const) {
    await selectTheme(page, theme);
    await expect(score.locator('.field-value')).toHaveText('7');
    await expect(name.locator('.field-value')).toHaveText('"Ada"');
    await expect(player.locator('.counter')).toHaveText('Step 4 / 5');
  }
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 600 });
    await goTo(player, 4);
    const field = await score.boundingBox();
    const pane = await player.locator('.data').boundingBox();
    expect(field!.y).toBeGreaterThanOrEqual(pane!.y);
    expect(field!.y + field!.height).toBeLessThanOrEqual(pane!.y + pane!.height);
    expect(await page.locator('#lesson-view').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await goTo(player, 5);
    await expect(player.locator('.console pre')).toHaveText('7\n');
  }
  const scrub = player.getByRole('slider', { name: 'Step', exact: true });
  await scrub.focus();
  await scrub.press('Home');
  await expect(player.locator('.heap-object')).toHaveCount(0);
  await scrub.press('ArrowRight');
  await settle(player);
  await expect(score.locator('.field-value')).toHaveText('5');
});

test('field lookup handles unusual keys and follows a field in a bounded standalone embed', async ({ page }) => {
  await page.goto('/__test/fixtures/embed.html');
  const player = await ready(page, 11);
  await page.setViewportSize({ width: 390, height: 600 });
  await player.evaluate(async el => {
    const player = el as CodeLoupe;
    const key = 'a"b]';
    const fields = Object.fromEntries([...Array.from({ length: 12 }, (_, i) => [`field-${i}`, i]), [key, 5], ['__proto__', 6]]);
    await player.loadLesson(JSON.stringify({ language: 'python', code: 'student', steps: [
      { line: 1, allocate: { id: 'record', fields }, assign: { var: 'student', ref: 'record' } },
      { assign: { var: 'other', ref: 'record' } },
      { update: { var: 'other', key, value: 9 } },
      { badge: { over: 'student', value: 9, from: { var: 'student', key } } },
      { update: { var: 'student', key: '__proto__', value: 7 } },
    ] }));
    player.setAttribute('fit', '');
    player.style.height = '500px';
  });
  const fields = player.locator('.object-field');
  const special = fields.filter({ has: page.locator('dt', { hasText: JSON.stringify('a"b]') }) });
  await goTo(player, 4);
  await expect(special.locator('.field-value')).toHaveText('9');
  await expect(player.locator('.heap-owners')).toHaveText('Referenced by: student, other');
  const field = await special.boundingBox();
  const pane = await player.locator('.data').boundingBox();
  expect(field!.y).toBeGreaterThanOrEqual(pane!.y);
  expect(field!.y + field!.height).toBeLessThanOrEqual(pane!.y + pane!.height);
  await goTo(player, 5);
  await expect(fields.filter({ hasText: '__proto__' }).locator('.field-value')).toHaveText('7');
  await goTo(player, 2);
  await expect(special.locator('.field-value')).toHaveText('5');
});
