import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect, corpus, canonical } from './helpers';

/**
 * Builder DOM baselines. The builder draws its whole interface from template strings, so this
 * records a hash of its complete HTML for every canonical lesson step (card expanded), for the new
 * card form of every action, and for a lesson full of hostile markup. Refactors of how the
 * builder renders must leave the HTML unchanged. Teacher text must never become live markup:
 * the hostile lesson also asserts, in every state it captures, that no element, handler, or
 * script it contains takes effect.
 *
 * Each state's HTML is written to test-results/builder-dom/ for inspection. It runs in the Docker
 * visual project like the other baselines; update only for an intentional change to the builder's
 * markup: `npm run test:visual:update`.
 */
test.use({ reducedMotion: 'reduce' });

const actions = ['highlight', 'badge', 'assign', 'print', 'write', 'input', 'convert', 'update', 'select', 'append', 'remove'];

const hostile = `title: '<b>Title</b> & "quotes" </summary><script>window.__xss = 1</script>'
language: python
code: |
  print("<img src=x onerror=window.__xss=2>")
  x = '<svg onload=window.__xss=3>' + "&amp; \\"q\\""
  y = 1
steps:
  - line: 1
    caption: '<img src=x onerror=window.__xss=4> caption & "q" </textarea><script>window.__xss = 5</script>'
  - line: 2
    assign: { var: x, value: '</textarea><img src=x onerror=window.__xss=6>' }
    caption: "' onfocus='window.__xss=7' autofocus x='"
  - badge: { over: '<svg onload=window.__xss=3>', value: '<b>bold</b>' }
  - line: 3
    badge: { over: y, value: '</textarea><img src=x onerror=window.__xss=6>', from: 'x' }
  - print: '</script><svg onload=window.__xss=8>'
  - write: '"><img src=x onerror=window.__xss=9>'
  - input: '<iframe srcdoc="<script>parent.__xss=10</script>"></iframe>'
  - assign: { var: y, value: [1, '<img src=x onerror=window.__xss=11>', true, null] }
`;

async function open(page: Page, yaml: string) {
  await page.addInitScript(text => {
    if (!localStorage.getItem('builder-dom-started')) {
      localStorage.setItem('code-loupe:playground-draft', text);
      localStorage.setItem('builder-dom-started', 'true');
    }
  }, yaml);
  await page.goto('/playground/');
  await expect(page.locator('#preview-status')).toContainText('Ready');
  await expect(page.locator('#builder-pane .builder-card').first()).toBeVisible();
}

/** Teacher text must stay text: nothing in the builder may be a live element, handler, or script. */
async function assertInert(page: Page) {
  await expect(page.locator('#builder-pane').locator('img, iframe, script, [onerror], [onload], [onfocus]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
}

async function capture(page: Page, label: string, inert = false) {
  // Let the preview follow the selected step and any follow-up render finish.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  if (inert) await assertInert(page);
  const html = await page.locator('#builder-pane').evaluate(element => element.innerHTML);
  const directory = new URL('../../test-results/builder-dom/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(`${label}.html`, directory), html);
  return createHash('sha256').update(html).digest('hex').slice(0, 16);
}

async function expand(page: Page, index: number) {
  const header = page.locator(`#builder-pane .builder-step[data-step="${index}"]`);
  await header.click();
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
}

async function everyStep(page: Page, id: string, hashes: Record<string, string>, inert = false) {
  const count = await page.locator('#builder-pane .builder-step[data-step]').count();
  for (let index = 0; index < count; index++) {
    await expand(page, index);
    hashes[`step ${index + 1}`] = await capture(page, `${id}-step-${index + 1}`, inert);
  }
}

for (const { id } of corpus) {
  test(`${id}: builder card forms`, async ({ page }) => {
    await open(page, await canonical(id));
    const hashes: Record<string, string> = {};
    await everyStep(page, id, hashes);
    expect(JSON.stringify(hashes, null, 1) + '\n').toMatchSnapshot(`${id}.json`);
  });
}

for (const id of ['numeric-input', 'list-update']) {
  test(`${id}: a new card for every action`, async ({ page }) => {
    await open(page, await canonical(id));
    const hashes: Record<string, string> = {};
    for (const action of actions) {
      await page.locator('#builder-new-action').selectOption(action);
      await page.getByRole('button', { name: 'Add step', exact: true }).click();
      await expect(page.locator('#builder-pane [data-new-step]')).toBeVisible();
      hashes[`new ${action}`] = await capture(page, `new-${id}-${action}`);
      await page.getByRole('button', { name: 'Cancel new step', exact: true }).click();
      await expect(page.locator('#builder-pane [data-new-step]')).toHaveCount(0);
    }
    expect(JSON.stringify(hashes, null, 1) + '\n').toMatchSnapshot(`new-cards-${id}.json`);
  });
}

test('hostile text stays text in every card and form', async ({ page }) => {
  await open(page, hostile);
  const hashes: Record<string, string> = {};
  hashes.overview = await capture(page, 'hostile-overview', true);
  await everyStep(page, 'hostile', hashes, true);
  await page.locator('#builder-pane .builder-details summary').click();
  hashes.details = await capture(page, 'hostile-details', true);
  expect(JSON.stringify(hashes, null, 1) + '\n').toMatchSnapshot('hostile.json');
});
