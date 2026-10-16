import { test, expect } from './helpers';
import type { Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/math-loupe/');
  await expect(page.locator('math-loupe')).toHaveAttribute('data-ready', 'true');
}
const expression = (page: Page) => page.locator('.ml-expression math');
const next = (page: Page) => page.getByRole('button', { name: 'Next step', exact: true });
async function freeze(page: Page, fraction: number) {
  await page.locator('.ml-stage').evaluate((el, f) => el.getAnimations({ subtree: true }).forEach(animation => {
    animation.pause(); animation.currentTime = f * Number(animation.effect!.getTiming().duration);
  }), fraction);
}

test('math loupe renders MathML and steps through reversible snapshots', async ({ page }) => {
  await ready(page);
  const stage = page.locator('.ml-stage');
  await expect(expression(page)).toHaveText('3+2×4');
  await expect(stage).toHaveAttribute('aria-label', '3 plus 2 times 4');
  await expect(page.locator('.ml-focus-box')).toHaveCount(0);
  await expect(page.locator('math-loupe .caption')).toHaveText('');
  await expect(page.locator('.ml-expression mo')).toHaveText(['+', '×']);
  for (const [text, focus, spoken] of [['3+2×4', ['2', '×', '4'], '3 plus 2 times 4'], ['3+8', ['8'], '3 plus 8'], ['3+8', ['3', '+', '8'], '3 plus 8'], ['11', ['11'], '11']] as const) {
    await next(page).click();
    await page.locator('.ml-stage').evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
    await expect(expression(page)).toHaveText(text);
    await expect(page.locator('.ml-expression .ml-focus-glyph')).toHaveText([...focus]);
    await expect(page.locator('.ml-focus-box')).toHaveCount(1);
    await expect(stage).toHaveAttribute('aria-label', spoken);
  }
  await expect(next(page)).toBeDisabled();
  await page.locator('math-loupe').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(expression(page)).toHaveText('3+8');
  await page.keyboard.press('Home');
  await expect(expression(page)).toHaveText('3+2×4');
  await expect(page.locator('.ml-focus-box')).toHaveCount(0);
  await expect(page.locator('math-loupe .counter')).toHaveText('Step 0 / 4');
});

test('evaluation installs the final expression first and keeps leading terms still', async ({ page }, testInfo) => {
  await ready(page);
  await next(page).click();
  await page.locator('.ml-stage').evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
  const three = page.locator('[data-token="three"]'), plus = page.locator('[data-token="t-product/sign"]');
  const before = [await three.boundingBox(), await plus.boundingBox()];
  await next(page).click();
  if (testInfo.project.name === 'chromium-reduced') {
    await expect(page.locator('math-loupe .ca')).toHaveAttribute('data-animating', 'false');
    await expect(page.locator('.ml-ghost')).toHaveCount(0);
  } else {
    await freeze(page, .25);
    // The real DOM is already the result; departing glyphs are temporary overlays.
    await expect(expression(page)).toHaveText('3+8');
    await expect(page.locator('.ml-ghost')).toHaveText(['2', '×', '4']);
    expect(Number(await page.locator('[data-token="eight"]').evaluate(el => getComputedStyle(el).opacity))).toBe(0);
    await freeze(page, .7);
    expect(Number(await page.locator('[data-token="eight"]').evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(.5);
    await page.locator('.ml-stage').evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
  }
  await expect(page.locator('.ml-ghost')).toHaveCount(0);
  expect([await three.boundingBox(), await plus.boundingBox()]).toEqual(before);
  const box = await page.locator('.ml-focus-box').boundingBox(), eight = await page.locator('[data-token="eight"]').boundingBox();
  expect(box!.x).toBeLessThan(eight!.x); expect(box!.x + box!.width).toBeGreaterThan(eight!.x + eight!.width);
});

test('navigation during a transition leaves no overlays behind', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-reduced', 'No transitions with reduced motion.');
  await ready(page);
  await next(page).click(); await next(page).click();
  await freeze(page, .3);
  await expect(page.locator('.ml-ghost')).toHaveCount(3);
  await next(page).click(); // A rapid click finishes the evaluation before the next step.
  await expect(page.locator('.ml-ghost')).toHaveCount(0);
  await expect(page.locator('math-loupe .counter')).toHaveText('Step 3 / 4');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(expression(page)).toHaveText('3+2×4');
  await expect(page.locator('.ml-ghost, .ml-focus-box')).toHaveCount(0);
  expect(await page.locator('.ml-stage').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test('parentheses leave with their sum while the remaining factor slides into place', async ({ page }, testInfo) => {
  await ready(page);
  await page.locator('#ml-example').selectOption('grouping');
  await expect(page.locator('math-loupe .title')).toHaveText('Parentheses change the grouping');
  await expect(page.locator('#ml-objective')).toContainText('same numbers');
  await expect(expression(page)).toHaveText('(3+2)×4');
  await expect(page.locator('.ml-stage')).toHaveAttribute('aria-label', 'open parenthesis 3 plus 2 close parenthesis times 4');
  await next(page).click();
  await page.locator('.ml-stage').evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
  await expect(page.locator('.ml-expression .ml-focus-glyph')).toHaveText(['3', '+', '2']);
  const times = page.locator('[data-token="product/op"]'), start = (await times.boundingBox())!.x;
  await next(page).click();
  await expect(expression(page)).toHaveText('5×4');
  const end = await times.evaluate(el => { const box = el.getBoundingClientRect(); return box.x - (new DOMMatrix(getComputedStyle(el).transform).m41 || 0); });
  expect(end).toBeLessThan(start);
  if (testInfo.project.name !== 'chromium-reduced') {
    await freeze(page, .25);
    await expect(page.locator('.ml-ghost')).toHaveText(['(', '3', '+', '2', ')']);
    const sliding = (await times.boundingBox())!.x;
    expect(sliding).toBeLessThanOrEqual(start); expect(sliding).toBeGreaterThan(end);
    // Switching examples mid-transition must not carry overlays into the next lesson.
    await page.locator('#ml-example').selectOption('order');
    await expect(page.locator('.ml-ghost')).toHaveCount(0);
    await expect(expression(page)).toHaveText('3+2×4');
    await page.locator('#ml-example').selectOption('grouping');
    await next(page).click(); await next(page).click();
    await page.locator('.ml-stage').evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
  }
  await expect(page.locator('.ml-ghost')).toHaveCount(0);
  await next(page).click(); await next(page).click();
  await page.locator('.ml-stage').evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
  await expect(expression(page)).toHaveText('20');
  await expect(page.locator('math-loupe .caption')).toContainText('Grouping changed the order and the result');
});

test('the equation keeps its equals sign fixed while both sides change together', async ({ page }, testInfo) => {
  await ready(page);
  await page.locator('#ml-example').selectOption('equation');
  // MathML keeps invisible multiplication in 2x as a character; compare visible text only.
  const shown = () => expression(page).evaluate(el => el.textContent!.replace(/⁢/g, ''));
  const equals = page.locator('[data-token="equation/="]');
  const center = async () => { const box = (await equals.boundingBox())!; return box.x + box.width / 2; };
  await expect.poll(shown).toBe('2x+3=11');
  await expect(page.locator('.ml-stage')).toHaveAttribute('aria-label', '2 x plus 3 equals 11');
  const anchor = await center();
  const steps = [
    ['2x+3=11', ['+', '3']], ['2x+3−3=11−3', ['−', '3', '−', '3']], ['2x+0=8', ['+', '0', '8']],
    ['2x=8', ['2', '⁢', 'x', '8']], ['2x÷2=8÷2', ['2', '⁢', 'x', '÷', '2', '8', '÷', '2']], ['x=4', ['x', '4']],
  ] as const;
  for (const [index, [text, focus]] of steps.entries()) {
    await next(page).click();
    if (testInfo.project.name !== 'chromium-reduced' && index > 0) {
      await freeze(page, .3);
      expect(Math.abs(await center() - anchor)).toBeLessThan(.5);
      if (index === 2) await expect(page.locator('.ml-ghost')).toHaveText(['+', '3', '−', '3', '11', '−', '3']);
      if (index === 3) await expect(page.locator('.ml-ghost')).toHaveText(['+', '0']);
      if (index === 5) {
        // x survives the division as the same glyph: it moves rather than fading in.
        await expect(page.locator('.ml-ghost')).toHaveText(['2', '⁢', '÷', '2', '8', '÷', '2']);
        expect(Number(await page.locator('[data-token="x"]').evaluate(el => getComputedStyle(el).opacity))).toBe(1);
      }
    }
    await page.locator('.ml-stage').evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
    await expect.poll(shown).toBe(text);
    await expect(page.locator('.ml-expression .ml-focus-glyph')).toHaveText([...focus]);
    await expect(page.locator('.ml-ghost')).toHaveCount(0);
    expect(Math.abs(await center() - anchor)).toBeLessThan(.5);
  }
  await expect(page.locator('.ml-stage')).toHaveAttribute('aria-label', 'x equals 4');
  await page.locator('math-loupe').focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(shown).toBe('2x÷2=8÷2');
  await page.keyboard.press('Home');
  await expect.poll(shown).toBe('2x+3=11');
  expect(Math.abs(await center() - anchor)).toBeLessThan(.5);
});

test('the equation fits a narrow screen without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await ready(page);
  await page.locator('#ml-example').selectOption('equation');
  const stage = page.locator('.ml-stage');
  for (let step = 0; step <= 6; step++) {
    if (step) { await next(page).click(); await stage.evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => animation.finish())); }
    const fits = await stage.evaluate(el => {
      const box = el.getBoundingClientRect();
      return [...el.querySelectorAll('[data-token]')].every(token => { const r = token.getBoundingClientRect(); return r.left >= box.left && r.right <= box.right; });
    });
    expect(fits).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});

// Shared chrome: the same frame, panels, caption and controls as <code-loupe>.
async function chrome(page: Page, selector: string) {
  return page.locator(selector).evaluate(host => {
    const root = host.shadowRoot!, style = (sel: string, props: string[]) => {
      const cs = getComputedStyle(root.querySelector(sel)!);
      return Object.fromEntries(props.map(prop => [prop, cs.getPropertyValue(prop)]));
    };
    return {
      frame: style('.ca', ['background-color', 'color', 'border-top-color', 'border-top-width', 'font-family']),
      title: style('.title', ['font-weight', 'padding-top', 'border-bottom-color']),
      data: style('.data', ['background-color', 'padding-left', 'border-right-color']),
      label: style('.label', ['font-size', 'letter-spacing', 'text-transform', 'color']),
      caption: style('.caption', ['padding-top', 'padding-left', 'line-height', 'border-top-color']),
      controls: style('.controls', ['background-color', 'padding-top', 'gap']),
      button: style('.controls button', ['width', 'height']),
      buttons: [...root.querySelectorAll('.controls button')].map(button => button.getAttribute('aria-label')),
      speeds: [...root.querySelectorAll('.speed option')].map(option => option.textContent),
    };
  });
}

test('the math player shares the code player chrome', async ({ page }) => {
  await page.goto('/samples/python/simple-arithmetic/');
  await page.locator('#site-theme').selectOption('terminal');
  await expect(page.locator('code-loupe .counter')).toHaveText(/Step 0 \//);
  const code = await chrome(page, 'code-loupe');
  await ready(page);
  await expect(page.locator('math-loupe')).toHaveAttribute('theme', 'terminal');
  expect(await chrome(page, 'math-loupe')).toEqual(code);
  await expect(page.locator('math-loupe .counter')).toHaveText('Step 0 / 4');
  await expect(page.locator('math-loupe .title')).toHaveText('Multiplication before addition');
  await expect(page.locator('math-loupe .label')).toHaveText('Variables');
});

test('math playback follows code-loupe autoplay, speed and motion rules', async ({ page }, testInfo) => {
  await ready(page);
  const player = page.locator('math-loupe'), counter = page.locator('math-loupe .counter');
  await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(counter).toHaveText('Step 4 / 4', { timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  // Play at the end restarts; Space toggles; stepping by hand pauses.
  await player.focus(); await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  // Speed is remembered and shared with code loupes.
  expect(await page.evaluate(() => localStorage.getItem('code-loupe:speed'))).toBe('2');
  if (testInfo.project.name !== 'chromium-reduced') {
    await page.keyboard.press('Home');
    await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('0.5');
    await next(page).click(); await next(page).click();
    await expect.poll(() => page.locator('.ml-stage').evaluate(el => [...new Set(el.getAnimations({ subtree: true }).map(a => a.playbackRate))])).toEqual([.5]);
    await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('2');
    await expect.poll(() => page.locator('.ml-stage').evaluate(el => [...new Set(el.getAnimations({ subtree: true }).map(a => a.playbackRate))])).toEqual([2]);
    // Turning animations off settles the current transition, as in code loupes.
    const toggle = page.getByRole('button', { name: 'Animations', exact: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.ml-ghost')).toHaveCount(0);
    await next(page).click();
    expect(await page.locator('.ml-stage').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('code-loupe:motion'))).toBe('reduced');
  }
});

test('math variables, themes and fullscreen behave like a code sample', async ({ page }) => {
  await ready(page);
  await page.locator('#ml-example').selectOption('equation');
  const variable = page.locator('math-loupe .var');
  await expect(variable).toHaveCount(0);
  await next(page).click();
  await expect(variable).toHaveAttribute('aria-label', 'x: unknown');
  await expect(page.locator('math-loupe .var .tag')).toHaveText('unknown');
  await page.locator('math-loupe').focus(); await page.keyboard.press('End');
  await expect(variable).toHaveAttribute('aria-label', 'x: 4');
  await expect(page.locator('math-loupe .var .value')).toHaveText('4');
  await expect(page.locator('math-loupe .step-status')).toContainText('x is 4');
  // The site's lesson theme recolors the player and keeps its step.
  await page.locator('#site-theme').selectOption('paper');
  await expect.poll(() => page.locator('math-loupe .ca').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(250, 247, 239)');
  await expect(page.locator('math-loupe .counter')).toHaveText('Step 6 / 6');
  // Fullscreen uses the same dialog and fit layout as code samples.
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect(page.locator('math-loupe')).toHaveAttribute('fit', '');
  const viewport = page.viewportSize()!;
  expect((await page.locator('math-loupe').boundingBox())!.height).toBeGreaterThan(viewport.height * .9);
  await expect(page.locator('math-loupe .counter')).toHaveText('Step 6 / 6');
  await page.keyboard.press('Escape');
  await expect(page.locator('math-loupe')).not.toHaveAttribute('fit');
  await expect(page.getByRole('button', { name: 'Enter fullscreen', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('math-loupe .counter')).toHaveText('Step 6 / 6');
  await page.keyboard.press('ArrowLeft');
  await expect(variable).toHaveAttribute('aria-label', 'x: unknown');
});
