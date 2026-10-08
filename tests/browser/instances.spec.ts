import { test, expect, ready, goTo, settle, selectTheme } from './helpers';

test('construction initializes through self and yields an instance reference before global binding', async ({ page }) => {
  await page.goto('/samples/python/class-instance/');
  const player = await ready(page, 10);
  const object = player.getByRole('article', { name: 'Student instance student-1', exact: true });
  const frame = player.locator('.frame[data-frame-id="1"]');
  await goTo(player, 1);
  await expect(player.locator('.heap-object')).toHaveCount(0);
  await goTo(player, 3);
  await expect(object).toContainText('No attributes yet');
  await expect(object.locator('.heap-heading .tag')).toHaveText('Student');
  await expect(player.locator('.globals [data-name="student"]')).toHaveCount(0);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(frame.locator('[data-name="self"]')).toHaveAttribute('data-ref', 'student-1');
  await expect(frame.locator('[data-name="name"]')).toContainText('"Ada"');
  await expect(object.locator('.heap-owners')).toHaveText('Referenced by: Student.__init__ #1.self');
  await goTo(player, 5);
  await expect(object.locator('.object-field')).toHaveCount(0);
  await expect(player.locator('.badge')).toContainText('"Ada"');
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(object.locator('.field-key')).toHaveText('name');
  await expect(object.locator('.field-value')).toHaveText('"Ada"');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(object.locator('.object-field')).toHaveCount(0);
  await goTo(player, 6);
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(frame).toHaveCount(0);
  await expect(player.locator('.badge .reference')).toContainText('→ student-1');
  await expect(player.locator('.badge .tag')).toHaveText('Student');
  await expect(player.locator('.globals [data-name="student"]')).toHaveCount(0);
  for (const theme of ['paper', 'terminal', 'midnight'] as const) {
    await selectTheme(page, theme);
    await expect(player.locator('.badge .reference')).toContainText('→ student-1');
    await expect(player.locator('.counter')).toHaveText('Step 7 / 10');
  }
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(frame.locator('[data-name="self"]')).toHaveAttribute('data-ref', 'student-1');
  await expect(object.locator('.field-value')).toHaveText('"Ada"');
  await goTo(player, 8);
  await expect(player.locator('.globals [data-name="student"]')).toHaveAttribute('data-ref', 'student-1');
  await expect(object.locator('.heap-owners')).toHaveText('Referenced by: student');
  await expect(player.locator('.heap-object')).toHaveCount(1);
  await goTo(player, 10);
  await expect(player.locator('.console pre')).toHaveText('Ada\n');
  const scrub = player.getByRole('slider', { name: 'Step', exact: true });
  await scrub.focus();
  await scrub.press('Home');
  await expect(player.locator('.heap-object')).toHaveCount(0);
  for (let step = 0; step < 7; step++) await scrub.press('ArrowRight');
  await settle(player);
  await expect(player.locator('.globals [data-name="student"]')).toHaveCount(0);
  await expect(player.locator('.badge .reference')).toContainText('→ student-1');
});

test('instance attribute writes and reads stay visible in short fullscreen layouts', async ({ page }) => {
  await page.goto('/samples/python/class-instance/');
  const player = await ready(page, 10);
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 600 });
    for (const step of [6, 9]) {
      await goTo(player, step);
      const field = await player.locator('.object-field[data-key="name"]').boundingBox();
      const pane = await player.locator('.data').boundingBox();
      expect(field!.y).toBeGreaterThanOrEqual(pane!.y);
      expect(field!.y + field!.height).toBeLessThanOrEqual(pane!.y + pane!.height);
      await expect(player.locator('.field-value')).toHaveText('"Ada"');
      const controls = await player.locator('.controls').boundingBox();
      expect(controls!.y + controls!.height).toBeLessThanOrEqual(600);
      expect(await page.locator('#lesson-view').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await goTo(player, 10);
    await expect(player.locator('.console pre')).toHaveText('Ada\n');
  }
});

test('two constructions bind self independently and attribute changes reverse without changing the other instance', async ({ page }) => {
  await page.goto('/samples/python/two-instances/');
  const player = await ready(page, 21);
  const first = player.getByRole('article', { name: 'Student instance student-1', exact: true });
  const second = player.getByRole('article', { name: 'Student instance student-2', exact: true });
  await goTo(player, 4);
  await expect(player.locator('.frame[data-frame-id="1"] [data-name="self"]')).toHaveAttribute('data-ref', 'student-1');
  await goTo(player, 10);
  await expect(first.locator('.field-value')).toHaveText('"Ada"');
  await expect(second).toContainText('No attributes yet');
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  const frame = player.locator('.frame[data-frame-id="2"]');
  await expect(player.locator('.frame[data-frame-id="1"]')).toHaveCount(0);
  await expect(frame.locator('[data-name="self"]')).toHaveAttribute('data-ref', 'student-2');
  await expect(frame.locator('[data-name="name"]')).toContainText('"Grace"');
  await expect(first.locator('.heap-owners')).toHaveText('Referenced by: ada');
  await expect(second.locator('.heap-owners')).toHaveText('Referenced by: Student.__init__ #2.self');
  await goTo(player, 13);
  await expect(first.locator('.field-value')).toHaveText('"Ada"');
  await expect(second.locator('.field-value')).toHaveText('"Grace"');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(second.locator('.object-field')).toHaveCount(0);
  await expect(first.locator('.field-value')).toHaveText('"Ada"');
  await goTo(player, 14);
  await expect(frame).toHaveCount(0);
  await expect(player.locator('.badge .reference')).toContainText('→ student-2');
  await expect(player.locator('.globals [data-name="grace"]')).toHaveCount(0);
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(frame.locator('[data-name="self"]')).toHaveAttribute('data-ref', 'student-2');
  await expect(second.locator('.field-value')).toHaveText('"Grace"');
  await goTo(player, 16);
  await expect(player.locator('.globals [data-name="ada"]')).toHaveAttribute('data-ref', 'student-1');
  await expect(player.locator('.globals [data-name="grace"]')).toHaveAttribute('data-ref', 'student-2');
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(first.locator('.field-value')).toHaveText('"Lovelace"');
  await expect(second.locator('.field-value')).toHaveText('"Grace"');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(first.locator('.field-value')).toHaveText('"Ada"');
  await expect(second.locator('.field-value')).toHaveText('"Grace"');
  await goTo(player, 21);
  await expect(player.locator('.console pre')).toHaveText('Lovelace\nGrace\n');
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.console pre')).toHaveText('Lovelace\n');
  await expect(player.locator('.badge')).toContainText('"Grace"');
  const scrub = player.getByRole('slider', { name: 'Step', exact: true });
  await scrub.focus();
  await scrub.press('Home');
  await expect(player.locator('.heap-object')).toHaveCount(0);
  await expect(player.locator('.globals [data-name]')).toHaveCount(0);
  for (let step = 0; step < 15; step++) await scrub.press('ArrowRight');
  await settle(player);
  await expect(first.locator('.field-value')).toHaveText('"Ada"');
  await expect(second.locator('.field-value')).toHaveText('"Grace"');
  await expect(player.locator('.console pre')).toHaveText('');
});

test('two-instance attribute reads follow the correct card in short fullscreen layouts', async ({ page }) => {
  await page.goto('/samples/python/two-instances/');
  const player = await ready(page, 21);
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 600 });
    for (const [step, id, value] of [[17, 'student-1', '"Lovelace"'], [20, 'student-2', '"Grace"']] as const) {
      await goTo(player, step);
      const object = player.getByRole('article', { name: `Student instance ${id}`, exact: true });
      await expect(object.locator('.field-value')).toHaveText(value);
      const field = await object.locator('.object-field').boundingBox();
      const pane = await player.locator('.data').boundingBox();
      expect(field!.y).toBeGreaterThanOrEqual(pane!.y);
      expect(field!.y + field!.height).toBeLessThanOrEqual(pane!.y + pane!.height);
      const controls = await player.locator('.controls').boundingBox();
      expect(controls!.y + controls!.height).toBeLessThanOrEqual(600);
      expect(await page.locator('#lesson-view').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
  }
});
