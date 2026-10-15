import { test, expect } from './helpers';
import type { Page, Locator } from '@playwright/test';

async function playerBounds(locator: Locator) {
  return locator.evaluate(el => {
    const rect = el.getBoundingClientRect(), player = el.closest('#math-viewer')!.getBoundingClientRect();
    return { x:rect.x - player.x, y:rect.y - player.y, width:rect.width, height:rect.height };
  });
}
async function readyMath(page: Page) {
  await page.goto('/math/');
  await expect(page.locator('#math-viewer')).toHaveAttribute('data-ready', 'true');
}
async function scrubTo(page: Page, step: number) {
  await page.getByRole('slider', { name:'Step', exact:true }).evaluate((el, value) => {
    (el as HTMLInputElement).value = String(value); el.dispatchEvent(new Event('input', { bubbles:true }));
  }, step);
}
async function finishEntry(page: Page) {
  await page.getByRole('button', { name:'Next step', exact:true }).click();
  await expect(page.locator('#math-viewer')).toHaveAttribute('data-animating', 'false');
  await expect(page.locator('#math-counter')).toHaveText('Step 1 of 3');
}

test('math starts like code: visible expression, inactive Step 0, then reversible teaching steps', async ({ page }) => {
  await readyMath(page);
  const viewer = page.locator('#math-viewer'), current = page.locator('#math-current');
  await expect(current).toHaveText('3 + 2 × 4');
  await expect(current.locator('.math-emphasis')).toHaveCount(0);
  await expect(page.locator('#math-caption')).toHaveText('');
  await expect(page.locator('#math-counter')).toHaveText('Step 0 of 3');
  await expect(page.locator('code-loupe, #math-previous-region')).toHaveCount(0);
  await expect(page.getByRole('button', { name:'Previous step', exact:true })).toBeDisabled();
  await finishEntry(page);
  await expect(current.locator('.math-emphasis')).toHaveText('2 × 4');
  const first = await current.innerHTML();
  await page.getByRole('button', { name:'Next step', exact:true }).click();
  await expect(current).toHaveText('3 + 8');
  await expect(current.locator('.math-emphasis')).toHaveText('8');
  await page.getByRole('button', { name:'Previous step', exact:true }).click();
  expect(await current.innerHTML()).toBe(first);
  await viewer.focus(); await page.keyboard.press('End');
  await expect(current).toHaveText('11');
  await expect(page.getByRole('button', { name:'Next step', exact:true })).toBeDisabled();
  await expect(viewer).toBeFocused();
  await page.keyboard.press('Home');
  await expect(current).toHaveText('3 + 2 × 4');
  await expect(current.locator('.math-emphasis')).toHaveCount(0);
  await page.locator('#math-example').selectOption('grouping');
  await expect(current).toHaveText('(3 + 2) × 4');
  await page.getByRole('button', { name:'Next step', exact:true }).click();
  await expect(current.locator('.math-emphasis')).toHaveText('3 + 2');
  await viewer.focus(); await page.keyboard.press('End');
  await expect(current).toHaveText('20');
  await page.locator('#math-example').selectOption('equation');
  await expect(page.locator('#math-variables')).toHaveText('');
  await scrubTo(page, 2);
  await expect(current.locator('.math-emphasis')).toHaveText(['− 3', '− 3']);
  await expect(page.locator('#math-caption')).toContainText('preserve equality');
  await scrubTo(page, 4);
  await expect(current.locator('.math-emphasis')).toHaveText(['÷ 2', '÷ 2']);
  await viewer.focus(); await page.keyboard.press('End');
  await expect(current).toHaveText('x=4');
  await page.keyboard.press('ArrowLeft');
  await expect(current).toHaveText('2x ÷ 2=8 ÷ 2');
  await page.keyboard.press('Home');
  await expect(current).toHaveText('2x + 3=11');
  await expect(page.locator('#math-counter')).toHaveText('Step 0 of 5');
});

test('math layout stays aligned in short/narrow fullscreen and player palettes', async ({ page }, testInfo) => {
  await readyMath(page);
  const viewer = page.locator('#math-viewer');
  await page.locator('#math-example').selectOption('equation'); await scrubTo(page, 4);
  for (const theme of ['paper', 'midnight', 'terminal']) {
    await page.locator('#site-theme').selectOption(theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height:600 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.getByRole('button', { name:'Fullscreen', exact:true }).click();
      await expect(page.getByRole('button', { name:'Exit fullscreen', exact:true })).toHaveAttribute('aria-pressed', 'true');
      expect(await viewer.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      const initial = await page.locator('#math-current .math-equals').boundingBox();
      await page.getByRole('button', { name:'Next step', exact:true }).click();
      await expect(page.locator('#math-current')).toHaveText('x=4');
      const solved = await page.locator('#math-current .math-equals').boundingBox();
      expect(Math.abs(initial!.x + initial!.width / 2 - solved!.x - solved!.width / 2)).toBeLessThan(1);
      await page.getByRole('button', { name:'Previous step', exact:true }).click();
      const title = await page.locator('#math-title').boundingBox();
      expect(title!.y).toBeGreaterThanOrEqual(0);
      expect(title!.y + title!.height).toBeLessThanOrEqual(600);
      await page.screenshot({ path:testInfo.outputPath(`math-${theme}-${width}.png`) });
      await page.getByRole('button', { name:'Exit fullscreen', exact:true }).click();
      await expect(page.locator('#math-counter')).toHaveText('Step 4 of 5');
    }
  }
});

test('math starting expression remains readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled:false });
  const page = await context.newPage();
  try {
    await page.goto('/math/');
    await expect(page.locator('#math-current')).toHaveAttribute('aria-label', '3 plus 2 times 4');
    await expect(page.locator('#math-caption')).toHaveText('');
    await expect(page.getByRole('button', { name:'Next step', exact:true })).toBeDisabled();
    await expect(page.locator('noscript p')).toBeVisible();
  } finally { await context.close(); }
});

test('arithmetic replacement animates both calculations and keeps the unchanged prefix anchored', async ({ page }, testInfo) => {
  await readyMath(page); await finishEntry(page);
  const viewer = page.locator('#math-viewer'), current = page.locator('#math-current');
  await page.getByRole('button', { name:'Next step', exact:true }).click();
  if (testInfo.project.name === 'chromium-reduced') {
    await expect(viewer).toHaveAttribute('data-animating', 'false');
    await expect(page.locator('.math-evaluation-flight')).toHaveCount(0);
  } else {
    await expect(viewer).toHaveAttribute('data-animating', 'true');
    await current.evaluate(el => el.getAnimations({ subtree:true }).forEach(animation => { animation.pause(); animation.currentTime = 500; }));
    const prefix = current.locator('[data-part="prefix"]'), flight = current.locator('.math-evaluation-flight');
    const anchored = await prefix.boundingBox(), start = await flight.boundingBox();
    await current.evaluate(el => el.getAnimations({ subtree:true }).forEach(animation => { animation.currentTime = 900; }));
    const landed = await flight.boundingBox();
    expect(landed!.x).toBeLessThan(start!.x);
    expect(landed!.width).toBe(start!.width);
    expect(landed!.height).toBe(start!.height);
    expect(await prefix.boundingBox()).toEqual(anchored);
    await page.screenshot({ path:testInfo.outputPath('math-product-replacement.png') });
    await current.evaluate(el => el.getAnimations({ subtree:true }).forEach(animation => animation.finish()));
    await expect(viewer).toHaveAttribute('data-animating', 'false');
    expect(await prefix.boundingBox()).toEqual(anchored);
    const actual = await current.locator('[data-part="product-result"]').boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(actual![key] - landed![key])).toBeLessThan(.1);
  }
  await expect(current).toHaveText('3 + 8');
  await expect(current.locator('.math-emphasis')).toHaveText('8');
  await page.getByRole('button', { name:'Next step', exact:true }).click();
  if (testInfo.project.name !== 'chromium-reduced') {
    await expect(viewer).toHaveAttribute('data-animating', 'true');
    await expect(current.locator('.math-evaluation-flight')).toHaveText('11');
    await current.evaluate(el => el.getAnimations({ subtree:true }).forEach(animation => { animation.pause(); animation.currentTime = 650; }));
    await page.screenshot({ path:testInfo.outputPath('math-sum-replacement.png') });
    await current.evaluate(el => el.getAnimations({ subtree:true }).forEach(animation => animation.finish()));
  }
  await expect(current).toHaveText('11');
  await expect(viewer).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('slider', { name:'Step', exact:true })).toHaveValue('3');
  await page.getByRole('button', { name:'Previous step', exact:true }).click();
  await expect(current).toHaveText('3 + 8');
});

test('math animation interruptions restore state and honor explicit motion preferences', async ({ page }, testInfo) => {
  await readyMath(page);
  const viewer = page.locator('#math-viewer'), current = page.locator('#math-current');
  const start = async () => {
    await scrubTo(page, 1);
    await page.getByRole('button', { name:'Next step', exact:true }).click();
    if (testInfo.project.name !== 'chromium-reduced') {
      await expect(viewer).toHaveAttribute('data-animating', 'true');
      await current.evaluate(el => el.getAnimations({ subtree:true }).forEach(animation => animation.pause()));
    }
  };
  await start();
  await page.getByRole('button', { name:'Previous step', exact:true }).click();
  await expect(current).toHaveText('3 + 2 × 4');
  await expect(viewer).toHaveAttribute('data-animating', 'false');
  await start();
  await page.getByRole('slider', { name:'Step', exact:true }).focus(); await page.keyboard.press('Home');
  await expect(page.locator('#math-counter')).toHaveText('Step 0 of 3');
  await expect(current.locator('.math-emphasis')).toHaveCount(0);
  await start(); await page.locator('#math-example').selectOption('equation');
  await expect(current).toHaveText('2x + 3=11');
  await expect(page.locator('.math-evaluation-flight')).toHaveCount(0);
  await page.locator('#math-example').selectOption('order');
  if (testInfo.project.name !== 'chromium-reduced') {
    await start(); await page.setViewportSize({ width:390, height:600 });
    await expect(current).toHaveText('3 + 8');
    await start(); await page.emulateMedia({ reducedMotion:'reduce' });
    await expect(current).toHaveText('3 + 8');
    const toggle = page.getByRole('button', { name:'Animations', exact:true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click(); // Explicit viewer choice overrides the system default, as in code loupes.
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await scrubTo(page, 1); await page.getByRole('button', { name:'Next step', exact:true }).click();
    await expect(viewer).toHaveAttribute('data-animating', 'true');
    await toggle.click();
    await expect(viewer).toHaveAttribute('data-animating', 'false');
    await expect(current).toHaveText('3 + 8');
  }
});

test('math viewer keeps a stable stage, shows authored variables and follows player themes', async ({ page }) => {
  await readyMath(page);
  const viewer = page.locator('#math-viewer');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height:600 });
    const initial = await viewer.boundingBox();
    for (const step of [1, 2, 3, 0]) {
      await scrubTo(page, step);
      expect((await viewer.boundingBox())!.height).toBe(initial!.height);
    }
  }
  await page.locator('#math-example').selectOption('equation');
  await expect(page.locator('#math-variables')).toHaveText('');
  await scrubTo(page, 1);
  await expect(page.locator('.math-variable')).toHaveAttribute('aria-label', 'x: unknown');
  const start = await viewer.boundingBox();
  await scrubTo(page, 5);
  await expect(page.locator('.math-variable')).toHaveAttribute('aria-label', 'x: 4');
  expect((await viewer.boundingBox())!.height).toBe(start!.height);
  await page.locator('#site-theme').selectOption('paper');
  await expect.poll(() => viewer.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(250, 247, 239)');
  await expect(page.locator('.math-variable')).toHaveAttribute('aria-label', 'x: 4');
  await page.locator('#site-theme').selectOption('midnight');
  await expect.poll(() => viewer.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(25, 29, 45)');
  await scrubTo(page, 4);
  await expect(page.locator('.math-variable')).toHaveAttribute('aria-label', 'x: unknown');
  await scrubTo(page, 0); await expect(page.locator('.math-variable')).toHaveCount(0);
});

test('math autoplay honors pause, speed, manual navigation and motion toggle', async ({ page }, testInfo) => {
  await readyMath(page);
  const viewer = page.locator('#math-viewer');
  await page.getByRole('combobox', { name:'Playback speed', exact:true }).selectOption('2');
  await page.getByRole('button', { name:'Play', exact:true }).click();
  await expect(page.getByRole('button', { name:'Pause', exact:true })).toBeVisible();
  await expect(page.locator('#math-current')).toHaveText('11');
  await expect(page.getByRole('button', { name:'Play', exact:true })).toBeVisible();
  await viewer.focus(); await page.keyboard.press('Space');
  await expect(page.locator('#math-counter')).toHaveText('Step 0 of 3');
  await page.getByRole('button', { name:'Pause', exact:true }).click();
  await expect(page.getByRole('button', { name:'Play', exact:true })).toBeVisible();
  if (testInfo.project.name !== 'chromium-reduced') {
    const toggle = page.getByRole('button', { name:'Animations', exact:true });
    await toggle.click(); await scrubTo(page, 1);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name:'Next step', exact:true }).click();
    await expect(viewer).toHaveAttribute('data-animating', 'false');
    await expect(page.locator('#math-current')).toHaveText('3 + 8');
    await toggle.click(); await scrubTo(page, 1);
    await page.getByRole('combobox', { name:'Playback speed', exact:true }).selectOption('0.5');
    await page.getByRole('button', { name:'Next step', exact:true }).click();
    await expect(viewer).toHaveAttribute('data-animating', 'true');
    await expect.poll(() => viewer.evaluate(el => el.getAnimations({ subtree:true }).map(animation => animation.playbackRate))).toEqual([.5, .5]);
    await page.getByRole('combobox', { name:'Playback speed', exact:true }).selectOption('2');
    await expect.poll(() => viewer.evaluate(el => el.getAnimations({ subtree:true }).map(animation => animation.playbackRate))).toEqual([2, 2]);
  }
  await scrubTo(page, 1);
  await page.getByRole('button', { name:'Play', exact:true }).click();
  await page.getByRole('button', { name:'Next step', exact:true }).click();
  await expect(page.getByRole('button', { name:'Play', exact:true })).toBeVisible();
  await expect(page.locator('#math-current')).toHaveText('3 + 8');
});

test('math quality pass: natural spacing and exact handoff at normal and slow speeds', async ({ page }, testInfo) => {
  await readyMath(page);
  const current = page.locator('#math-current'), viewer = page.locator('#math-viewer');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height:720 });
    for (const speed of ['1', '0.5']) {
      await page.locator('#math-speed').selectOption(speed);
      await scrubTo(page, 1);
      const prefix = current.locator('[data-part="prefix"]');
      const initial = await playerBounds(prefix);
      await page.getByRole('button', { name:'Next step', exact:true }).click();
      if (testInfo.project.name !== 'chromium-reduced') {
        await expect(viewer).toHaveAttribute('data-animating', 'true');
        await current.evaluate(el => el.getAnimations({ subtree:true }).forEach(animation => { animation.pause(); animation.currentTime = 200; }));
        await current.screenshot({ path:testInfo.outputPath(`quality-${width}-${speed}-operation.png`) });
        await current.evaluate(el => el.getAnimations({ subtree:true }).forEach(animation => { animation.currentTime = 550; }));
        const result = current.locator('.math-evaluation-flight');
        const emerging = await playerBounds(result);
        await current.screenshot({ path:testInfo.outputPath(`quality-${width}-${speed}-result.png`) });
        await current.evaluate(el => el.getAnimations({ subtree:true }).forEach(animation => { animation.currentTime = 950; }));
        const landed = await playerBounds(result);
        expect(landed!.width).toBe(emerging!.width);
        expect(landed!.height).toBe(emerging!.height);
        expect(await playerBounds(prefix)).toEqual(initial);
        await current.screenshot({ path:testInfo.outputPath(`quality-${width}-${speed}-landing.png`) });
        await current.evaluate(el => el.getAnimations({ subtree:true }).forEach(animation => animation.finish()));
        await expect(viewer).toHaveAttribute('data-animating', 'false');
        const final = await playerBounds(current.locator('[data-part="product-result"]'));
        for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(final![key] - landed![key])).toBeLessThan(.1);
      }
      await expect(current).toHaveText('3 + 8');
      expect(await playerBounds(prefix)).toEqual(initial);
      await current.screenshot({ path:testInfo.outputPath(`quality-${width}-${speed}-finished.png`) });
      const product = current.locator('[data-part="product-result"]');
      const spacing = await product.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); return { box:el.getBoundingClientRect().width, text:range.getBoundingClientRect().width }; });
      expect(Math.abs(spacing.box - spacing.text)).toBeLessThan(.1);
      await page.getByRole('button', { name:'Previous step', exact:true }).click();
      await expect(current).toHaveText('3 + 2 × 4');
    }
  }
});

async function freezeMath(page: Page, time: number) {
  await page.locator('#math-current').evaluate((el, value) => el.getAnimations({ subtree:true }).forEach(animation => { animation.pause(); animation.currentTime = value; }), time);
}
async function finishMath(page: Page) {
  await page.locator('#math-current').evaluate(el => el.getAnimations({ subtree:true }).forEach(animation => animation.finish()));
  await expect(page.locator('#math-viewer')).toHaveAttribute('data-animating', 'false');
}
async function glyphBounds(locator: Locator) {
  return locator.evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const bounds = range.getBoundingClientRect(), player = el.closest('#math-viewer')!.getBoundingClientRect();
    return { x:bounds.x - player.x, y:bounds.y - player.y, width:bounds.width, height:bounds.height };
  });
}

test('math remaining arithmetic flows keep natural spacing and exact glyph handoffs', async ({ page }, testInfo) => {
  await readyMath(page);
  const current = page.locator('#math-current');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height:720 });
    for (const speed of ['1', '0.5']) {
      await page.locator('#math-speed').selectOption(speed);
      for (const item of [
        { example:'order', from:2, result:'11', id:'sum-result' },
        { example:'grouping', from:1, result:'5 × 4', id:'sum-result' },
        { example:'grouping', from:2, result:'20', id:'product-result' },
      ]) {
        await page.locator('#math-example').selectOption(item.example); await scrubTo(page, item.from);
        await page.getByRole('button', { name:'Next step', exact:true }).click();
        if (testInfo.project.name !== 'chromium-reduced') {
          await expect(page.locator('#math-viewer')).toHaveAttribute('data-animating', 'true');
          await freezeMath(page, 550);
          const ghost = current.locator('.math-evaluation-flight');
          const emerging = await playerBounds(ghost);
          await current.screenshot({ path:testInfo.outputPath(`${item.example}-${item.from}-${width}-${speed}-emerging.png`) });
          await freezeMath(page, 950);
          const landed = await glyphBounds(ghost);
          const box = await playerBounds(ghost);
          expect(box.width).toBe(emerging.width); expect(box.height).toBe(emerging.height);
          await current.screenshot({ path:testInfo.outputPath(`${item.example}-${item.from}-${width}-${speed}-landing.png`) });
          const factor = item.example === 'grouping' && item.from === 1 ? await glyphBounds(current.locator('[data-part="factor"]')) : undefined;
          await finishMath(page);
          const final = await glyphBounds(current.locator(`[data-part="${item.id}"]`));
          for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(final[key] - landed[key])).toBeLessThan(.1);
          if (factor) expect(await glyphBounds(current.locator('[data-part="factor"]'))).toEqual(factor);
        }
        await expect(current).toHaveText(item.result);
        await current.screenshot({ path:testInfo.outputPath(`${item.example}-${item.from}-${width}-${speed}-finished.png`) });
      }
    }
  }
});

test('math algebra pairs operations, shows additive cancellation and defers the solved variable', async ({ page }, testInfo) => {
  await readyMath(page); await page.locator('#math-example').selectOption('equation');
  const current = page.locator('#math-current'), viewer = page.locator('#math-viewer');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height:720 });
    for (const speed of ['1', '0.5']) {
      await page.locator('#math-speed').selectOption(speed);
      for (const from of [1, 2, 3, 4]) {
        await scrubTo(page, from);
        const equals = await playerBounds(current.locator('.math-equals'));
        await page.getByRole('button', { name:'Next step', exact:true }).click();
        if (testInfo.project.name !== 'chromium-reduced') {
          await expect(viewer).toHaveAttribute('data-animating', 'true');
          await freezeMath(page, from === 2 ? 700 : 550);
          if (from === 2) {
            await expect(current.locator('.math-cancel-stroke')).toHaveCount(2);
            await expect(current.locator('.math-zero-phase')).toHaveText('+ 0');
          }
          if (from === 1 || from === 3) {
            const ids = from === 1 ? ['left-operation', 'right-operation'] : ['left-divisor', 'right-divisor'];
            const opacities = await current.evaluate((el, names) => names.map(name => getComputedStyle(el.querySelector(`[data-part="${name}"]`)!).opacity), ids);
            expect(opacities[0]).toBe(opacities[1]);
          }
          if (from === 4) await expect(page.locator('.math-variable')).toHaveAttribute('aria-label', 'x: unknown');
          await current.screenshot({ path:testInfo.outputPath(`algebra-${from}-${width}-${speed}-operation.png`) });
          if (from === 2) {
            await freezeMath(page, 1100);
            await current.screenshot({ path:testInfo.outputPath(`algebra-${from}-${width}-${speed}-zero.png`) });
            expect(Number(await current.locator('.math-zero-phase').evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(.5);
          }
          await freezeMath(page, from === 2 ? 1750 : 950);
          const landed = await current.locator('.math-evaluation-flight').evaluateAll(nodes => nodes.map(el => {
            const range = document.createRange(); range.selectNodeContents(el); const box = range.getBoundingClientRect();
            return { text:el.textContent!, x:box.x, y:box.y, width:box.width, height:box.height };
          }));
          await current.screenshot({ path:testInfo.outputPath(`algebra-${from}-${width}-${speed}-landing.png`) });
          await finishMath(page);
          for (const item of landed) {
            const actual = await current.locator('[data-part]').filter({ hasText:new RegExp(`^${item.text}$`) }).last().evaluate(el => {
              const range = document.createRange(); range.selectNodeContents(el); const r = range.getBoundingClientRect();
              return { x:r.x, y:r.y, width:r.width, height:r.height };
            });
            for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(actual[key] - item[key])).toBeLessThan(.1);
          }
        }
        expect(await playerBounds(current.locator('.math-equals'))).toEqual(equals);
        await current.screenshot({ path:testInfo.outputPath(`algebra-${from}-${width}-${speed}-finished.png`) });
        await expect(current).toHaveText(['', '', '2x + 3 − 3=11 − 3', '2x=8', '2x ÷ 2=8 ÷ 2', 'x=4'][from + 1]);
        await expect(page.locator('.math-variable')).toHaveAttribute('aria-label', from === 4 ? 'x: 4' : 'x: unknown');
      }
    }
  }
});

test('math theme changes finish the selected state without stale motion colors', async ({ page }, testInfo) => {
  await readyMath(page); await scrubTo(page, 1);
  await page.getByRole('button', { name:'Next step', exact:true }).click();
  if (testInfo.project.name !== 'chromium-reduced') {
    await expect(page.locator('#math-viewer')).toHaveAttribute('data-animating', 'true');
    await freezeMath(page, 550);
  }
  await page.locator('#site-theme').selectOption('paper');
  await expect(page.locator('#math-viewer')).toHaveAttribute('data-animating', 'false');
  await expect(page.locator('#math-current')).toHaveText('3 + 8');
  await expect(page.locator('#math-counter')).toHaveText('Step 2 of 3');
  await expect(page.locator('.math-evaluation-flight, .math-zero-phase, .math-cancel-stroke')).toHaveCount(0);
  await expect.poll(() => page.locator('#math-current .math-emphasis').evaluate(el => getComputedStyle(el).color)).toBe('rgb(37, 108, 97)');
});

test('math cancellation can be interrupted without leaving strokes, zero or stale variable state', async ({ page }, testInfo) => {
  await readyMath(page); await page.locator('#math-example').selectOption('equation');
  for (const action of ['back', 'restart', 'resize']) {
    await scrubTo(page, 2);
    await page.getByRole('button', { name:'Next step', exact:true }).click();
    if (testInfo.project.name !== 'chromium-reduced') {
      await expect(page.locator('#math-viewer')).toHaveAttribute('data-animating', 'true');
      await freezeMath(page, 1100);
      await expect(page.locator('.math-cancel-stroke')).toHaveCount(2);
      await expect(page.locator('.math-zero-phase')).toHaveText('+ 0');
    }
    if (action === 'back') await page.getByRole('button', { name:'Previous step', exact:true }).click();
    else if (action === 'restart') await page.getByRole('button', { name:'Restart', exact:true }).click();
    else await page.setViewportSize({ width:390, height:600 });
    await expect(page.locator('#math-viewer')).toHaveAttribute('data-animating', 'false');
    await expect(page.locator('.math-cancel-stroke, .math-zero-phase, .math-evaluation-flight')).toHaveCount(0);
    await expect(page.locator('#math-current')).toHaveText(action === 'back' ? '2x + 3 − 3=11 − 3' : action === 'restart' ? '2x + 3=11' : '2x=8');
    if (action === 'restart') await expect(page.locator('.math-variable')).toHaveCount(0);
    else await expect(page.locator('.math-variable')).toHaveAttribute('aria-label', 'x: unknown');
  }
});
