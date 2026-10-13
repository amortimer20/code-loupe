import { test, expect, ready, goTo, settle, selectTheme } from './helpers';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

test('keyboard focus reaches controls in order and native controls keep their own keys', async ({ page }) => {
  await page.goto('/__test/fixtures/embed.html');
  const player = await ready(page, 11);
  await player.evaluate(async el => {
    await (el as CodeLoupe).loadLesson('language: python\ncode: x = 5\nsteps:\n  - line: 1\n    badge: { over: "5", value: 5 }\n  - assign: { var: x, from: badge }\n');
  });
  await player.focus();
  await page.keyboard.press('Tab');
  await expect(player.locator('.code-host pre')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  const next = player.getByRole('button', { name: 'Next step', exact: true });
  await expect(next).toBeFocused();
  await page.keyboard.press('Enter');
  await settle(player);
  await expect(next).toBeFocused();
  await expect(player.locator('.step-status')).toContainText('Value of 5: 5, int');
  await page.keyboard.press('Tab');
  const scrub = player.getByRole('slider', { name: 'Step', exact: true });
  await expect(scrub).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await settle(player);
  await expect(scrub).toBeFocused();
  await expect(scrub).toHaveAttribute('aria-valuetext', 'Step 2 of 2');
  await expect(player.locator('.step-status')).toContainText('x is 5');
  await page.keyboard.press('Tab');
  await expect(player.getByRole('button', { name: 'Animations', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  const speed = player.getByRole('combobox', { name: 'Playback speed', exact: true });
  await expect(speed).toBeFocused();
  await page.keyboard.press('Home');
  await expect(speed).toHaveValue('0.25');
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(2);
  await page.keyboard.press('ArrowDown');
  await expect(speed).toHaveValue('0.5');
  await page.keyboard.press('End');
  await expect(speed).toHaveValue('2');
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(2);
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await player.focus();
  await page.keyboard.press('Control+ArrowLeft');
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(2);
  await page.keyboard.press('Home');
  await settle(player);
  await expect(player).toBeFocused();
  await expect(player.locator('.step-status')).toHaveText('Step 0 of 2. Ready to start.');
  await player.evaluate(el => el.setAttribute('no-keyboard', ''));
  await page.keyboard.press('ArrowRight');
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(0);
  await next.focus();
  await page.keyboard.press('Space');
  await settle(player);
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(1);
  await player.evaluate(el => el.removeAttribute('no-keyboard'));
  await next.focus();
  await page.keyboard.press('Space');
  await settle(player);
  await expect(player).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await settle(player);
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(1);
  await player.getByRole('button', { name: 'Previous step', exact: true }).focus();
  await page.keyboard.press('Enter');
  await settle(player);
  await expect(player).toBeFocused();
  expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(0);
  await player.evaluate(el => {
    const input = document.createElement('input');
    input.slot = 'viewer-actions';
    input.setAttribute('aria-label', 'Student input');
    input.value = 'hello';
    const notes = document.createElement('div');
    notes.slot = 'viewer-actions';
    notes.contentEditable = 'true';
    notes.setAttribute('role', 'textbox');
    notes.setAttribute('aria-label', 'Notes');
    notes.innerHTML = '<span>Notes</span>';
    el.append(input, notes);
  });
  for (const name of ['Student input', 'Notes']) {
    await player.getByRole('textbox', { name, exact: true }).focus();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowRight');
    expect(await player.evaluate(el => (el as CodeLoupe).step)).toBe(0);
  }
});

test('list cells expose relevant names for aliases and shadowed local frames', async ({ page }) => {
  await page.goto('/samples/python/list-aliasing/');
  const player = await ready(page, 7);
  await goTo(player, 5);
  await expect(player.getByRole('listitem', { name: 'numbers[2] is 6, selected', exact: true })).toBeVisible();
  await player.evaluate(async el => {
    await (el as CodeLoupe).loadLesson(`language: python
code: |
  inspect(numbers)
  return numbers
steps:
  - line: 1
    assign: { var: numbers, value: [1, 2] }
  - assign: { var: other, ref: list-1 }
  - select: 'other[1]'
  - call: { name: inspect, over: inspect(numbers), line: 2, args: [{ var: numbers, value: [9] }] }
  - select: 'numbers[0]'
  - assign: { var: numbers, value: 0 }
`);
  });
  await goTo(player, 3);
  await expect(player.getByRole('listitem', { name: 'other[1] is 2, selected', exact: true })).toBeVisible();
  await goTo(player, 5);
  await expect(player.getByRole('listitem', { name: 'inspect #1.numbers[0] is 9, selected', exact: true })).toBeVisible();
  await expect(player.locator('.heap-object[data-ref="list-1"]')).toHaveAccessibleName('List object list-1');
  await goTo(player, 6);
  await expect(player.getByRole('listitem', { name: 'list-2[0] is 9', exact: true })).toBeVisible();
});

test('step status includes captions and errors once and ignores cosmetic renders', async ({ page }) => {
  await page.goto('/samples/python/list-update/');
  const player = await ready(page, 6);
  await goTo(player, 5);
  const status = player.locator('.step-status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveAttribute('aria-atomic', 'true');
  await expect(status).toContainText('Step 5 of 6. Line 3. Value of numbers: [2, 10, 6], list.');
  await expect(status).toContainText('Read the whole updated list to print it.');
  await expect(player.locator('[aria-live="polite"]')).toHaveCount(1);
  await player.evaluate(el => {
    const region = el.shadowRoot!.querySelector('.step-status')!;
    const counts = { changes: 0 };
    (el as HTMLElement & { statusChanges: typeof counts }).statusChanges = counts;
    new MutationObserver(records => { counts.changes += records.length; }).observe(region, { childList: true, characterData: true, subtree: true });
  });
  await selectTheme(page, 'paper');
  await page.setViewportSize({ width: 800, height: 700 });
  await settle(player);
  expect(await player.evaluate(el => (el as HTMLElement & { statusChanges: { changes: number } }).statusChanges.changes)).toBe(0);
  await goTo(player, 4);
  await expect(status).toContainText('Step 4 of 6.');
  expect(await player.evaluate(el => (el as HTMLElement & { statusChanges: { changes: number } }).statusChanges.changes)).toBe(1);
  await player.evaluate(async el => {
    await (el as CodeLoupe).loadLesson('language: python\ncode: x\nsteps:\n  - error: { kind: runtime, name: ValueError, message: "Invalid number", line: 1 }\n');
  });
  await goTo(player, 1);
  await expect(status).toContainText('ValueError: Invalid number');
  await expect(status).toContainText('Execution stopped.');
  await expect(player.locator('.diagnostic')).not.toHaveAttribute('aria-live');
  await player.evaluate(async el => { await (el as CodeLoupe).loadLesson('steps: broken'); });
  await expect(player.getByRole('alert')).toBeVisible();
  await expect(status).toBeEmpty();
});

test('keyboard fullscreen leaves background controls unreachable and restores focus on exit', async ({ page }) => {
  await page.goto('/samples/python/nested-function-call/');
  const player = await ready(page, 19);
  const enter = page.getByRole('button', { name: 'Enter fullscreen', exact: true });
  await enter.focus();
  await page.keyboard.press('Enter');
  const exit = page.getByRole('button', { name: 'Exit fullscreen', exact: true });
  await expect(exit).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    // Chromium briefly focuses the body when wrapping the native modal tab sequence.
    expect(await page.locator('#lesson-view').evaluate(el => el.matches(':modal')
      && (document.activeElement === document.body || el.contains(document.activeElement)))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(enter).toBeFocused();
  await expect(player).not.toHaveAttribute('fit');
});

test('combined steps announce all changed bindings and orphan labels survive backward stepping', async ({ page }) => {
  await page.goto('/__test/fixtures/embed.html');
  const player = await ready(page, 11);
  await player.evaluate(async el => {
    await (el as CodeLoupe).loadLesson(`language: python
code: |
  numbers = [1]
  result = numbers.append(2)
  numbers = len(numbers)
steps:
  - line: 1
    assign: { var: numbers, value: [1] }
  - line: 2
    assign: { var: result, value: null }
    append: { target: numbers, value: 2 }
  - line: 3
    badge: { over: numbers, nth: 2, value: [1, 2], from: numbers }
    assign: { var: numbers, value: 2 }
`);
  });
  await goTo(player, 2);
  await expect(player.locator('.step-status')).toContainText('result is None.');
  await expect(player.locator('.step-status')).toContainText('numbers is [1, 2].');
  await expect(player.getByRole('listitem', { name: 'numbers[0] is 1', exact: true })).toBeVisible();
  await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await settle(player);
  await expect(player.locator('.globals [data-name="numbers"] .value')).toHaveText('2');
  await expect(player.getByRole('listitem', { name: 'list-1[0] is 1', exact: true })).toBeVisible();
  await expect(player.getByRole('listitem', { name: 'numbers[0] is 1', exact: true })).toHaveCount(0);
  await player.getByRole('button', { name: 'Previous step', exact: true }).click();
  await settle(player);
  await expect(player.getByRole('listitem', { name: 'numbers[0] is 1', exact: true })).toBeVisible();
  await expect(player.locator('.step-status')).toContainText('result is None.');
  await expect(player.locator('.step-status')).toContainText('numbers is [1, 2].');
  await goTo(player, 1);
  await expect(player.locator('.heap-object .collection-item')).toHaveText('1');
  await expect(player.locator('.globals [data-name="result"]')).toHaveCount(0);
});
