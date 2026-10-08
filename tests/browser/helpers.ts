import { test as base, expect, type Locator, type Page } from '@playwright/test';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';
import { readFile } from 'node:fs/promises';

// Type-only player import: tests run in Node; registration runs in the browser.
export const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, 'Unexpected browser exceptions').toEqual([]);
  }, { auto: true }],
});
export { expect };

export const palettes = { paper: '#faf7ef', midnight: '#191d2d', terminal: '#101815' };
export const corpus: { id: string; steps: number; output: string; vars?: RegExp }[] = [
  { id: 'hello-world', steps: 2, output: 'Hello, world!' },
  { id: 'simple-arithmetic', steps: 3, output: '5' },
  { id: 'naming-value', steps: 3, output: '5', vars: /score\s*=\s*5/ },
  { id: 'changing-value', steps: 6, output: '7', vars: /score\s*=\s*7/ },
  { id: 'strings-and-numbers', steps: 6, output: '5\n23' },
  { id: 'numeric-input', steps: 9, output: 'You will be 100 in 70 years!', vars: /age\s*=\s*30/ },
  { id: 'accumulator-loop', steps: 13, output: '3', vars: /total\s*=\s*3/ },
  { id: 'conditional', steps: 5, output: 'Under 18', vars: /age\s*=\s*16/ },
  { id: 'function-call', steps: 11, output: '11', vars: /answer\s*=\s*11/ },
  { id: 'nested-function-call', steps: 19, output: '22', vars: /answer\s*=\s*22/ },
  { id: 'list-iteration', steps: 17, output: '12', vars: /total\s*=\s*12/ },
  { id: 'list-update', steps: 6, output: '[2, 10, 6]', vars: /numbers\s*=/ },
  { id: 'list-append', steps: 6, output: '[2, 4, 6]', vars: /numbers\s*=/ },
  { id: 'list-removal', steps: 6, output: '[2, 6]', vars: /numbers\s*=/ },
  { id: 'list-aliasing', steps: 7, output: '[2, 4, 6]', vars: /numbers\s*=\s*→ list-1/ },
  { id: 'list-copying', steps: 9, output: '[2, 4]\n[2, 4, 6]', vars: /other\s*=\s*→ list-2/ },
];

export async function canonical(id: string) {
  return readFile(new URL(`../../lessons/python/${id}/lesson.yaml`, import.meta.url), 'utf8');
}

export async function ready(page: Page, steps: number) {
  const player = page.locator('code-loupe');
  await expect.poll(() => player.evaluate(el => (el as CodeLoupe).total)).toBe(steps);
  await expect(player.locator('.error')).toBeHidden();
  return player;
}

export async function settle(player: Locator) {
  // Wait for real Web Animations rather than guessing at their duration.
  await player.evaluate(async el => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await Promise.all(el.shadowRoot!.getAnimations().map(animation => animation.finished.catch(() => {})));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
}

export async function goTo(player: Locator, step: number) {
  await player.evaluate((el, step) => (el as CodeLoupe).goTo(step), step);
  await settle(player);
}

export async function selectTheme(page: Page, theme: keyof typeof palettes) {
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
  const player = page.locator('code-loupe');
  await expect.poll(() => player.locator('.ca').evaluate(el => (el as HTMLElement).style.getPropertyValue('--ca-bg'))).toBe(palettes[theme]);
  await settle(player);
}
