import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Locator } from '@playwright/test';
import { test, expect, ready, goTo, palettes, corpus } from './helpers';

/**
 * Rendered-DOM baselines. For every canonical lesson, record a hash of the player's complete
 * rendered DOM and palette at the first and last step, for each starter preset (fresh load) and
 * for a regular Shiki theme (live theme switch). This characterizes loading, highlighting,
 * literal coloring, and palette application, which screenshots only sample.
 *
 * The normalized HTML of each state is written to test-results/rendered-dom/ so a failure can be
 * inspected. It runs in the Docker visual project because layout styles depend on fonts. Update
 * the baselines only for an intentional rendering change: `npm run test:visual:update`.
 */
test.use({ reducedMotion: 'reduce' });

const presets = Object.keys(palettes) as (keyof typeof palettes)[];
const shikiTheme = 'github-dark';

async function renderedState(player: Locator, label: string) {
  const { html, style } = await player.evaluate(el => ({
    html: el.shadowRoot!.innerHTML,
    style: el.shadowRoot!.querySelector('.ca')!.getAttribute('style') ?? '',
  }));
  // Sub-pixel layout values are covered by the screenshots; keep one decimal so the hash is stable.
  const normalized = `${style}\n${html}`.replace(/-?\d+\.\d+/g, number => String(Math.round(Number(number) * 10) / 10));
  const directory = new URL('../../test-results/rendered-dom/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(`${label}.html`, directory), normalized);
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

for (const { id, steps } of corpus) {
  test(`${id}: rendered DOM for each preset and a Shiki theme`, async ({ page, context }) => {
    const hashes: Record<string, Record<string, string>> = {};

    for (const theme of presets) {
      const fresh = await context.newPage();
      await fresh.addInitScript(name => localStorage.setItem('code-loupe:lesson-theme', name), theme);
      await fresh.goto(`/samples/python/${id}/`);
      const player = await ready(fresh, steps);
      await expect.poll(() => player.locator('.ca').evaluate(el => (el as HTMLElement).style.getPropertyValue('--ca-bg'))).toBe(palettes[theme]);
      hashes[theme] = {};
      for (const step of [0, steps]) {
        await goTo(player, step);
        hashes[theme][`step ${step}`] = await renderedState(player, `${id}-${theme}-${step}`);
      }
      await fresh.close();
    }

    // A regular Shiki theme, applied by changing the attribute on a loaded player.
    await page.goto(`/samples/python/${id}/`);
    const player = await ready(page, steps);
    await player.evaluate((el, name) => el.setAttribute('theme', name), shikiTheme);
    await expect.poll(() => player.evaluate(el => el.shadowRoot!.querySelector('.code-host pre')?.classList.contains('github-dark'))).toBe(true);
    hashes[shikiTheme] = {};
    for (const step of [0, steps]) {
      await goTo(player, step);
      hashes[shikiTheme][`step ${step}`] = await renderedState(player, `${id}-${shikiTheme}-${step}`);
    }

    expect(JSON.stringify(hashes, null, 1) + '\n').toMatchSnapshot(`${id}.json`);
  });
}
