import { test, expect, canonical, ready, goTo, selectTheme, palettes } from './helpers';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

test('themes preserve steps and frames without refetching and persist across pages', async ({ page }) => {
  let fetches = 0;
  page.on('request', request => { if (request.url().endsWith('/nested-function-call.yaml')) fetches++; });
  await page.goto('/samples/python/nested-function-call/');
  const player = await ready(page, 19);
  await goTo(player, 8);
  for (const theme of Object.keys(palettes) as (keyof typeof palettes)[]) {
    await selectTheme(page, theme);
    expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(8);
    await expect(player.locator('[data-frame-id="2"]')).toContainText(/result\s*=\s*11/);
    expect(await player.locator('.ca').evaluate(el => getComputedStyle(el).borderRadius)).toBe('0px');
    expect(await player.locator('.code-host pre').evaluate(el => getComputedStyle(el).fontVariantLigatures)).toBe('none');
  }
  expect(fetches).toBe(1);
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toHaveValue('terminal');
});

test('rapid theme changes during editing preserve the draft and current step', async ({ page }) => {
  const draft = (await canonical('nested-function-call')).replace('title: Following nested function calls', 'title: My themed draft');
  await page.goto('/playground/?sample=python/nested-function-call');
  await expect(page.locator('#preview-status')).toHaveText('Ready · 19 steps');
  await page.locator('#lesson-source').fill(draft);
  await selectTheme(page, 'paper');
  await expect(page.locator('code-loupe .title')).toHaveText('My themed draft');
  const player = await ready(page, 19);
  await goTo(player, 14);
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('midnight');
  await selectTheme(page, 'terminal');
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(14);
  await expect(page.locator('#lesson-source')).toHaveValue(draft);
  await page.reload();
  await expect(page.locator('#preview-status')).toHaveText('Ready · 19 steps');
  await expect(page.locator('#lesson-source')).toHaveValue(draft);
  await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toHaveValue('terminal');
});

test('theme selection and lesson editing work when storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  });
  await page.goto('/playground/?sample=python/function-call');
  await expect(page.locator('#preview-status')).toHaveText('Ready · 11 steps');
  await selectTheme(page, 'paper');
  await page.locator('#lesson-source').fill((await canonical('function-call')) + '\n# unstored draft\n');
  await expect(page.locator('#preview-status')).toHaveText('Ready · 11 steps');
  await expect(page.locator('#lesson-source')).toHaveValue(/# unstored draft/);
});

test('standalone production bundle supports Shiki themes and direct-load races', async ({ page }) => {
  await page.goto('/__test/fixtures/embed.html');
  const player = await ready(page, 11);
  expect(await player.locator('.ca').evaluate(el => (el as HTMLElement).style.getPropertyValue('--ca-accent'))).toBe('');
  await goTo(player, 7);
  await player.evaluate(el => el.setAttribute('theme', 'paper'));
  await expect.poll(() => player.locator('.ca').evaluate(el => (el as HTMLElement).style.getPropertyValue('--ca-bg'))).toBe(palettes.paper);
  await player.evaluate(el => el.setAttribute('theme', 'github-light'));
  await expect.poll(() => player.locator('.ca').evaluate(el => (el as HTMLElement).style.colorScheme)).toBe('light');
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(7);
  expect(await player.locator('.ca').evaluate(el => (el as HTMLElement).style.getPropertyValue('--ca-accent'))).toBe('');
  await player.evaluate(el => el.setAttribute('theme', 'no-such-theme'));
  await expect(player.locator('.error')).toBeVisible();
  await player.evaluate(el => el.setAttribute('theme', 'terminal'));
  await expect(player.locator('.error')).toBeHidden();
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(7);
  const draft = 'title: Direct draft\nlanguage: python\ncode: |\n  y = 7\nsteps:\n  - line: 1\n    assign: { var: y, value: 7 }\n';
  const loaded = await player.evaluate(async (el, source) => {
    const player = el as CodeLoupe;
    const loading = player.loadLesson(source);
    player.setAttribute('theme', 'paper');
    const loaded = await loading;
    player.goTo(1);
    player.setAttribute('theme', 'midnight');
    return loaded;
  }, draft);
  expect(loaded).toBe(true);
  await expect.poll(() => player.locator('.ca').evaluate(el => (el as HTMLElement).style.getPropertyValue('--ca-bg'))).toBe(palettes.midnight);
  await expect(player.locator('.title')).toHaveText('Direct draft');
  await expect(player.locator('.globals')).toContainText(/y\s*=\s*7/);
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(1);
  await player.evaluate(el => {
    el.setAttribute('theme', 'paper');
    el.setAttribute('src', '/lessons/python/conditional.yaml');
    el.setAttribute('theme', 'midnight');
  });
  await expect(player.locator('.title')).toHaveText('Choosing a conditional branch');
  expect(await player.evaluate(el => (el as CodeLoupe).total)).toBe(5);
});
