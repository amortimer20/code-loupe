import { readFile } from 'node:fs/promises';
import { test, expect, corpus, canonical, ready, goTo, settle } from './helpers';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

test('gallery combines search and topic filters and reports empty results', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.sample-card')).toHaveCount(corpus.length);
  await expect(page.locator('.sample-card').nth(0)).toContainText('Hello, world');
  await expect(page.locator('.sample-card').nth(1)).toContainText('Simple arithmetic');
  await expect(page.locator('.sample-card').nth(2)).toContainText('Naming a value');
  await expect(page.locator('.sample-card').nth(3)).toContainText('Changing a value');
  await expect(page.locator('.sample-card').nth(4)).toContainText('Strings and numbers');
  await expect(page.locator('.sample-card').nth(5)).toContainText('Converting input to a number');
  await expect(page.locator('.sample-card').nth(6)).toContainText('Boolean comparisons');
  await expect(page.locator('.sample-card').nth(7)).toContainText('Choosing a conditional branch');
  await expect(page.locator('.sample-card').nth(8)).toContainText('A simple while loop');
  await expect(page.locator('.sample-card').nth(9)).toContainText('Following an accumulator loop');
  await page.getByRole('combobox', { name: 'Topic', exact: true }).selectOption('Functions');
  await expect(page.locator('.sample-card:visible')).toHaveCount(4);
  await page.getByLabel('Search', { exact: true }).fill('nested');
  await expect(page.locator('.sample-card:visible')).toHaveCount(1);
  await expect(page.locator('#sample-count')).toHaveText('1 lesson');
  await page.getByLabel('Search', { exact: true }).fill('no-such-lesson');
  await expect(page.locator('#no-samples')).toBeVisible();
  await page.getByLabel('Search', { exact: true }).fill('');
  await page.getByRole('combobox', { name: 'Topic', exact: true }).selectOption('');
  await expect(page.locator('.sample-card:visible')).toHaveCount(corpus.length);
});

test('introductory lessons reveal output after the active line and restore intermediate states', async ({ page }) => {
  for (const sample of corpus.slice(0, 2)) {
    await page.goto(`/samples/python/${sample.id}/`);
    const player = await ready(page, sample.steps);
    await goTo(player, 1);
    await expect(player.locator('.line.active')).toHaveCount(1);
    await expect(player.locator('.console pre')).toHaveText('');
    await expect(player.locator('.badge')).toHaveCount(0);
    await player.getByRole('button', { name: 'Next step', exact: true }).click();
    await settle(player);
    if (sample.id === 'simple-arithmetic') {
      await expect(player.locator('.badge')).toContainText('5');
      await expect(player.locator('.badge .tag')).toHaveText('int');
      await expect(player.locator('.console pre')).toHaveText('');
      await player.getByRole('button', { name: 'Next step', exact: true }).click();
      await settle(player);
    }
    await expect(player.locator('.console pre')).toHaveText(sample.output + '\n');
    await player.getByRole('button', { name: 'Previous step', exact: true }).click();
    await settle(player);
    await expect(player.locator('.console pre')).toHaveText('');
    await expect(player.locator('.badge')).toHaveCount(sample.id === 'simple-arithmetic' ? 1 : 0);
    await goTo(player, 1);
    await expect(player.locator('.badge')).toHaveCount(0);
    await expect(player.locator('.globals [data-name]')).toHaveCount(0);
    await expect(player.locator('.heap-panel')).toBeHidden();
    await expect(player.locator('.call-stack')).toBeHidden();
  }
});

test('naming and changing a value show reads before assignment and restore the old binding', async ({ page }) => {
  await page.goto('/samples/python/naming-value/');
  let player = await ready(page, 3);
  await goTo(player, 2);
  await expect(player.locator('.globals [data-name="score"]')).toContainText('5');
  await expect(player.locator('.badge')).toContainText('5');
  await expect(player.locator('.console pre')).toHaveText('');
  await goTo(player, 3);
  await expect(player.locator('.console pre')).toHaveText('5\n');
  await expect(player.locator('.globals [data-name]')).toHaveCount(1);
  await page.goto('/samples/python/changing-value/');
  player = await ready(page, 6);
  await goTo(player, 3);
  await expect(player.locator('.globals [data-name="score"]')).toContainText('5');
  await expect(player.locator('.badge')).toContainText('7');
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.globals [data-name="score"]')).toContainText('7');
  await expect(player.locator('.globals [data-name]')).toHaveCount(1);
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.globals [data-name="score"]')).toContainText('5');
  await expect(player.locator('.badge')).toContainText('7');
  await goTo(player, 6);
  await expect(player.locator('.console pre')).toHaveText('7\n');
  await player.getByRole('slider', { name: 'Step', exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(player.locator('.globals [data-name]')).toHaveCount(0);
  await expect(player.locator('.console pre')).toHaveText('');
});

test('number addition and string concatenation keep distinct badges and independent console lines', async ({ page }) => {
  await page.goto('/samples/python/strings-and-numbers/');
  const player = await ready(page, 6);
  await goTo(player, 2);
  await expect(player.locator('.badge .tag')).toHaveText('int');
  await expect(player.locator('.badge')).toContainText('5');
  await goTo(player, 4);
  await expect(player.locator('.console pre')).toHaveText('5\n');
  await expect(player.locator('.badge')).toHaveCount(0);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.badge .tag')).toHaveText('str');
  await expect(player.locator('.badge')).toContainText('"23"');
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.console pre')).toHaveText('5\n23\n');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.console pre')).toHaveText('5\n');
  await expect(player.locator('.badge')).toContainText('"23"');
  await goTo(player, 2);
  await expect(player.locator('.badge .tag')).toHaveText('int');
  await expect(player.locator('.console pre')).toHaveText('');
});

test('comparisons reveal true and false Boolean values before printing', async ({ page }) => {
  await page.goto('/samples/python/boolean-comparisons/');
  const player = await ready(page, 6);
  await goTo(player, 2);
  await expect(player.locator('.badge')).toContainText('True');
  await expect(player.locator('.badge .tag')).toHaveText('bool');
  await expect(player.locator('.console pre')).toHaveText('');
  await goTo(player, 5);
  await expect(player.locator('.badge')).toContainText('False');
  await expect(player.locator('.badge .tag')).toHaveText('bool');
  await expect(player.locator('.console pre')).toHaveText('True\n');
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.console pre')).toHaveText('True\nFalse\n');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.console pre')).toHaveText('True\n');
  await expect(player.locator('.badge')).toContainText('False');
  await goTo(player, 2);
  await expect(player.locator('.badge')).toContainText('True');
  await expect(player.locator('.console pre')).toHaveText('');
});

test('while checks repeat before each body and a final false check skips the body', async ({ page }) => {
  await page.goto('/samples/python/while-loop/');
  const player = await ready(page, 14);
  for (const [step, count, condition, output] of [[2, 0, 'True', ''], [7, 1, 'True', '0\n'], [12, 2, 'False', '0\n1\n']] as const) {
    await goTo(player, step);
    await expect(player.locator('.line.active')).toHaveText('while count < 2:');
    await expect(player.locator('.badge')).toContainText(condition);
    await expect(player.locator('.badge .tag')).toHaveText('bool');
    await expect(player.locator('.globals [data-name="count"]')).toContainText(String(count));
    await expect(player.locator('.console pre')).toHaveText(output);
  }
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.line.active')).toHaveText('print("Done")');
  await expect(player.locator('.badge')).toHaveCount(0);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.console pre')).toHaveText('0\n1\nDone\n');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.console pre')).toHaveText('0\n1\n');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.badge')).toContainText('False');
  await goTo(player, 7);
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.line.active')).toHaveText('    count = count + 1');
  await expect(player.locator('.globals [data-name="count"]')).toContainText('1');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.globals [data-name="count"]')).toContainText('0');
  await expect(player.locator('.badge')).toContainText('1');
  await expect(player.locator('.console pre')).toHaveText('0\n');
  await player.getByRole('slider', { name: 'Step', exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(player.locator('.console pre')).toHaveText('');
  await expect(player.locator('.globals [data-name]')).toHaveCount(0);
});

for (const sample of corpus) {
  test(`${sample.id}: playback, canonical download, and playground draft restore`, async ({ page }) => {
    const yaml = await canonical(sample.id);
    await page.goto(`/samples/python/${sample.id}/`);
    const player = await ready(page, sample.steps);
    await goTo(player, sample.steps);
    if (sample.vars) await expect(player.locator('.globals')).toContainText(sample.vars);
    else await expect(player.locator('.globals [data-name]')).toHaveCount(0);
    await expect(player.locator('.console pre')).toContainText(sample.output);
    await expect(player.locator('.frame[data-frame-id]:not([data-frame-id="0"])')).toHaveCount(0);
    const event = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download YAML', exact: true }).click();
    const download = await event;
    expect(download.suggestedFilename()).toBe(`${sample.id}.yaml`);
    expect(await readFile((await download.path())!, 'utf8')).toBe(yaml);
    await page.getByRole('link', { name: 'Edit in playground', exact: true }).click();
    await expect(page.locator('#preview-status')).toHaveText(`Ready · ${sample.steps} steps`);
    await expect(page.locator('#lesson-source')).toHaveValue(yaml);
    await page.locator('#lesson-source').fill(yaml + '\n# browser draft\n');
    await expect(page.locator('#preview-status')).toHaveText(`Ready · ${sample.steps} steps`);
    await expect.poll(() => page.evaluate(id => localStorage.getItem(`code-loupe:playground-draft:python/${id}`), sample.id)).toContain('# browser draft');
    await page.reload();
    await expect(page.locator('#preview-status')).toHaveText(`Ready · ${sample.steps} steps`);
    await expect(page.locator('#lesson-source')).toHaveValue(yaml + '\n# browser draft\n');
    await expect(page.locator('#draft-context')).toContainText('Restored');
  });
}

test('drafts stay separate and invalid YAML can be downloaded and corrected', async ({ page }) => {
  const yaml = await canonical('numeric-input');
  await page.goto('/playground/?sample=python/numeric-input');
  await expect(page.locator('#preview-status')).toHaveText('Ready · 9 steps');
  await page.locator('#lesson-source').fill(yaml + '\n# numeric only\n');
  await page.goto('/playground/?sample=python/accumulator-loop');
  await expect(page.locator('#preview-status')).toHaveText('Ready · 13 steps');
  await expect(page.locator('#lesson-source')).toHaveValue(await canonical('accumulator-loop'));
  await page.goto('/playground/?sample=python/numeric-input');
  await expect(page.locator('#lesson-source')).toHaveValue(yaml + '\n# numeric only\n');
  const invalid = 'language: python\ncode: |\n  x = 5\nsteps:\n  - line: 10\n';
  await page.locator('#lesson-source').fill(invalid);
  await expect(page.locator('#lesson-error')).toBeVisible();
  await expect(page.locator('#lesson-error')).toContainText("doesn't exist");
  await expect(page.locator('#lesson-source')).toHaveAttribute('aria-invalid', 'true');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download YAML' }).click();
  expect(await readFile((await (await event).path())!, 'utf8')).toBe(invalid);
  await page.locator('#lesson-source').fill(yaml);
  await expect(page.locator('#preview-status')).toHaveText('Ready · 9 steps');
  await expect(page.locator('#lesson-error')).toBeHidden();
  await expect(page.locator('#lesson-source')).not.toHaveAttribute('aria-invalid');
});

test('nested calls restore the correct frames through backward stepping and scrubbing', async ({ page }) => {
  await page.goto('/samples/python/nested-function-call/');
  const player = await ready(page, 19);
  const outer = player.locator('[data-frame-id="1"]');
  const inner = player.locator('[data-frame-id="2"]');
  await goTo(player, 8);
  await expect(outer).toContainText('Paused');
  await expect(outer).not.toContainText('result');
  await expect(inner).toContainText(/result\s*=\s*11/);
  await expect(player.locator('.globals')).not.toContainText('result');
  await goTo(player, 10);
  await expect(inner).toHaveCount(0);
  await expect(outer).toContainText('Active');
  await expect(player.locator('.badge')).toHaveCount(1);
  await expect(player.locator('.line.active')).toHaveText('    result = add_one(value)');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(9);
  await expect(inner).toContainText(/result\s*=\s*11/);
  await goTo(player, 16);
  await expect(outer).toHaveCount(0);
  await expect(player.locator('.globals')).not.toContainText('answer');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(outer).toContainText(/result\s*=\s*22/);
  const scrub = player.getByRole('slider', { name: 'Step', exact: true });
  await scrub.focus();
  await scrub.press('Home');
  for (let step = 1; step <= 8; step++) await scrub.press('ArrowRight');
  await settle(player);
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(8);
  await expect(inner).toContainText(/result\s*=\s*11/);
});

test('motion preference, animated transitions, keyboard navigation, and autoplay', async ({ page }, info) => {
  await page.goto('/samples/python/function-call/');
  const player = await ready(page, 11);
  const reduced = info.project.use.reducedMotion === 'reduce';
  expect(await player.evaluate(el => (el as CodeLoupe).animationsOn)).toBe(!reduced);
  await player.getByRole('combobox', { name: 'Playback speed' }).selectOption('2');
  await goTo(player, 2);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  if (!reduced) expect(await player.evaluate(el => el.shadowRoot!.getAnimations().length)).toBeGreaterThan(0);
  await settle(player);
  await expect(player.locator('[data-frame-id="1"]')).toBeVisible();
  await goTo(player, 7);
  await player.focus();
  await page.keyboard.press('ArrowRight');
  await settle(player);
  await expect(player.locator('[data-frame-id="1"]')).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await settle(player);
  await expect(player.locator('[data-frame-id="1"]')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(player.locator('.counter')).toHaveText('Step 0 / 11');
  await page.keyboard.press('End');
  await settle(player);
  await expect(player.locator('.globals')).toContainText(/answer\s*=\s*11/);
  await player.getByRole('button', { name: 'Animations', exact: true }).click();
  expect(await player.evaluate(el => (el as CodeLoupe).animationsOn)).toBe(reduced);
  await goTo(player, 9);
  await player.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => player.evaluate(el => (el as CodeLoupe).step)).toBe(11);
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(player.locator('.console pre')).toHaveText('11\n');
});

test('narrow pages fit and player panels stack below the code', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/samples/python/nested-function-call/', '/playground/', '/docs/']) {
    await page.goto(path);
    if (path.includes('/samples/')) {
      const player = await ready(page, 19);
      await goTo(player, 8);
      const code = await player.locator('.code').boundingBox();
      const data = await player.locator('.data').boundingBox();
      expect(data!.y).toBeGreaterThanOrEqual(code!.y + code!.height - 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
