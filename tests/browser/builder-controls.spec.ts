import { test, expect, ready, goTo } from './helpers';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

test('grouped step picker remains keyboard usable across categories without editing the draft', async ({ page }) => {
  await page.goto('/playground/?new=1');
  await ready(page, 0);
  const original = await page.locator('#lesson-source').inputValue();
  const picker = page.getByLabel('New step', { exact:true });
  await expect(picker).toBeVisible();
  expect(await picker.locator('optgroup').evaluateAll(groups => groups.map(group => group.getAttribute('label'))))
    .toEqual(['Explanation', 'Values and variables', 'Console', 'Lists']);
  await expect(picker).toHaveValue('highlight');
  await picker.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await expect(picker).toHaveValue('write');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name:'Add step', exact:true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-new-card]')).toContainText('Show a prompt');
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await page.getByRole('button', { name:'Cancel new step', exact:true }).click();
  await picker.selectOption('remove');
  await page.getByRole('button', { name:'Add step', exact:true }).click();
  await expect(page.locator('[data-new-card]')).toContainText('Remove a list element');
  await expect(page.getByLabel('List element', { exact:true })).toBeVisible();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
});

test('step headers collapse without changing selection or losing pending edits, and overview follows playback', async ({ page }) => {
  await page.goto('/playground/?sample=python/simple-arithmetic');
  const player = await ready(page, 3), original = await page.locator('#lesson-source').inputValue();
  const first = page.locator('[data-step="0"]');
  await page.getByLabel('Caption', { exact:true }).fill('Pending first caption');
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await expect(first).toHaveAttribute('aria-current', 'step');
  await expect(first).toBeFocused();
  await expect(page.locator('.builder-card[data-selected="true"] [data-step]')).toHaveAttribute('data-step', '0');
  await expect(page.locator('[data-step-form]')).toHaveCount(0);
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(0);
  await page.getByRole('tab', { name:'YAML', exact:true }).click();
  await page.getByRole('tab', { name:'Builder', exact:true }).click();
  await expect(page.locator('[data-step-form]')).toHaveCount(0);
  await goTo(player, 2);
  await expect(page.locator('.builder-card[data-selected="true"] [data-step]')).toHaveAttribute('data-step', '1');
  await expect(page.locator('[data-step-form]')).toHaveCount(0);
  await first.click();
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Caption', { exact:true })).toHaveValue('Pending first caption');
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await first.focus();
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Caption', { exact:true })).toHaveValue('Pending first caption');
});

test('new card headers collapse and reopen without saving or losing typed rows', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('/playground/?new=1');
  await ready(page, 0);
  const original = await page.locator('#lesson-source').inputValue();
  await page.locator('#builder-new-action').selectOption('assign');
  await page.getByRole('button', { name:'Add step', exact:true }).click();
  await page.getByLabel('Variable name', { exact:true }).fill('numbers');
  await page.getByLabel('Value type', { exact:true }).selectOption('List');
  await page.getByRole('button', { name:'Add list item', exact:true }).click();
  await page.getByLabel('Item 0 value', { exact:true }).fill('oops');
  await page.locator('[data-new-card]').click();
  await expect(page.locator('[data-new-card]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-new-step]')).toHaveCount(0);
  await page.locator('[data-new-card]').click();
  await expect(page.getByLabel('Variable name', { exact:true })).toHaveValue('numbers');
  await expect(page.getByLabel('Item 0 value', { exact:true })).toHaveValue('oops');
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name:'Cancel new step', exact:true }).click();
  await expect(page.locator('[data-new-card]')).toHaveCount(0);
});

test('icon picker is grouped with Code line, remains keyboard accessible and cancels on collapse', async ({ page }) => {
  await page.goto('/playground/?sample=python/simple-arithmetic');
  await ready(page, 3);
  const group = page.getByRole('group', { name:'Line targeting', exact:true });
  const picker = group.getByRole('button', { name:'Pick from preview', exact:true });
  await expect(group.getByLabel('Code line', { exact:true })).toBeVisible();
  await expect(picker.locator('svg')).toBeVisible();
  await expect(picker).toHaveAttribute('title', 'Pick from preview');
  await group.getByLabel('Code line', { exact:true }).focus();
  await page.keyboard.press('Tab');
  await expect(picker).toBeFocused();
  await page.keyboard.press('Enter');
  const cancel = group.getByRole('button', { name:'Cancel picking', exact:true });
  await expect(cancel).toHaveAttribute('aria-pressed', 'true');
  await expect(cancel.locator('svg')).toBeVisible();
  await page.locator('[data-step="0"]').click();
  await page.locator('[data-step="0"]').click();
  await expect(picker).toHaveAttribute('aria-pressed', 'false');
  await expect(picker.locator('svg')).toBeVisible();
  await picker.click();
  await page.keyboard.press('Escape');
  await expect(picker).toHaveAttribute('aria-pressed', 'false');
});

test('delete uses danger color and retains undo in both site appearances', async ({ page }) => {
  await page.goto('/playground/?sample=python/simple-arithmetic');
  await ready(page, 3);
  const button = page.getByRole('button', { name:'Delete step', exact:true });
  for (const theme of ['light', 'dark']) {
    await page.locator('#site-appearance').selectOption(theme);
    const colors = await button.evaluate(el => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--error)'; el.append(probe);
      const result = { expected:getComputedStyle(probe).color, actual:getComputedStyle(el).color, border:getComputedStyle(el).borderTopColor };
      probe.remove(); return result;
    });
    expect(colors.actual).toBe(colors.expected);
    expect(colors.border).toBe(colors.expected);
  }
  const original = await page.locator('#lesson-source').inputValue();
  await button.click();
  await expect(page.locator('.builder-card')).toHaveCount(2);
  await page.getByRole('button', { name:'Undo', exact:true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
});

test('saved step actions share a compact row and preserve discard and deletion undo', async ({ page }, testInfo) => {
  await page.goto('/playground/?sample=python/simple-arithmetic');
  await ready(page, 3);
  const original = await page.locator('#lesson-source').inputValue();
  const caption = page.getByLabel('Caption', { exact:true }), savedCaption = await caption.inputValue();
  await caption.fill('Pending caption');
  const save = page.getByRole('button', { name:'Save step', exact:true });
  const discard = page.getByRole('button', { name:'Discard edits', exact:true });
  const deletion = page.getByRole('button', { name:'Delete step', exact:true });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height:844 });
    await save.scrollIntoViewIfNeeded();
    const row = await page.locator('.builder-action-row').boundingBox();
    const a = await save.boundingBox(), b = await discard.boundingBox(), c = await deletion.boundingBox();
    expect(Math.abs(a!.y + a!.height / 2 - b!.y - b!.height / 2)).toBeLessThan(1);
    expect(Math.abs(a!.y + a!.height / 2 - c!.y - c!.height / 2)).toBeLessThan(1);
    expect(b!.x).toBeGreaterThan(a!.x + a!.width);
    expect(Math.abs(c!.x + c!.width - row!.x - row!.width)).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path:testInfo.outputPath(`action-row-${width}.png`) });
  }
  await discard.click();
  await expect(caption).toHaveValue(savedCaption);
  await expect(discard).toBeHidden();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await deletion.click();
  await expect(page.locator('.builder-card')).toHaveCount(2);
  await page.getByRole('button', { name:'Undo', exact:true }).click();
  await expect(page.locator('#lesson-source')).toHaveValue(original);
  await page.goto('/playground/?sample=python/nested-function-call');
  await ready(page, 19);
  await page.locator('[data-step="2"]').click();
  await expect(page.locator('[data-step-form]')).toContainText('This action is preserved');
  await page.getByLabel('Caption', { exact:true }).fill('Pending advanced caption');
  await expect(page.locator('.builder-action-row').getByRole('button', { name:'Discard edits', exact:true })).toBeVisible();
  await page.getByRole('button', { name:'Discard edits', exact:true }).click();
  await expect(page.getByLabel('Caption', { exact:true })).not.toHaveValue('Pending advanced caption');
});
