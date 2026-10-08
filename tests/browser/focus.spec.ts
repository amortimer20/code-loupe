import { test, expect, ready, goTo, settle } from './helpers';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

test('focus view fits a short laptop, follows execution, and restores the current lesson', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  let fetches = 0;
  page.on('request', request => { if (request.url().endsWith('/nested-function-call.yaml')) fetches++; });
  await page.goto('/samples/python/nested-function-call/');
  const player = await ready(page, 19);
  await goTo(player, 8);
  await expect(player.getByRole('button', { name: 'Enter fullscreen', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  const view = page.locator('#lesson-view');
  await expect.poll(() => view.evaluate(el => el.matches(':modal'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeFocused();
  await expect(player.getByRole('button', { name: 'Exit fullscreen', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(8);
  await expect(player.locator('[data-frame-id="2"]')).toContainText(/result\s*=\s*11/);
  for (const step of [2, 8, 10, 16, 19]) {
    await goTo(player, step);
    const bounds = await player.locator('.controls').boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(600);
    const caption = await player.locator('.caption').boundingBox();
    expect(caption!.y).toBeGreaterThan(0);
    const line = await player.locator('.line.active').boundingBox();
    const pane = await player.locator('.code-scroll').boundingBox();
    expect(line!.y).toBeGreaterThanOrEqual(pane!.y);
    expect(line!.y + line!.height).toBeLessThanOrEqual(pane!.y + pane!.height);
  }
  expect(fetches).toBe(1);
  await player.focus();
  await page.keyboard.press('Escape');
  await expect.poll(() => view.evaluate(el => el.matches(':modal'))).toBe(false);
  await expect(player).not.toHaveAttribute('fit');
  await expect(page.getByRole('button', { name: 'Enter fullscreen', exact: true })).toBeFocused();
  await expect(player.getByRole('button', { name: 'Enter fullscreen', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(19);
  expect(fetches).toBe(1);
  await page.keyboard.press('Enter');
  await expect(player).toHaveAttribute('fit');
  await page.keyboard.press('Space');
  await expect(player).not.toHaveAttribute('fit');
});

test('focus view resizes to a narrow screen with reachable panels and controls', async ({ page }) => {
  await page.goto('/samples/python/nested-function-call/');
  const player = await ready(page, 19);
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 600 });
  await goTo(player, 8);
  await settle(player);
  const controls = await player.locator('.controls').boundingBox();
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(600);
  expect(await page.locator('#lesson-view').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const code = await player.locator('.code').boundingBox();
  const data = await player.locator('.data').boundingBox();
  expect(data!.y).toBeGreaterThanOrEqual(code!.y + code!.height - 1);
  expect(data!.height).toBeGreaterThan(0);
  await player.focus();
  await page.keyboard.press('End');
  await settle(player);
  await expect(player.locator('.console pre')).toHaveText('22\n');
});

test('a bounded standalone embed works without a lesson title', async ({ page }) => {
  await page.goto('/__test/fixtures/embed.html');
  const player = await ready(page, 11);
  await player.evaluate(async el => {
    const player = el as CodeLoupe;
    await player.loadLesson('language: python\ncode: |\n  x = 5\nsteps:\n  - line: 1\n    assign: { var: x, value: 5 }\n');
    player.style.height = '400px';
    player.setAttribute('fit', '');
  });
  await goTo(player, 1);
  await expect(player.locator('.title')).toBeHidden();
  const bounds = await player.boundingBox();
  const controls = await player.locator('.controls').boundingBox();
  const stage = await player.locator('.stage').boundingBox();
  expect(stage!.height).toBeGreaterThan(200);
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(bounds!.y + 400);
  await expect(player.locator('.globals')).toContainText(/x\s*=\s*5/);
});
