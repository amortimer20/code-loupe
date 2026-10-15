import { test, expect, ready, corpus } from './helpers';
import type { CodeLoupe } from '../../packages/player/src/code-loupe';

/**
 * Golden animation timelines. For every forward step of every canonical lesson, record each
 * Web Animation the player creates (target, keyframes, delay, duration, easing) and compare it
 * with a checked-in baseline. Screenshots only show still states, so this is the safety net for
 * refactors of the animation code: they must reproduce the same timelines.
 *
 * It lives in the Docker-pinned visual project because flight paths depend on layout. Update the
 * baselines only for an intentional animation change: `npm run test:visual:update`.
 */
test.use({ reducedMotion: 'no-preference' });

for (const { id, steps } of corpus) {
  test(`${id}: forward animation timeline`, async ({ page }) => {
    await page.goto(`/samples/python/${id}/`);
    const player = await ready(page, steps);
    await page.evaluate(() => document.fonts.ready);

    const timeline: unknown[] = [];
    for (let step = 1; step <= steps; step++) {
      timeline.push(await player.evaluate((el, index) => {
        const round = (text: string) => text.replace(/-?\d+\.\d+/g, number => String(Math.round(Number(number) * 10) / 10));
        const describe = (node: Element | null) => {
          const path: string[] = [];
          for (let current = node; current && path.length < 5; current = current.parentElement) {
            const data = Object.entries((current as HTMLElement).dataset ?? {}).map(([key, value]) => `${key}=${value}`).join(',');
            const classes = (current.getAttribute('class') ?? '').trim().replace(/\s+/g, '.');
            path.push(`${current.tagName.toLowerCase()}${classes ? `.${classes}` : ''}${data ? `[${data}]` : ''}`);
          }
          const text = (node?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
          return path.join(' < ') + (text ? ` "${text}"` : '');
        };
        // Stepping forward by one renders synchronously and creates this step's animations.
        (el as CodeLoupe).goTo(index);
        return {
          step: index,
          animations: el.shadowRoot!.getAnimations().map(animation => {
            const effect = animation.effect as KeyframeEffect;
            const { delay, duration, easing, fill, iterations, direction } = effect.getTiming();
            return {
              target: describe(effect.target as Element | null),
              timing: { delay, duration, easing, fill, iterations, direction },
              keyframes: effect.getKeyframes().map(frame => Object.fromEntries(
                Object.entries(frame).map(([key, value]) => [key, typeof value === 'string' ? round(value) : value]))),
            };
          }),
        };
      }, step));
    }
    expect(JSON.stringify(timeline, null, 1) + '\n').toMatchSnapshot(`${id}.json`);
  });
}
